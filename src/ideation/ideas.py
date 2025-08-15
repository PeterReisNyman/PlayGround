from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


@dataclass(frozen=True)
class Idea:
    title: str
    summary: str
    tags: Tuple[str, ...]


TECH_SEEDS: Tuple[str, ...] = (
    "cellular automata",
    "agentic workflows",
    "TUI dashboards",
    "web assembly",
    "local-first apps",
    "procedural generation",
    "LLM tools",
    "computer vision",
    "sound synthesis",
    "data viz",
)

DOMAINS: Tuple[str, ...] = (
    "education",
    "creative coding",
    "research tooling",
    "developer productivity",
    "health & wellbeing",
    "finance",
    "games",
    "ops & observability",
    "robotics",
    "civic tech",
)

SCAMPER_PROMPTS: Dict[str, str] = {
    "Substitute": "What if we replaced a core component with a simpler or weirder one?",
    "Combine": "What if we fuse two unrelated ideas into one system?",
    "Adapt": "What existing pattern can we adapt to this domain?",
    "Modify": "What small change would create a step-change in UX?",
    "Put to other use": "How could this be repurposed in a new context?",
    "Eliminate": "What can we remove entirely without harming value?",
    "Reverse": "What if we invert the usual control flow or goals?",
}

PERSONAS: Tuple[str, ...] = (
    "curious student",
    "indie hacker",
    "research scientist",
    "SRE on-call",
    "product designer",
    "data journalist",
    "music producer",
)


def _mashup(rng: random.Random) -> Tuple[str, str, Tuple[str, ...]]:
    a, b = rng.sample(TECH_SEEDS, 2)
    domain = rng.choice(DOMAINS)
    title = f"{a.title()} x {b.title()} for {domain.title()}"
    summary = (
        f"Blend {a} with {b} to create a novel tool for {domain}. "
        f"Prototype a minimal workflow and measure value in one week."
    )
    tags = (a, b, domain, "mashup")
    return title, summary, tags


def _scamper(rng: random.Random) -> Tuple[str, str, Tuple[str, ...]]:
    key = rng.choice(list(SCAMPER_PROMPTS.keys()))
    tech = rng.choice(TECH_SEEDS)
    domain = rng.choice(DOMAINS)
    prompt = SCAMPER_PROMPTS[key]
    title = f"SCAMPER — {key} on {tech} in {domain}"
    summary = f"{prompt} Apply to {tech} within {domain}. Ship a small demo."
    tags = (tech, domain, key.lower(), "scamper")
    return title, summary, tags


def _persona_hmw(rng: random.Random) -> Tuple[str, str, Tuple[str, ...]]:
    persona = rng.choice(PERSONAS)
    tech = rng.choice(TECH_SEEDS)
    domain = rng.choice(DOMAINS)
    title = f"How might we help a {persona} using {tech} for {domain}?"
    summary = (
        f"Define pains/goals for a {persona}. Use {tech} to address a key need in {domain}. "
        f"Create a storyboard and a CLI/TUI prototype."
    )
    tags = (persona, tech, domain, "hmw")
    return title, summary, tags


def generate_ideas(n: int = 5, seed: int | None = None) -> List[Idea]:
    rng = random.Random(seed)
    strategies = (_mashup, _scamper, _persona_hmw)
    ideas: List[Idea] = []
    for i in range(n):
        fn = strategies[i % len(strategies)]
        title, summary, tags = fn(rng)
        ideas.append(Idea(title=title, summary=summary, tags=tuple(tags)))
    return ideas

