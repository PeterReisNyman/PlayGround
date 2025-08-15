// conversation.service.ts
import { Injectable, Optional } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const MAX_HISTORY = 30;

const MESSAGES_TABLE = 'messages';
const LEADS_TABLE = 'leads';

@Injectable()
export class ConversationService {
  private readonly client: SupabaseClient<any>;

  constructor(@Optional() client?: SupabaseClient<any>) {
    this.client =
      client ??
      createClient(
        process.env.SUPABASE_URL ?? '',
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      );
  }

  /*---------------  STORE  ----------------*/
  async store(
    phone: string,
    payload: OpenAI.Chat.ChatCompletionMessageParam,
  ): Promise<void> {
    await this.client.from(MESSAGES_TABLE).insert({
      phone,
      message_json: payload,
    });
    const { count } = await this.client
      .from(MESSAGES_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone);
    if ((count ?? 0) > MAX_HISTORY) {
      await this.stop(phone);
    }
  }

  /*---------------  FETCH (latest N)  ----------------*/
  async fetchAll(
    phone: string,
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
    const { data } = await this.client
      .from(MESSAGES_TABLE)
      .select('message_json')
      .eq('phone', phone)
      .order('created_at', { ascending: true });

    return (data ?? [])
      .map((row) => row.message_json as OpenAI.Chat.ChatCompletionMessageParam)
      .filter((m) => m !== null && m !== undefined);
  }

  /*---------------  LENGTH  ----------------*/
  async length(phone: string): Promise<number> {
    const { count } = await this.client
      .from(MESSAGES_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone);
    return count ?? 0;
  }

  /*---------------  STOP FLAG  ----------------*/
  async stop(phone: string): Promise<void> {
    await this.client
      .from(LEADS_TABLE)
      .update({ stop: true })
      .eq('phone', phone);
  }

  async isStopped(phone: string): Promise<boolean> {
    const { data } = await this.client
      .from(LEADS_TABLE)
      .select('stop')
      .eq('phone', phone)
      .limit(1);
    return Boolean(data && data[0] && (data[0] as { stop?: boolean }).stop);
  }
}
