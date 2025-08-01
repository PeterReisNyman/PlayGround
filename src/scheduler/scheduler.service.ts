import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { MessengerService } from '../messenger/messenger.service';
import { normalizePhone } from '../utils/phone';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly client: SupabaseClient<any>;
  private interval?: NodeJS.Timeout;
  private readonly log = new Logger('SchedulerService');

  private isRow(row: unknown): row is {
    id: number;
    phone: string;
    message_text?: string | null;
    message_type?: string | null;
  } {
    return (
      typeof row === 'object' && row !== null && 'id' in row && 'phone' in row
    );
  }

  constructor(private readonly messenger: MessengerService) {
    const url = process.env.SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.client = createClient(url, key);
  }

  async scheduleMessage(
    phone: string,
    time: string,
    content: string,
  ): Promise<void> {
    const sanitized = normalizePhone(phone);
    this.log.log(
      `scheduleMessage called: phone=${sanitized}, time=${time}, content=${content}`,
    );

    try {
      const { data: lead, error } = await this.client
        .from('leads')
        .select('realtor_id')
        .eq('phone', sanitized)
        .maybeSingle();

      if (error) {
        this.log.error('Failed to fetch realtor_id', error as Error);
        throw error;
      }
      const realtorId = (lead as { realtor_id: string } | null)?.realtor_id;
      if (!realtorId) {
        this.log.warn(`No realtor_id found for phone ${sanitized}`);
        throw new Error('Invalid phone number');
      }

      await this.client.from('scheduled_messages').insert({
        phone: sanitized,
        realtor_id: realtorId,
        scheduled_time: time,
        message_type: 'text',
        message_text: content,
        message_status: 'pending',
      });
      this.log.log(`Message scheduled for ${sanitized} at ${time}`);
    } catch (err) {
      this.log.error('scheduleMessage failed', err as Error);
      throw err;
    }
  }

  async scheduleTemplate(
    phone: string,
    time: string,
    name: string,
    language: string,
    components?: unknown[],
  ): Promise<void> {
    const sanitized = normalizePhone(phone);
    try {
      const { data: lead, error } = await this.client
        .from('leads')
        .select('realtor_id')
        .eq('phone', sanitized)
        .maybeSingle();
      if (error) {
        this.log.error('Failed to fetch realtor_id', error as Error);
        throw error;
      }
      const realtorId = (lead as { realtor_id: string } | null)?.realtor_id;
      if (!realtorId) throw new Error('Invalid phone number');
      await this.client.from('scheduled_messages').insert({
        phone: sanitized,
        realtor_id: realtorId,
        scheduled_time: time,
        message_type: 'template',
        message_text: JSON.stringify({ name, language, components }),
        message_status: 'pending',
      });
      this.log.log(`Template scheduled for ${sanitized} at ${time}`);
    } catch (err) {
      this.log.error('scheduleTemplate failed', err as Error);
      throw err;
    }
  }

  async scheduleFollowUps(phone: string, appointment: string): Promise<void> {
    const sanitized = normalizePhone(phone);
    const eventTime = new Date(appointment);
    const offsets = [
      {
        ms: -24 * 60 * 60 * 1000,
        text: 'Reminder: your appointment is tomorrow.',
      },
      { ms: -60 * 60 * 1000, text: 'Reminder: your appointment is in 1 hour.' },
    ];
    await this.scheduleMessage(
      sanitized,
      new Date().toISOString(),
      `Thanks for booking! Your appointment is on ${eventTime.toISOString()}.`,
    );
    for (const o of offsets) {
      const when = new Date(eventTime.getTime() + o.ms).toISOString();
      await this.scheduleMessage(sanitized, when, o.text);
    }
  }

  async cancelMessages(phone: string): Promise<void> {
    const sanitized = normalizePhone(phone);
    await this.client
      .from('scheduled_messages')
      .update({ message_status: 'canceled' })
      .eq('phone', sanitized)
      .eq('message_status', 'pending');
  }

  async processDueMessages(): Promise<void> {
    const now = new Date().toISOString();
    this.log.log(`Checking for due messages at ${now}`);
    const { data, error } = await this.client
      .from('scheduled_messages')
      .select('*')
      .eq('message_status', 'pending')
      .lte('scheduled_time', now);

    if (error) {
      this.log.error('Fetch error', error as Error);
      return;
    }

    this.log.log(`Found ${data?.length ?? 0} pending messages`);

    for (const raw of data ?? []) {
      if (!this.isRow(raw)) {
        this.log.warn('Skipping malformed row');
        continue;
      }
      await this.processMessage(raw);
    }
  }

  private async processMessage(row: {
    id: number;
    phone: string;
    message_text?: string | null;
    message_type?: string | null;
  }): Promise<void> {
    try {
      if (row.message_type === 'template' && row.message_text) {
        const t = JSON.parse(row.message_text);
        await this.messenger.sendTemplate(
          row.phone,
          t.name,
          t.language,
          t.components,
        );
      } else {
        await this.messenger.sendSms(row.phone, row.message_text ?? '');
      }
      await this.client
        .from('scheduled_messages')
        .update({ message_status: 'sent' })
        .eq('id', row.id);
      this.log.log(`Sent message ${row.id} to ${row.phone}`);
    } catch (err) {
      this.log.error(`Send failed for ${row.id}`, err as Error);
      await this.client
        .from('scheduled_messages')
        .update({ message_status: 'failed' })
        .eq('id', row.id);
    }
  }

  onModuleInit(): void {
    const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? '60000');
    this.log.log(`Starting scheduler cron every ${intervalMs}ms`);
    this.interval = setInterval(() => {
      void this.processDueMessages();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
