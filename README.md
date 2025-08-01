# PlayGround

This repository contains a simple dual chatbot example. You can choose which
model each agent uses. The default is OpenAI, but you can switch either side to
an XAI model based on `distilgpt2`.

Example usage:

```bash
python dual_chatbot/bot_conversation.py --seller-model openai --buyer-model xai
```

Each agent has private functions that are not shared with the other. The seller
has access to a `seller_secret` tool and the buyer can call `buyer_secret`.