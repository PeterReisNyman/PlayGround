import { Injectable } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';
import { ConversationService } from '../conversation/conversation.service';
import { OpenAiService } from '../agentHelp/openai.service';
import { supabase } from '../lib/supabase';

@Injectable()
export class ReportsService {
  constructor(
    private readonly leads: LeadsService,
    private readonly conversation: ConversationService,
    private readonly openai: OpenAiService,
  ) {}

  async getReport(phone: string) {
    const lead = await this.leads.getLeadReport(phone);
    if (!lead) return null;

    const surveySummary = await this.getSurveySummary(phone, lead.answers);
    const messageSummary = await this.getMessageSummary(phone);

    await this.leads.updateSummaries(phone, surveySummary, messageSummary);

    return {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      addresses: lead.addresses,
      lead_state: lead.lead_state,
      surveySummary,
      messageSummary,
    };
  }

  private async getSurveySummary(
    phone: string,
    answers: { question: string; answer: string }[],
  ): Promise<string> {
    const { data } = await supabase
      .from('leads')
      .select('survey_summary')
      .eq('phone', phone)
      .maybeSingle();
    const existing = (data as { survey_summary?: string } | null)
      ?.survey_summary;
    if (existing) return existing;

    if (answers.length === 0) return '';
    const content =
      'Summarize these survey answers:\n' +
      answers.map((a) => `${a.question}: ${a.answer}`).join('\n');
    try {
      const reply = await this.openai.chat(
        [{ role: 'user', content }],
        'gpt-4.1-nano',
        false,
      );
      const summary = reply.content ?? '';
      await this.leads.updateSummaries(phone, summary);
      return summary;
    } catch (err) {
      console.error('[ReportsService] survey summary failed', err);
      return '';
    }
  }

  private async getMessageSummary(
    phone: string,
  ): Promise<{ number: number; content: string }> {
    const currentLen = await this.conversation.length(phone);
    const { data } = await supabase
      .from('leads')
      .select('message_summary')
      .eq('phone', phone)
      .maybeSingle();
    const existing = (
      data as { message_summary?: { number: number; content: string } } | null
    )?.message_summary;
    if (existing && existing.number === currentLen) return existing;

    const history = await this.conversation.fetchAll(phone);
    if (history.length === 0) return { number: currentLen, content: '' };
    const text = history
      .map((m) => {
        const c =
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `${m.role}: ${c}`;
      })
      .join('\n')
      .slice(-12000);
    try {
    const reply = await this.openai.chat(
        [
          {
            role: 'user',
            content: `Resuma os pontos principais desta conversa. Faça o resumo em formato de tópicos. Inclua a metragem e todas as especificações obtidas:\n${text}`,
          },
        ],
        'gpt-4.1-mini',
        false,
      );
      const summary = reply.content ?? '';
      const result = { number: currentLen, content: summary };
      await this.leads.updateSummaries(phone, undefined, result);
      return result;
    } catch (err) {
      console.error('[ReportsService] message summary failed', err);
      return { number: currentLen, content: '' };
    }
  }
}
