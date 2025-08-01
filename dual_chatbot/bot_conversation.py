import json
from openai import OpenAI

LEAD_NAME = "Katia Alonso"

roles = ["lead", "agent"]

def lead_system_message():
    """System message for the lead"""
    return {
        "role": "system",
        "content": f"You are the lead {LEAD_NAME}. Your role is to be midly intrested in selling a house. TRY TO USE ALL OF THE TOOLS",
    }

def agent_system_message():
    """System message for the agent"""
    return {
        "role": "system",
        "content": "You are the agent in a dual chatbot conversation. Your role is to assist the lead and provide relevant information.",
    }


def stop():
    print("""Tool that ends the conversation""")
    return {"message": "stop"}

stop_tool = {
            "type": "function",
            "function": {
                "name": "stop",
                "description": "Stop the conversation",
                "parameters": {"type": "object", "properties": {}},
            }
        }


def info(role: str):
    print("""Tool that tells the agent its role""")
    if role == 'lead':
        return {"message": "you are the lead"}
    return {"message": "you are the agent"}

info_tool = {
            "type": "function",
            "function": {
                "name": "info",
                "description": "Get the agent role information",
                "parameters": {"type": "object", "properties": {}},
            }
        }


def lead_secret():
    print("""Private tool only visible to the lead""")
    return {"secret": "lead data"}


lead_secret_tool = {
            "type": "function",
            "function": {
                "name": "lead_secret",
                "description": "lead private function",
                "parameters": {"type": "object", "properties": {}},
            }
        }

def agent_secret():
    print("""Private tool only visible to the agent""")
    return {"secret": "agent data"}

agent_secret_tool = {
            "type": "function",
            "function": {
                "name": "agent_secret",
                "description": "agent private function",
                "parameters": {"type": "object", "properties": {}},
            }
        }


def call_openai(params):
    if params['openai']:
        api_key="sk--"
        client = OpenAI(api_key=api_key)
    if params['xai']:
        api_key="xai-"
        client = OpenAI(api_key=api_key,base_url='https://api.x.ai/v1')

    model = params['model']
    messages = params['messages']
    tools = params.get('tools')
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools
        )
        return response.choices[0].message
    except Exception as e:
        print(f"Error in text_to_text: {e}")
        raise e

def agent(role: str, conversation):
    
    if role == "lead":
        model = "gpt-4.1-nano"
        system_msg = lead_system_message()
        xai = False
        openai = True
        tools = [stop_tool, info_tool, lead_secret_tool]
    else:
        model = "gpt-4.1-nano"
        system_msg = agent_system_message()
        xai = False
        openai = True
        tools = [stop_tool, info_tool, agent_secret_tool]

    messages = [system_msg]

    for i in conversation:
        if i["role"] == role:
            if i["content"] != None:
                messages.append({"role": "assistant", "content": i["content"]})
            else:
                messages.append({"role": "assistant", "content": "", "tool_calls": i["tool_calls"]})
        elif i["role"] == "tool":
            if i["call"] == role:
                messages.append({
                    "role": "tool",
                    "tool_call_id": i["tool_call_id"],
                    "content": json.dumps(i["content"]),
                })
        elif i["content"] != None:
            messages.append({"role": "user", "content": i["content"]})
    print("\n\n")
    for msg in messages:
        print(msg)
    print("\n\n")
    params = {
        "model": model,
        "messages": messages,
        "tools": tools,
        "openai": openai,
        "xai": xai
    }

    stop_conversation = False

    while True:
        response_message = call_openai(params)

        if response_message.tool_calls:
            messages.append({
                "role": "assistant",
                "content": response_message.content,
                "tool_calls": [{
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                } for tc in response_message.tool_calls]
            })

            conversation.append({
                "role": role,
                "content": response_message.content,
                "tool_calls": [{
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                } for tc in response_message.tool_calls]
            })

            for call in response_message.tool_calls:
                name = call.function.name
                if name == "stop":
                    tool_msg = stop()
                    stop_conversation = True
                elif name == "info":
                    tool_msg = info(role)
                elif name == "lead_secret" and role == "lead":
                    tool_msg = lead_secret()
                elif name == "agent_secret" and role == "agent":
                    tool_msg = agent_secret()
                else:
                    continue
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": json.dumps(tool_msg),
                    }
                )
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": json.dumps(tool_msg),
                        "call": role,
                    }
                )
        else:
            final_content = response_message.content
            conversation.append(
                {
                    "role": role,
                    "content": final_content,
                }
            )
            break

    return conversation, stop_conversation



def main():
    conversation = [
        {
            "role": "agent",
            "content": f"Olá {LEAD_NAME}, obrigado por dedicar um tempo para preencher a pesquisa de avaliação do imóvel. Para refinar a sua estimativa, gostaria de fazer algumas perguntas rápidas."
        }
    ]
    role_cycle = ["lead", "agent"]

    for i in range(3):
        role = role_cycle[i % 2]

        conversation, stop_conversation = agent(conversation=conversation, role=role)

        print("\n\n")
        for msg in conversation:
            print(msg)
        print("\n\n")
        if stop_conversation:
            break
        

if __name__ == "__main__":
    main()