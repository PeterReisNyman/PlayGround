import argparse
import json
import os
import openai
from transformers import pipeline


def parse_args():
    parser = argparse.ArgumentParser(description="Dual chatbot")
    parser.add_argument(
        "--seller-model",
        choices=["openai", "xai"],
        default="openai",
        help="Model to use for the seller agent",
    )
    parser.add_argument(
        "--buyer-model",
        choices=["openai", "xai"],
        default="openai",
        help="Model to use for the buyer agent",
    )
    return parser.parse_args()


def load_system_messages(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def stop():
    """Tool that ends the conversation"""
    return {"message": "stop"}


def info(role: str):
    """Tool that tells the agent its role"""
    if role == 'seller':
        return {"message": "you are the seller"}
    return {"message": "you are the buyer"}


def seller_secret():
    """Private tool only visible to the seller"""
    return {"secret": "seller data"}


def buyer_secret():
    """Private tool only visible to the buyer"""
    return {"secret": "buyer data"}


def call_openai(role: str, conversation, tools):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=conversation,
        tools=tools,
    )
    message = response["choices"][0]["message"]
    conversation.append(message)
    print(f"{role.capitalize()}:", message.get("content"))
    stop_conversation = False
    if message.get("tool_calls"):
        for call in message["tool_calls"]:
            name = call["function"]["name"]
            if name == "stop":
                print("Conversation stopped by tool.")
                stop_conversation = True
            elif name == "info":
                info_msg = info(role)
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(info_msg),
                    }
                )
            elif name == "seller_secret" and role == "seller":
                secret_msg = seller_secret()
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(secret_msg),
                    }
                )
            elif name == "buyer_secret" and role == "buyer":
                secret_msg = buyer_secret()
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(secret_msg),
                    }
                )
    return stop_conversation


def call_xai(role: str, conversation, pipe):
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in conversation)
    if len(prompt.split()) > 200:
        prompt_words = prompt.split()
        prompt = " ".join(prompt_words[-200:])
    generated = pipe(prompt, max_new_tokens=50)[0]["generated_text"]
    generated = generated[len(prompt) :].strip()
    conversation.append({"role": role, "content": generated})
    print(f"{role.capitalize()}:", generated)
    return False


def main():
    args = parse_args()

    messages = load_system_messages(os.path.join(os.path.dirname(__file__), "system_messages.json"))

    openai.api_key = os.getenv("OPENAI_API_KEY", "")

    pipe = pipeline("text-generation", model="distilgpt2")

    conversation = [
        {"role": "system", "content": messages["seller"]},
        {"role": "system", "content": messages["buyer"]},
    ]

    public_tools = [
        {
            "type": "function",
            "function": {
                "name": "stop",
                "description": "Stop the conversation",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "info",
                "description": "Get the agent role information",
                "parameters": {"type": "object", "properties": {}},
            },
        },
    ]

    seller_private = [
        {
            "type": "function",
            "function": {
                "name": "seller_secret",
                "description": "Seller private function",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]

    buyer_private = [
        {
            "type": "function",
            "function": {
                "name": "buyer_secret",
                "description": "Buyer private function",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]

    models = {"seller": args.seller_model, "buyer": args.buyer_model}

    role_cycle = [("seller", messages["seller"]), ("buyer", messages["buyer"])]

    for i in range(30):
        role, _ = role_cycle[i % 2]
        model = models[role]
        if model == "openai":
            tools = public_tools + (seller_private if role == "seller" else buyer_private)
            stop_conv = call_openai(role, conversation, tools)
            if stop_conv:
                return
        else:
            call_xai(role, conversation, pipe)


if __name__ == "__main__":
    main()
