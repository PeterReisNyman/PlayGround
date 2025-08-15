from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def _now_slug() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def build_env(seed: int, variant: int) -> dict[str, str]:
    env = os.environ.copy()
    # Perturbations (safe, process-local)
    env["PYTHONHASHSEED"] = str(seed)
    tz_options = ["UTC", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"]
    env["TZ"] = tz_options[variant % len(tz_options)]
    # Hints that tests could observe (no-ops if tests ignore them)
    env["FLAKY_JITTER_MS"] = str(random.randint(0, 200))
    env["FLAKY_IO_DELAY_MS"] = str(random.randint(0, 50))
    env["LC_ALL"] = "C"
    return env


def run_once(cmd: str, env: dict[str, str], cwd: str | None, timeout: float | None) -> dict:
    # Small launch jitter
    jitter = int(env.get("FLAKY_JITTER_MS", "0")) / 1000.0
    if jitter:
        time.sleep(min(0.25, jitter))
    try:
        proc = subprocess.run(
            cmd if isinstance(cmd, list) else shlex.split(cmd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd,
            env=env,
            timeout=timeout,
            text=True,
        )
        rc = proc.returncode
        out = proc.stdout
        err = proc.stderr
        status = "pass" if rc == 0 else "fail"
        return {"rc": rc, "status": status, "stdout": out, "stderr": err}
    except subprocess.TimeoutExpired as e:
        return {
            "rc": -1,
            "status": "timeout",
            "stdout": e.stdout or "",
            "stderr": (e.stderr or "") + "\n<timeout>",
        }


def signature_from_output(stdout: str, stderr: str) -> str:
    # Focus on error-ish lines for stability
    lines = (stderr + "\n" + stdout).splitlines()
    err_like = [
        ln for ln in lines if (
            ln.startswith("E   ") or
            "AssertionError" in ln or
            "Traceback (most recent call last)" in ln or
            ln.startswith("FAIL ") or
            ln.startswith("FAILED ") or
            ": error:" in ln or
            ": FAIL" in ln or
            ": Assertion" in ln
        )
    ]
    sample = "\n".join(err_like[-20:] or lines[-20:])
    # Normalize numbers/paths a bit to avoid over-fragmentation
    import re
    norm = re.sub(r"/[^\s:]+\.py", "<path>.py", sample)
    norm = re.sub(r"0x[0-9a-fA-F]+", "0x..", norm)
    norm = re.sub(r"\b\d{4,}\b", "<num>", norm)
    h = hashlib.sha256(norm.encode("utf-8", errors="replace")).hexdigest()[:12]
    return f"sig_{h}"


def suggest_cause(signature_text: str) -> str:
    s = signature_text.lower()
    if "timeout" in s or "timed out" in s:
        return "timing/timeout sensitivity — check timeouts and async waits"
    if "random" in s or "seed" in s or "flaky" in s:
        return "nondeterministic behavior — seed/state isolation"
    if "keyerror" in s or "attributeerror" in s:
        return "state/order dependency or race condition"
    if "connection" in s or "socket" in s:
        return "network dependency — add retries/mocks"
    if "file not found" in s or "enoent" in s:
        return "fs dependency — temp dirs/paths and cleanup"
    return "intermittent failure — investigate logs and isolate minimal repro"


def write_reports(out_dir: Path, runs: list[dict]):
    out_dir.mkdir(parents=True, exist_ok=True)
    # Aggregate
    total = len(runs)
    failures = [r for r in runs if r["status"] != "pass"]
    clusters: dict[str, dict] = {}
    for r in failures:
        sig = signature_from_output(r["stdout"], r["stderr"])
        if sig not in clusters:
            clusters[sig] = {
                "count": 0,
                "examples": [],
                "sample_text": "",
            }
        clusters[sig]["count"] += 1
        text = (r["stderr"] + "\n" + r["stdout"]).strip()
        if not clusters[sig]["sample_text"] and text:
            clusters[sig]["sample_text"] = text[-4000:]
        if len(clusters[sig]["examples"]) < 3:
            clusters[sig]["examples"].append({
                "rc": r["rc"],
                "status": r["status"],
                "stdout_tail": r["stdout"][-800:],
                "stderr_tail": r["stderr"][-800:],
            })

    summary = {
        "total_runs": total,
        "passes": len([r for r in runs if r["status"] == "pass"]),
        "failures": len(failures),
        "clusters": [
            {
                "signature": sig,
                "count": info["count"],
                "fraction": info["count"] / total,
                "suggestion": suggest_cause(info["sample_text"]),
                "sample_text": info["sample_text"],
                "examples": info["examples"],
            }
            for sig, info in sorted(clusters.items(), key=lambda kv: kv[1]["count"], reverse=True)
        ],
    }

    (out_dir / "report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Markdown report
    lines = []
    lines.append(f"# Flakiness Hunter Report\n")
    lines.append(f"- Total runs: {summary['total_runs']}\n")
    lines.append(f"- Passes: {summary['passes']}\n")
    lines.append(f"- Failures: {summary['failures']}\n")
    lines.append("")
    if summary["failures"]:
        lines.append("## Failure clusters\n")
        for c in summary["clusters"]:
            lines.append(f"### {c['signature']} — {c['count']} ({c['fraction']:.1%})\n")
            lines.append(f"Suggestion: {c['suggestion']}\n")
            if c["sample_text"]:
                lines.append("<details><summary>Sample</summary>\n\n")
                # Escape backticks minimally
                snippet = c["sample_text"].replace("```", "``\`")
                lines.append("```\n" + snippet + "\n```\n")
                lines.append("</details>\n")
    else:
        lines.append("No failures observed.\n")

    (out_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Test Flakiness Hunter")
    p.add_argument("--cmd", required=True, help="Test command to run (quoted string)")
    p.add_argument("--runs", type=int, default=20, help="Number of runs")
    p.add_argument("--timeout", type=float, default=None, help="Per-run timeout in seconds")
    p.add_argument("--out-dir", default=None, help="Output directory (default: .flakiness_hunter/<ts>)")
    p.add_argument("--cwd", default=None, help="Working directory to run the command from")
    args = p.parse_args(argv)

    out_dir = Path(args.out_dir) if args.out_dir else Path(".flakiness_hunter") / _now_slug()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[flaky] cmd={args.cmd}")
    print(f"[flaky] runs={args.runs} out_dir={out_dir}")

    results: list[dict] = []
    for i in range(args.runs):
        seed = random.randint(0, 2**32 - 1)
        env = build_env(seed, i)
        print(f"[flaky] run {i+1}/{args.runs} seed={seed} tz={env['TZ']}")
        r = run_once(args.cmd, env=env, cwd=args.cwd, timeout=args.timeout)
        results.append(r)
        # Write a quick per-run log
        (out_dir / f"run_{i:03d}.json").write_text(json.dumps(r, indent=2), encoding="utf-8")

    write_reports(out_dir, results)
    print(f"[flaky] report: {out_dir/'report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

