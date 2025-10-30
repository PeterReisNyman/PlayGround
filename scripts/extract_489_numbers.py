import json
import re
from pathlib import Path
import argparse


def clean_digits(value: str) -> str:
    """Return only digits from a phone string."""
    return re.sub(r"\D", "", str(value))


def main(input_path: Path, output_path: Path) -> None:
    # Load input JSON
    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    # Map numbers starting with 489 -> list of listings where they appear
    results: dict[str, list] = {}

    for listing_url, payload in data.items():
        # Expect payload format: [phones_list, agency, address, description, flag]
        phones = []
        if isinstance(payload, list) and payload:
            first = payload[0]
            if isinstance(first, list):
                phones = first

        for phone in phones:
            digits = clean_digits(phone)
            if digits.startswith("489"):
                results.setdefault(digits, []).append(
                    {
                        "listing_url": listing_url,
                        "listing_data": payload,
                        "whatsapp_link": f"https://wa.me/55{digits}?text=hello",
                        "sent": False,
                    }
                )

    # Ensure parent directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in results.values())
    print(f"Extracted {total} occurrences across {len(results)} numbers to: {output_path}")


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[1]
    default_input = repo_root / "organized_data.json"
    default_output = repo_root / "outputs" / "489_numbers_with_links.json"

    parser = argparse.ArgumentParser(
        description=(
            "Extract all phone numbers starting with 489 from organized_data.json, "
            "including each occurrence, and add a WhatsApp link."
        )
    )
    parser.add_argument("--input", type=Path, default=default_input, help="Input JSON path")
    parser.add_argument(
        "--output", type=Path, default=default_output, help="Output JSON path"
    )
    args = parser.parse_args()

    main(args.input, args.output)
