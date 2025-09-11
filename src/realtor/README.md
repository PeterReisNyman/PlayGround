WhatsApp Tools
==============

This folder contains two ways to start WhatsApp conversations with a prefilled message.

1) Click-to-Chat Links (no Selenium)
------------------------------------
Generate a link that opens a chat with your message ready; you press Send.

- Script: `src/realtor/whatsapp_link.py`
- Dependencies: none (stdlib only)

Usage
- One number:
  - `python3 src/realtor/whatsapp_link.py --to 15551234567 --message "Hello!"`
- Multiple numbers + open in browser:
  - `python3 src/realtor/whatsapp_link.py --to 5511999999999 447700900123 --message "Olá!" --open`

Notes
- Use full international phone format without the `+` or symbols (e.g., Brazil `5511999999999`, US `15551234567`).
- Links do not auto-send; WhatsApp intentionally requires a manual Send.
- Providers:
  - Default `wa`: `https://wa.me/<phone>?text=...`
  - Optional `--provider api`: `https://api.whatsapp.com/send?phone=<phone>&text=...`

2) Automated send via WhatsApp Web (Selenium)
---------------------------------------------
This opens WhatsApp Web and sends the message automatically after you scan QR once. This may carry account risk; prefer Click-to-Chat above if you want to avoid automation.

- Script: `src/realtor/send_whatsapp.py`
- Prerequisites: Google Chrome, Python 3.9+, internet access
- Install deps: `pip install -r src/realtor/requirements.txt`

Usage
- Basic example:
  - `python3 src/realtor/send_whatsapp.py --to 15551234567 --message "Hello from automation!"`

Notes
- First run: scan the QR in the opened Chrome window.
- The WhatsApp session is saved in `cache/chrome-whatsapp/` inside this repo.

