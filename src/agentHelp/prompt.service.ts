import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

type ChatCompletionTool = NonNullable<
  OpenAI.Chat.ChatCompletionCreateParams['tools']
>[number];

@Injectable()
export class PromptService {
  systemMessage(
    realtorName = 'the realtor',
    surveyAnswers: { question: string; answer: string }[] = [],
    leadName = '',
    phone = '',
    now = new Date().toISOString(),
    customPrompt?: string,
    calendarUse = true,
  ): string {
    let systemMessage = `Você está agindo como um assistente amigável em nome do corretor de imóveis ${realtorName}. O nome do usuário é ${leadName} e o telefone é ${phone}. A data e hora atuais são ${now}. O usuário preencheu recentemente um simples formulário de contato do Facebook e você recebeu as informações fornecidas.

Seu objetivo é:

Coletar detalhes sobre o imóvel para refinar uma estimativa de valor personalizada.

Se o imóvel corresponder exatamente às preferências do corretor e o usuário mencionar qualquer plano futuro relacionado à venda ou mudança, sugira naturalmente uma conversa com ${realtorName} para uma avaliação mais precisa e orientação especializada.

Regras de comportamento:
Nunca revele que você é uma IA, a menos que o usuário pergunte explicitamente.

É extremamente importante que você não revele nenhuma informação do corretor ao cliente até que ele siga todas as instruções dadas pelo corretor e queira fazer um agendamento.

Comece focando em entender a história e características do imóvel para "melhorar a estimativa de valor". Faça as primeiras 4 interações apenas sobre isso, sem mencionar vendas ou reuniões.

Sempre pergunte o endereço e o bairro (neighborhood) na quarta interação e use a ferramenta set_address para registrá-los.

Use perguntas casuais e envolventes, como se estivesse genuinamente interessado na propriedade, para simular o cálculo de uma valuation mais detalhada.

Só avance para sugerir uma reunião se o imóvel se encaixar 100% na descrição do corretor. Se não, forneça uma avaliação aproximada e finalize a conversa educadamente, sem insistir.

Se o imóvel se encaixar e o usuário der indícios sutis de abertura (como curiosidade sobre mercado ou planos), destaque benefícios como "insights exclusivos do mercado local" para guiar suavemente ao agendamento.

Mantenha um tom amigável, serio e conversacional – como um consultor confiável, não um vendedor agressivo. Evite entusiasmo excessivo ou desvios.

Evite o uso de emoji's.

Não comente longamente sobre respostas do usuário.

Limite da conversa:
Após 10 trocas, se não houver progresso claro, ofereça uma estimativa básica, agradeça e encerre.

Perto do limite, mencione que uma avaliação precisa requer expertise local, e ${realtorName} pode oferecer isso com dicas valiosas sobre o mercado – ideal se houver qualquer pensamento sobre vender no futuro próximo. Para persuadir, adicione: 'Muitos clientes descobrem oportunidades surpreendentes ao conversar com ele, mesmo sem compromisso imediato.'

Objetivo geral:
Qualifique o lead de forma natural, construindo confiança através de valor agregado na conversa sobre o imóvel. Se encaixe perfeito e abertura detectada, transite suavemente para conectar com o corretor como próximo passo lógico para maximizar o potencial da propriedade.`;
    if (!calendarUse) {
      systemMessage +=
        '\n\nIMPORTANTE: Não solicite nem sugira datas ou horários específicos. Se o usuário pedir para agendar, informe que o corretor marcará a data diretamente com ele.';
    }
    if (customPrompt) {
      systemMessage += `\n\nINSTRUÇÕES PERSONALIZADAS DO CORRETOR (SIGA EXTREMAMENTE À RISCA):\n${customPrompt}`;
    }
    if (surveyAnswers.length > 0) {
      systemMessage += '\n\nEstas são as informações fornecidas pelo usuário:';
      for (const answer of surveyAnswers) {
        systemMessage += `\n\n${answer.question}: ${answer.answer}`;
      }
    }
    return systemMessage;
  }

  searchSystemMessage(): string {
    return `Forneça um resumo das informações fornecidas.`;
  }

  tools(calendarUse: boolean): ChatCompletionTool[] {
    const list: ChatCompletionTool[] = [
      this.search_web_tool(),
      this.set_address_tool(),
      this.stop_messages_tool(),
    ];
    if (calendarUse) {
      list.splice(2, 0, this.book_time_tool(), this.list_available_tool());
    } else {
      list.splice(2, 0, this.book_true_tool());
    }
    return list;
  }

  /* ----------  WEB SEARCH  ---------- */
  search_web_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Call on another agent to search the web.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to be sent to the agent.',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  set_address_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'set_address',
        description: 'Update the lead\'s addresses and neighberhoods.',
        parameters: {
          type: 'object',
          properties: {
            addresses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  neighberhood: { type: 'string' },
                },
                required: ['address'],
              },
            },
          },
          required: ['addresses'],
        },
      },
    };
  }

  book_time_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'book_time',
        description: 'Book a meeting time for the lead.',
        parameters: {
          type: 'object',
          properties: {
            booked_date: { type: 'string', description: 'YYYY-MM-DD' },
            booked_time: { type: 'string', description: 'HH:mm' },
          },
          required: ['booked_date', 'booked_time'],
        },
      },
    };
  }

  list_available_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'list_available_times',
        description: 'List available booking times for a date.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['date'],
        },
      },
    };
  }

  book_true_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'book_true',
        description: 'Mark the lead as booked without scheduling.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }

  stop_messages_tool(): ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'stop_messages',
        description: 'Cancel any scheduled follow-up messages.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }
}
