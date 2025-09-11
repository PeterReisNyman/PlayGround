#!/usr/bin/env python3
"""
Send a WhatsApp message from your own WhatsApp account using WhatsApp Web.

First run opens WhatsApp Web for a one-time QR login. Your session is saved
under the repo's cache folder, so you won't need to scan again next time.

Usage:
  python3 src/realtor/send_whatsapp.py --to 15551234567 --message "Hello!"

Requirements:
  - Google Chrome installed
  - Python packages: selenium, webdriver-manager
  - Internet connection
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import quote

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


def normalize_phone(raw: str) -> str:
    """Convert a phone string to digits-only E.164 without '+' (e.g., 15551234567).
    Raises ValueError if the result looks invalid.
    """
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if len(digits) < 8:
        raise ValueError(
            f"Phone number '{raw}' seems invalid. Use full international format, e.g. 15551234567."
        )
    return digits


def find_message_box(driver) -> object | None:
    """Try to locate the message compose editable box.
    Returns the WebElement or None.
    """
    # WhatsApp Web uses a contenteditable div for composing messages.
    candidates = driver.find_elements(By.CSS_SELECTOR, "div[contenteditable='true'][data-tab]")
    for el in reversed(candidates):
        try:
            if el.is_displayed():
                return el
        except Exception:
            continue
    return None


def wait_for_message_box(driver, timeout: int = 300):
    """Wait until the compose box is available (login + chat open)."""
    WebDriverWait(driver, timeout).until(lambda d: find_message_box(d) is not None)
    return find_message_box(driver)


def make_driver(profile_dir: Path, headless: bool = False):
    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={profile_dir}")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    # Headless mode may prevent QR scanning; default is visible.
    if headless:
        # Use the new headless mode for modern Chrome
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1280,900")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(90)
    return driver


def send_whatsapp(phone: str, message: str, profile_dir: Path, headless: bool = False, hold_seconds: int = 3):
    phone_digits = normalize_phone(phone)
    profile_dir.mkdir(parents=True, exist_ok=True)

    driver = make_driver(profile_dir=profile_dir, headless=headless)
    try:
        # Go directly to web.whatsapp.com with a prefilled message.
        url = f"https://web.whatsapp.com/send?phone={phone_digits}&text={quote(message)}"
        print(f"Opening chat for +{phone_digits}...")
        driver.get(url)

        # Wait for the compose box to exist (this also implies login complete).
        print("Waiting for WhatsApp Web (scan QR if prompted)...")
        box = wait_for_message_box(driver, timeout=300)

        # If the prefilled message didn't make it into the box, type it.
        text_in_box = (box.text or "").strip()
        if not text_in_box:
            box.click()
            time.sleep(0.2)
            box.send_keys(message)
            time.sleep(0.2)

        # Send the message by pressing Enter.
        box.send_keys(Keys.ENTER)
        print("Message sent. Holding browser briefly to confirm...")
        time.sleep(hold_seconds)
    finally:
        # Keep session cached; only close this Chrome instance.
        driver.quit()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Send a WhatsApp message via your own account (WhatsApp Web)")
    parser.add_argument("--to", required=True, help="Destination phone in full international format, e.g., 15551234567 (no '+')")
    parser.add_argument("--message", required=True, help="Message text to send")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode (not recommended for first login)")
    parser.add_argument("--hold", type=int, default=3, help="Seconds to keep the browser open after sending (default: 3)")
    parser.add_argument(
        "--profile-dir",
        default=None,
        help="Custom Chrome user-data-dir to persist WhatsApp Web session"
    )
    args = parser.parse_args(argv)

    # Default profile dir: <repo_root>/cache/chrome-whatsapp
    if args.profile_dir:
        profile_dir = Path(args.profile_dir).expanduser().resolve()
    else:
        # Script location: src/realtor; repo root is two parents up
        repo_root = Path(__file__).resolve().parents[2]
        profile_dir = repo_root / "cache" / "chrome-whatsapp"

    try:
        send_whatsapp(
            phone=args.to,
            message=args.message,
            profile_dir=profile_dir,
            headless=args.headless,
            hold_seconds=args.hold,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

