#!/usr/bin/env python3
"""
Generate WhatsApp Click-to-Chat links that open a prefilled message
to a given phone number. When opened, WhatsApp (mobile or web) shows
the chat with your message ready; you press Send.

Examples:
  python3 src/realtor/whatsapp_link.py --to 15551234567 --message "Hi there"
  python3 src/realtor/whatsapp_link.py --to 5511999999999 447700900123 --message "Olá!" --open

Notes:
  - Use full international phone format without '+' or symbols: e.g., 15551234567.
  - Links do not auto-send; WhatsApp intentionally requires a manual Send.
"""

from __future__ import annotations

import argparse
from typing import List
from urllib.parse import quote
import webbrowser


def normalize_phone(raw: str) -> str:
    """Digits-only international format (no '+', spaces, or symbols)."""
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if len(digits) < 8:  # minimal sanity check
        raise ValueError(
            f"Phone '{raw}' seems invalid. Use full international format, e.g., 15551234567."
        )
    return digits


def build_link(phone: str, message: str, provider: str = "wa") -> str:
    """Build a Click-to-Chat link.

    provider:
      - 'wa'  -> https://wa.me/<phone>?text=...
      - 'api' -> https://api.whatsapp.com/send?phone=<phone>&text=...
    """
    phone_digits = normalize_phone(phone)
    encoded_msg = quote(message, safe="")
    if provider == "api":
        return f"https://api.whatsapp.com/send?phone={phone_digits}&text={encoded_msg}"
    return f"https://wa.me/{phone_digits}?text={encoded_msg}"


def main(argv: List[str] | None = None):
    p = argparse.ArgumentParser(description="Generate WhatsApp Click-to-Chat links")
    p.add_argument("--to", nargs="+", required=True, help="One or more destination phone numbers (international format, no '+')")
    p.add_argument("--message", required=True, help="Message text to prefill")
    p.add_argument("--provider", choices=["wa", "api"], default="wa", help="Link provider style (default: wa)")
    p.add_argument("--open", action="store_true", help="Open generated links in your default browser")
    args = p.parse_args(argv)

    links = [build_link(num, args.message, provider=args.provider) for num in args.to]
    for link in links:
        print(link)
        if args.open:
            webbrowser.open(link)


if __name__ == "__main__":
    main()

