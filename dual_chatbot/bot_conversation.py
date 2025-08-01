import json
import os
import openai


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


def main():
    messages = load_system_messages(os.path.join(os.path.dirname(__file__), 'system_messages.json'))

    openai.api_key = os.getenv('OPENAI_API_KEY', '')

    conversation = [
        {"role": "system", "content": messages["seller"]},
        {"role": "system", "content": messages["buyer"]},
    ]

    tools = [
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

    role_cycle = [
        ("seller", messages["seller"]),
        ("buyer", messages["buyer"]),
    ]

    for i in range(30):
        role, _ = role_cycle[i % 2]
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=conversation,
            tools=tools,
        )
        message = response["choices"][0]["message"]
        conversation.append(message)
        print(f"{role.capitalize()}:", message.get("content"))
        if message.get("tool_calls"):
            for call in message["tool_calls"]:
                if call["function"]["name"] == "stop":
                    print("Conversation stopped by tool.")
                    return
                if call["function"]["name"] == "info":
                    info_msg = info(role)
                    conversation.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(info_msg)})


if __name__ == "__main__":
    main()
