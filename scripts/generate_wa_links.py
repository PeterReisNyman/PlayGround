import json
import re
import argparse
import csv
from pathlib import Path
from urllib.parse import quote


REPO_ROOT = Path(__file__).resolve().parents[1]


def normalize_digits(s: str) -> str:
    return re.sub(r"\D+", "", s)


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

    # Message provided by user (kept exactly, including newline between paragraphs)
    message = (
        "Olá C. Lorca Imóveis, tudo bem? Sou Alfonso, agente da MRE, empresa multinacional já consolidada nos EUA e que está inovando o mercado imobiliário no Brasil. Já trabalhamos com corretores da Coelho da Fonseca e agora queremos ampliar nosso alcance para mais bairros de São Paulo.\n\n"
        "Vi o apartamento de vocês na Rua Nagel, Vila Leopoldina, São Paulo e fiquei impressionado com a qualidade do anúncio e da propriedade. Gostaria de conversar e mostrar como a MRE pode gerar leads exclusivos e qualificados para a equipe de vocês, sem cobrança inicial nem compromisso."
    )

    enc_message = quote(message, safe="")

    phones = set()

    # Data structure: { url: [ [phones], name, address, description, bool ] }
    for _, value in data.items():
        if not isinstance(value, list) or not value:
            continue
        raw_list = value[0] if isinstance(value[0], list) else []
        for raw in raw_list:
            digits = normalize_digits(str(raw))
            # Keep only numbers that start with '119'
            if digits.startswith("119"):
                phones.add(digits)

    links = [(p, f"https://wa.me/55{p}?text={enc_message}") for p in sorted(phones)]

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.suffix.lower() == ".csv":
        with output_path.open("w", encoding="utf-8", newline="") as out:
            writer = csv.writer(out)
            writer.writerow(["phone", "whatsapp_url"])  # clickable in spreadsheet apps
            for phone, url in links:
                writer.writerow([phone, url])
    else:
        with output_path.open("w", encoding="utf-8") as out:
            for _, url in links:
                out.write(url + "\n")

    print(f"Generated {len(links)} links -> {output_path}")


if __name__ == "__main__":
    main()
