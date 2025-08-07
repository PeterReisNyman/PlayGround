# PlayGround

# Voxelcraft (minimal Minecraft-like clone)

A minimal WebGL voxel world with long-horizon fog, chunk streaming, and per-block color jitter. No dependencies; open the HTML file to play.

Features
- Infinite-ish terrain via streamed chunks around the player
- Simple value-noise terrain with water, grass, dirt, sand, and stone
- Per-block base colors with slight deterministic randomization
- Horizon fog with adjustable distance (+/-)
- Mouse look and WASD flight movement (space up, shift down/boost)

How to run
- Open voxelcraft/index.html in a modern browser (Chrome, Edge, Firefox, Safari).
- Click "Click to Lock Pointer" to capture the mouse.
- Controls: WASD move, Space up, Shift down/boost, +/- adjust fog.

Notes
- This is a tiny demo focused on performance and simplicity rather than full gameplay.
- View distance can be tuned in voxelcraft/main.js by changing viewDistance.chunks and fogDistance.

This repository contains a simple dual chatbot example. You can choose which
model each agent uses. The default is OpenAI, but you can switch either side to
an XAI model based on `distilgpt2`.

Example usage:

```bash
python dual_chatbot/bot_conversation.py --seller-model openai --buyer-model xai
```

Each agent has private functions that are not shared with the other. The seller
has access to a `seller_secret` tool and the buyer can call `buyer_secret`.
