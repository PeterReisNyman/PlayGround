import json
import re
import argparse
import csv
from pathlib import Path
from urllib.parse import quote
from typing import Dict, Set


REPO_ROOT = Path(__file__).resolve().parents[1]


def normalize_digits(s: str) -> str:
    return re.sub(r"\D+", "", s)


def extract_bairro(address: str) -> str:
    if not address:
        return ""
    parts = [p.strip() for p in address.split(" - ") if p.strip()]
    if not parts:
        return ""
    candidate = parts[-2] if len(parts) >= 2 else parts[-1]
    bairro = candidate.split(",")[0].strip()
    return bairro


def build_message(realtor: str, bairro: str) -> str:
    realtor_fragment = realtor if realtor else ""
    bairro_fragment = bairro if bairro else ""
    return (
        f"""Olá! Sou Alfonso, agente da MRE :) Somos uma empresa multinacional inovando o mercado imobiliário no Brasil.

Vi o seu apartamento na {bairro_fragment}, e achei incrível! Queria te mostrar, como a br.myrealvaluation.com pode garantir em novos clientes vendedores de imóveis exclusivos e qualificados para você.

É só se cadastrar em br.myrealvaluation.com e marcar os bairros que quer atender. Se tiver qualquer dúvida, pode me mandar mensagem por aqui mesmo ;)
"""
)


def main():
    parser = argparse.ArgumentParser(description="Generate WhatsApp links for phones starting with 119.")
    parser.add_argument(
        "--input",
        type=Path,
        default=REPO_ROOT / "organized_data.json",
        help="Path to organized_data.json (default: repo root).",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=REPO_ROOT / "outputs" / "wa_links_119.csv",
        help="Path to save the generated links (default: outputs/wa_links_119.csv).",
    )
    args = parser.parse_args()

    data_path: Path = args.input
    output_path: Path = args.output

    if not data_path.exists():
        raise FileNotFoundError(f"organized_data.json not found at {data_path}")

    with data_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    phones: Dict[str, Dict[str, Set[str]]] = {}

    # Data structure: { url: [ [phones], name, address, description, bool ] }
    for _, value in data.items():
        if not isinstance(value, list) or not value:
            continue
        raw_list = value[0] if isinstance(value[0], list) else []
        realtor_name = value[1].strip() if len(value) > 1 and isinstance(value[1], str) else ""
        address = value[2].strip() if len(value) > 2 and isinstance(value[2], str) else ""
        bairro = extract_bairro(address)

        for raw in raw_list:
            digits = normalize_digits(str(raw))
            # Keep only numbers that start with '119'
            if digits.startswith("119"):
                info = phones.setdefault(digits, {"realtors": set(), "bairros": set()})
                if realtor_name:
                    info["realtors"].add(realtor_name)
                if bairro:
                    info["bairros"].add(bairro)

    links = []
    for phone in sorted(phones):
        info = phones[phone]
        realtor_values = sorted(info["realtors"]) if info["realtors"] else []
        bairro_values = sorted(info["bairros"]) if info["bairros"] else []
        message = build_message(realtor_values[0] if realtor_values else "", bairro_values[0] if bairro_values else "")
        enc_message = quote(message, safe="")
        url = f"https://wa.me/55{phone}?text={enc_message}"
        links.append(url)

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.suffix.lower() == ".csv":
        with output_path.open("w", encoding="utf-8", newline="") as out:
            writer = csv.writer(out)
            writer.writerow(["whatsapp_link"])
            for url in links:
                hyperlink = f'=HYPERLINK("{url}", "Abrir WhatsApp")'
                writer.writerow([hyperlink])
    else:
        with output_path.open("w", encoding="utf-8") as out:
            for url in links:
                out.write(url + "\n")

    print(f"Generated {len(links)} links -> {output_path}")


if __name__ == "__main__":
    main()
