"""Send WhatsApp messages to unique numbers extracted from organized data."""

from __future__ import annotations

import argparse
import json
import random
import time
import webbrowser
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Set

import pyautogui
from urllib.parse import quote


MESSAGE_TEMPLATE = (
    """Olá! Sou o Alfonso, presidente da MyRealValuation :)
Trabalhamos com a captação de imóveis de vendedores exclusivos e qualificados.
Vi seu anúncio em {bairro_fragment} e acredito que podemos colaborar!
Nosso site funciona de forma simples: encontramos vendedores, filtramos os contatos, solicitamos fotos do imóvel e enviamos as informações para que você decida se deseja aceitar ou recusar a proposta.
Se tiver interesse, podemos marcar uma breve ligação?
P.S.: br.myrealvaluation.com"""
)

DEFAULT_DATA_PATH = Path("outputs") / "119_numbers_with_links.json"
DEFAULT_SENT_PATH = Path("outputs") / "sent.csv"


def extract_bairro(address: str) -> str:
    """Return the bairro fragment from an address string."""
    if not address:
        return ""

    parts = [part.strip() for part in address.split(" - ") if part.strip()]
    if not parts:
        parts = [part.strip() for part in address.split(",") if part.strip()]

    if not parts:
        return ""

    # Prefer the penultimate part when there are multiple segments (street - bairro - city)
    if len(parts) >= 2:
        return parts[-2]

    return parts[-1]


def clean_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def normalize_with_country_code(number: str) -> str:
    """Return the numeric phone string prefixed with Brazil's country code."""

    digits = clean_digits(number)
    if not digits:
        return ""

    if digits.startswith("55"):
        return digits

    return f"55{digits}"


def iter_unique_numbers(data: Dict[str, List[Dict]]) -> Iterator[Dict[str, str]]:
    for digits, occurrences in sorted(data.items()):
        number = clean_digits(digits)
        if not number.startswith("119"):
            continue

        bairro_fragment = ""
        for occurrence in occurrences:
            listing_data = occurrence.get("listing_data")
            if not isinstance(listing_data, list) or len(listing_data) < 3:
                continue
            address = listing_data[2]
            if isinstance(address, str):
                bairro_fragment = extract_bairro(address)
                if bairro_fragment:
                    break

        bairro_text = bairro_fragment or "sua região"
        message = MESSAGE_TEMPLATE.format(bairro_fragment=bairro_text)
        encoded_message = quote(message, safe="")
        whatsapp_link = f"https://wa.me/55{number}?text={encoded_message}"

        # Ensure the resulting link respects the requested prefix.
        if not whatsapp_link.split("/")[-1].startswith("5511"):
            continue

        yield {
            "number": number,
            "full_number": normalize_with_country_code(number),
            "bairro": bairro_text,
            "message": message,
            "url": whatsapp_link,
        }


def send_messages(
    contacts: Iterable[Dict[str, str]],
    *,
    wait_seconds: float = 5.0,
    random_extra: float = 3.0,
    dry_run: bool = False,
    browser_name: str = "chrome",
    sent_numbers: Set[str],
    sent_log_path: Path,
) -> None:
    browser = webbrowser.get(browser_name)

    for contact in contacts:
        url = contact["url"]
        message = contact["message"]
        number = contact["number"]
        full_number = contact.get("full_number") or normalize_with_country_code(number)

        if full_number in sent_numbers:
            print(
                f"Skipping +{full_number}: already recorded in '{sent_log_path}'."
            )
            continue
        print(f"Opening chat for +55 {number} -> bairro='{contact['bairro']}'")

        if dry_run:
            print("[dry-run] Would open:", url)
        else:
            browser.open(url, new=2, autoraise=True)

        wait_time = wait_seconds + random.uniform(0, random_extra)
        print(f"Waiting {wait_time:.2f} seconds before sending message...")
        time.sleep(wait_time)

        if dry_run:
            print("[dry-run] Would press Enter to send the message.")
        else:
            pyautogui.press("enter")
            append_sent_number(sent_log_path, full_number)
            sent_numbers.add(full_number)

        print("Done. Moving to the next contact.\n")



def load_contacts(path: Path) -> Dict[str, List[Dict]]:
    if not path.exists():
        raise FileNotFoundError(f"Could not find {path}. Generate it with extract_119_numbers.py first.")

    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)

    if not isinstance(data, dict):
        raise ValueError("Expected the input JSON to be a dictionary of phone numbers.")

    return data



def load_sent_numbers(path: Path) -> Set[str]:
    if not path.exists():
        return set()

    with path.open("r", encoding="utf-8") as fp:
        return {
            normalized
            for line in fp
            if (normalized := normalize_with_country_code(line.strip()))
        }


def append_sent_number(path: Path, number: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fp:
        fp.write(f"{number}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Send WhatsApp messages to each unique number from 119_numbers_with_links.json.",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=DEFAULT_DATA_PATH,
        help="Path to outputs/119_numbers_with_links.json.",
    )
    parser.add_argument(
        "--wait",
        type=float,
        default=5.0,
        help="Base number of seconds to wait before pressing Enter (default: 5).",
    )
    parser.add_argument(
        "--extra",
        type=float,
        default=3.0,
        help="Maximum random extra seconds added to the wait time (default: 3).",
    )
    parser.add_argument(
        "--browser",
        type=str,
        default="chrome",
        help="Browser key to use with webbrowser.get (default: chrome).",
    )
    parser.add_argument(
        "--sent-log",
        type=Path,
        default=DEFAULT_SENT_PATH,
        help="CSV file used to track numbers that already received a message.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not open the browser or send messages; just print actions.",
    )

    args = parser.parse_args()
    data = load_contacts(args.data)
    sent_numbers = load_sent_numbers(args.sent_log)
    contacts = iter_unique_numbers(data)
    send_messages(
        contacts,
        wait_seconds=args.wait,
        random_extra=args.extra,
        dry_run=args.dry_run,
        browser_name=args.browser,
        sent_numbers=sent_numbers,
        sent_log_path=args.sent_log,
    )


if __name__ == "__main__":
    main()
