import json
import os
from datetime import datetime
from typing import Any, Dict, List

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

LEAD_NAME = "Katia Alonso"
REALTOR_NAME = "João Silva"
LEAD_PHONE = "5511912345678"

# ----- System Messages -----

def lead_system_message() -> Dict[str, str]:
    """Return the system message used for the lead."""
    return {
        "role": "system",
        "content": (
            f"You are the lead {LEAD_NAME}. Your role is to be mildly interested in selling a house. "
            "TRY TO USE ALL OF THE TOOLS"
        ),
    }


def agent_system_message(
    realtor_name: str = REALTOR_NAME,
    lead_name: str = LEAD_NAME,
    phone: str = LEAD_PHONE,
    calendar_use: bool = True,
) -> Dict[str, str]:
    """Return the system message used for the agent."""
    now = datetime.utcnow().isoformat()
    system_message = "USE ALL OF THE TOOLS SPERATICLY\n\n"
    system_message += f"Você está agindo como um assistente amigável em nome do corretor de imóveis {realtor_name}. "
    system_message += f"O nome do usuário é {lead_name} e o telefone é {phone}. A data e hora atuais são {now}. "
    system_message += (
        "O usuário preencheu recentemente um simples formulário de contato do Facebook e você recebeu as informações fornecidas.\n\n"
        "Seu objetivo é:\n\nColetar detalhes sobre o imóvel para refinar uma estimativa de valor personalizada.\n\n"
        "Se o imóvel corresponder exatamente às preferências do corretor e o usuário mencionar qualquer plano futuro relacionado à venda ou mudança, "
        f"sugira naturalmente uma conversa com {realtor_name} para uma avaliação mais precisa e orientação especializada.\n\n"
        "Regras de comportamento:\nNunca revele que você é uma IA, a menos que o usuário pergunte explicitamente.\n\n"
        "É extremamente importante que você não revele nenhuma informação do corretor ao cliente até que ele siga todas as instruções dadas pelo corretor e queira fazer um agendamento.\n\n"
        "Comece focando em entender a história e características do imóvel para \"melhorar a estimativa de valor\". "
        "Faça as primeiras 4 interações apenas sobre isso, sem mencionar vendas ou reuniões.\n\n"
        "Sempre pergunte o endereço e o bairro (neighborhood) na quarta interação e use a ferramenta set_address para registrá-los.\n\n"
        "Use perguntas casuais e envolventes, como se estivesse genuinamente interessado na propriedade, para simular o cálculo de uma valuation mais detalhada.\n\n"
        "Só avance para sugerir uma reunião se o imóvel se encaixar 100% na descrição do corretor. Se não, forneça uma avaliação aproximada e finalize a conversa educadamente, sem insistir.\n\n"
        "Se o imóvel se encaixar e o usuário der indícios sutis de abertura (como curiosidade sobre mercado ou planos), destaque benefícios como \"insights exclusivos do mercado local\" para guiar suavemente ao agendamento.\n\n"
        "Mantenha um tom amigável, serio e conversacional – como um consultor confiável, não um vendedor agressivo. Evite entusiasmo excessivo ou desvios.\n\n"
        "Evite o uso de emoji's.\n\nNão comente longamente sobre respostas do usuário.\n\n"
        "Limite da conversa:\nApós 10 trocas, se não houver progresso claro, ofereça uma estimativa básica, agradeça e encerre.\n\n"
        f"Perto do limite, mencione que uma avaliação precisa requer expertise local, e {realtor_name} pode oferecer isso com dicas valiosas sobre o mercado – "
        "ideal se houver qualquer pensamento sobre vender no futuro próximo. Para persuadir, adicione: 'Muitos clientes descobrem oportunidades surpreendentes ao conversar com ele, mesmo sem compromisso imediato.'\n\n"
        "Objetivo geral:\nQualifique o lead de forma natural, construindo confiança através de valor agregado na conversa sobre o imóvel. "
        "Se encaixe perfeito e abertura detectada, transite suavemente para conectar com o corretor como próximo passo lógico para maximizar o potencial da propriedade."
    )
    if not calendar_use:
        system_message += (
            "\n\nIMPORTANTE: Não solicite nem sugira datas ou horários específicos. "
            "Se o usuário pedir para agendar, informe que o corretor marcará a data diretamente com ele."
        )
    return {"role": "system", "content": system_message}


# ----- Tool Implementations -----

def search_web(query: str) -> Dict[str, str]:
    print(f"Searching the web for '{query}'")
    # Placeholder implementation
    return {"result": f"Results for '{query}'"}


def set_address(addresses: List[Dict[str, str]]) -> Dict[str, str]:
    print("Setting address", addresses)
    return {"status": "ok"}


def book_time(booked_date: str, booked_time: str) -> Dict[str, str]:
    print(f"Booking time {booked_date} {booked_time}")
    return {"status": "booked", "booked_date": booked_date, "booked_time": booked_time}


def list_available_times(date: str) -> Dict[str, Any]:
    print(f"Listing available times for {date}")
    return {"open": ["09:00", "10:00", "11:00"]}


def book_true() -> Dict[str, str]:
    print("Marking lead as booked")
    return {"status": "booked"}


def stop_messages() -> Dict[str, str]:
    print("Stopping future messages")
    return {"status": "stopped"}


def stop() -> Dict[str, str]:
    print("Stopping conversation")
    return {"message": "stop"}


# ----- Tool Definitions -----

def tool(fn_name: str, description: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    return {"type": "function", "function": {"name": fn_name, "description": description, "parameters": parameters}}


SEARCH_WEB_TOOL = tool(
    "search_web",
    "Call on another agent to search the web.",
    {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "The search query to be sent to the agent."},
        },
        "required": ["query"],
    },
)

SET_ADDRESS_TOOL = tool(
    "set_address",
    "Update the lead's addresses and neighberhoods.",
    {
        "type": "object",
        "properties": {
            "addresses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "address": {"type": "string"},
                        "neighberhood": {"type": "string"},
                    },
                    "required": ["address"],
                },
            }
        },
        "required": ["addresses"],
    },
)

BOOK_TIME_TOOL = tool(
    "book_time",
    "Book a meeting time for the lead.",
    {
        "type": "object",
        "properties": {
            "booked_date": {"type": "string", "description": "YYYY-MM-DD"},
            "booked_time": {"type": "string", "description": "HH:mm"},
        },
        "required": ["booked_date", "booked_time"],
    },
)

LIST_AVAILABLE_TOOL = tool(
    "list_available_times",
    "List available booking times for a date.",
    {
        "type": "object",
        "properties": {
            "date": {"type": "string", "description": "YYYY-MM-DD"},
        },
        "required": ["date"],
    },
)

BOOK_TRUE_TOOL = tool(
    "book_true",
    "Mark the lead as booked without scheduling.",
    {"type": "object", "properties": {}, "required": []},
)

STOP_MESSAGES_TOOL = tool(
    "stop_messages",
    "Cancel any scheduled follow-up messages.",
    {"type": "object", "properties": {}, "required": []},
)

STOP_TOOL = tool(
    "stop",
    "Stop the conversation",
    {"type": "object", "properties": {}, "required": []},
)

TOOLS = [
    SEARCH_WEB_TOOL,
    SET_ADDRESS_TOOL,
    BOOK_TIME_TOOL,
    LIST_AVAILABLE_TOOL,
    BOOK_TRUE_TOOL,
    STOP_MESSAGES_TOOL,
    STOP_TOOL,
]

# Map tool names to functions
TOOL_FUNCS = {
    "search_web": lambda args: search_web(args.get("query", "")),
    "set_address": lambda args: set_address(args.get("addresses", [])),
    "book_time": lambda args: book_time(args.get("booked_date", ""), args.get("booked_time", "")),
    "list_available_times": lambda args: list_available_times(args.get("date", "")),
    "book_true": lambda args: book_true(),
    "stop_messages": lambda args: stop_messages(),
    "stop": lambda args: stop(),
}


# ----- OpenAI Helper -----

def call_openai(model: str, messages: List[Dict[str, Any]], tools: List[Dict[str, Any]], use_xai: bool = False) -> Any:
    """Send a chat completion request."""
    if use_xai:
        api_key = os.getenv("XAI_API_KEY")
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
    else:
        api_key = os.getenv("OPENAI_API_KEY")
        client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(model=model, messages=messages, tools=tools)
    return response.choices[0].message


# ----- Agent Loop -----

def agent(role: str, conversation: List[Dict[str, Any]]) -> (List[Dict[str, Any]], bool):
    if role == "lead":
        model = "gpt-4.1-nano"
        system_msg = lead_system_message()
        tools = []
        use_xai = False
    else:
        model = "gpt-4.1-nano"
        system_msg = agent_system_message()
        tools = TOOLS
        use_xai = False

    messages: List[Dict[str, Any]] = [system_msg]

    for item in conversation:
        if item["role"] == role:
            if item.get("content") is not None:
                messages.append({"role": "assistant", "content": item["content"]})
            else:
                messages.append({"role": "assistant", "content": "", "tool_calls": item["tool_calls"]})
        elif item["role"] == "tool" and item.get("call") == role:
            messages.append({
                "role": "tool",
                "tool_call_id": item["tool_call_id"],
                "content": json.dumps(item["content"]),
            })
        elif item.get("content") is not None:
            messages.append({"role": "user", "content": item["content"]})

    stop_conversation = False

    while True:
        response_message = call_openai(model, messages, tools, use_xai)

        if response_message.tool_calls:
            messages.append({
                "role": "assistant",
                "content": response_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in response_message.tool_calls
                ],
            })

            conversation.append({
                "role": role,
                "content": response_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in response_message.tool_calls
                ],
            })

            for call in response_message.tool_calls:
                name = call.function.name
                args = json.loads(call.function.arguments or "{}")
                func = TOOL_FUNCS.get(name)
                if func:
                    result = func(args)
                    if name == "stop":
                        stop_conversation = True
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": json.dumps(result),
                        }
                    )
                    conversation.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": json.dumps(result),
                            "call": role,
                        }
                    )
        else:
            conversation.append({"role": role, "content": response_message.content})
            break

    return conversation, stop_conversation


# ----- Example Usage -----

def main() -> None:
    conversation: List[Dict[str, Any]] = [
        {
            "role": "agent",
            "content": (
                f"Olá {LEAD_NAME}, obrigado por dedicar um tempo para preencher a pesquisa de avaliação do imóvel. "
                "Para refinar a sua estimativa, gostaria de fazer algumas perguntas rápidas."
            ),
        }
    ]
    role_cycle = ["lead", "agent"]

    for i in range(8):
        role = role_cycle[i % 2]
        conversation, stop_conversation = agent(role=role, conversation=conversation)
        for msg in conversation:
            print(msg)
        if stop_conversation:
            break

    return conversation


if __name__ == "__main__":
    conversation = main()

    print("\n--- Conversation Ended ---\n")
    print("Final Conversation:")
    for msg in conversation:
        print(msg)