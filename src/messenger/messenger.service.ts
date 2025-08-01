import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConversationService } from '../conversation/conversation.service';

@Injectable()
export class MessengerService {
  private readonly log = new Logger('MessengerService');
  private readonly supabase: SupabaseClient<any>;
  private readonly limit = Number(process.env.MESSAGE_LIMIT ?? '10');

  private optInPtText(name: string): string {
    return `Olá ${name},\nobrigado por fornecer suas informações de contato pelo Facebook. Para ajudar a refinar sua estimativa, gostaria de fazer algumas perguntas rápidas.\n\nVocê poderia me contar um pouco sobre quaisquer atualizações ou melhorias recentes que tenha feito na propriedade? Coisas como reforma da cozinha, telhado novo ou piso atualizado podem influenciar bastante o valor.`;
  }

  private primeiraMensagemText(name: string): string {
    return `Olá ${name}, obrigado por dedicar um tempo para preencher a pesquisa de avaliação do imóvel. Para refinar a sua estimativa, gostaria de fazer algumas perguntas rápidas.`;
  }

  constructor(
    private readonly conversation: ConversationService,
    private readonly whatsapp: WhatsAppService,
  ) {
    this.supabase = createClient<any>(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  async countSent(phone: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('message_logs')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('status', 'sent');
    if (error) {
      this.log.error('Failed to count messages', error as Error);
      return 0;
    }
    return count ?? 0;
  }

  async sendSms(
    phone: string,
    text: string,
    storeMessage = true,
  ): Promise<void> {
    try {
      const sentCount = await this.countSent(phone);
      if (sentCount >= this.limit) {
        this.log.warn(`Message limit reached for ${phone}`);
        if (storeMessage) {
          await this.conversation.store(phone, {
            role: 'assistant',
            content: text,
          });
        }
        return;
      }

      await this.whatsapp.sendMessage(phone, text);
      this.log.log(`Sent SMS to ${phone}`);
      await this.supabase.from('message_logs').insert({
        phone,
        message_type: 'text',
        message_text: text,
        status: 'sent',
      });
      if (storeMessage) {
        await this.conversation.store(phone, {
          role: 'assistant',
          content: text,
        });
      }
    } catch (err) {
      this.log.error('Failed to send message', err as Error);
      await this.supabase.from('message_logs').insert({
        phone,
        message_type: 'text',
        message_text: text,
        status: 'failed',
      });
      if (storeMessage) {
        await this.conversation.store(phone, {
          role: 'assistant',
          content: text,
        });
      }
      throw err;
    }
  }

  async sendTemplate(
    phone: string,
    name: string,
    language: string,
    components?: unknown[],
    storeMessage = true,
  ): Promise<void> {
    try {
      await this.whatsapp.sendTemplate(phone, name, language, components);
      this.log.log(`Sent template ${name} to ${phone}`);
      await this.supabase.from('message_logs').insert({
        phone,
        message_type: 'template',
        message_text: JSON.stringify({ name, language, components }),
        status: 'sent',
      });
      if (storeMessage) {
        let content = `[template:${name}]`;
        if (name === 'opt_in_pt' || name === 'primeira_mensagem') {
          let userName = '{{name}}';
          if (Array.isArray(components)) {
            const targetType = name === 'opt_in_pt' ? 'HEADER' : 'BODY';
            const part = components.find(
              (c: any) => c && c.type === targetType,
            ) as any;
            if (part && Array.isArray(part.parameters)) {
              const param = part.parameters.find(
                (p: any) => p && p.type === 'TEXT' && typeof p.text === 'string',
              ) as any;
              if (param) userName = param.text;
            }
          }
          content =
            name === 'opt_in_pt'
              ? this.optInPtText(userName)
              : this.primeiraMensagemText(userName);
        }
        await this.conversation.store(phone, {
          role: 'assistant',
          content,
        });
      }
    } catch (err) {
      this.log.error('Failed to send template', err as Error);
      await this.supabase.from('message_logs').insert({
        phone,
        message_type: 'template',
        message_text: JSON.stringify({ name, language, components }),
        status: 'failed',
      });
      if (storeMessage) {
        let content = `[template:${name}]`;
        if (name === 'opt_in_pt' || name === 'primeira_mensagem') {
          let userName = '{{name}}';
          if (Array.isArray(components)) {
            const targetType = name === 'opt_in_pt' ? 'HEADER' : 'BODY';
            const part = components.find(
              (c: any) => c && c.type === targetType,
            ) as any;
            if (part && Array.isArray(part.parameters)) {
              const param = part.parameters.find(
                (p: any) => p && p.type === 'TEXT' && typeof p.text === 'string',
              ) as any;
              if (param) userName = param.text;
            }
          }
          content =
            name === 'opt_in_pt'
              ? this.optInPtText(userName)
              : this.primeiraMensagemText(userName);
        }
        await this.conversation.store(phone, {
          role: 'assistant',
          content,
        });
      }
      throw err;
    }
  }
}
