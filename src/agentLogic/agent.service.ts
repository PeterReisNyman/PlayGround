import { Injectable, Logger } from '@nestjs/common';
import { ConversationService } from '../conversation/conversation.service';
import { PromptService } from '../agentHelp/prompt.service';
import { OpenAiService } from '../agentHelp/openai.service';
import { BookingService } from '../booking/booking.service';
import { CalendarService } from '../calendar/calendar.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { MessengerService } from '../messenger/messenger.service';
import { LeadsService } from '../leads/leads.service';
import OpenAI from 'openai';

@Injectable()
export class AgentService {
  private readonly log = new Logger('Agent');
  constructor(
    private readonly conversation: ConversationService,
    private readonly prompt: PromptService,
    private readonly openai: OpenAiService,
    private readonly booking: BookingService,
    private readonly calendar: CalendarService,
    private readonly scheduler: SchedulerService,
    private readonly messenger: MessengerService,
    private readonly leads: LeadsService,
  ) {}

  async send(
    phone: string,
    userMsg: string,
    model = 'grok-4-latest',
  ): Promise<string> {
    if (await this.conversation.isStopped(phone)) {
      this.log.debug(`[conversation] ${phone} stopped – ignoring user message`);
      return '';
    }
    await this.conversation.store(phone, { role: 'user', content: userMsg });
    return this.agentLoop(phone, model);
  }

  private async agentLoop(phone: string, model: string): Promise<string> {
    if (await this.conversation.isStopped(phone)) {
      this.log.debug(`[conversation] ${phone} stopped – aborting agent loop`);
      return '';
    }
    const history = await this.conversation.fetchAll(phone);
    const info = await this.leads.getInfoForAgent(phone);
    const now = new Date().toISOString();
    const system = info
      ? this.prompt.systemMessage(
          info.realtorName,
          info.answers,
          info.leadName,
          info.phone,
          now,
          info.customPrompt ?? undefined,
          info.calendarUse,
        )
      : this.prompt.systemMessage('the realtor', [], '', phone, now);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...history,
    ];

    const reply = await this.openai.chat(
      messages,
      model,
      info ? info.calendarUse : true,
    );
    await this.conversation.store(phone, reply);

    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) {
      if (reply.content) {
        await this.messenger.sendSms(phone, reply.content, false);
      }
      return reply.content ?? '';
    }

    for (const call of calls) {
      const { name } = call.function;
      const argsRaw = call.function.arguments ?? '{}';
      let args: unknown;
      try {
        args = JSON.parse(argsRaw);
      } catch {
        this.log.error(`Error parsing JSON for ${name}: ${argsRaw}`);
        args = {};
      }
      let result: unknown;
      switch (name) {
        case 'search_web':
          if (isSearchArgs(args)) {
            const { query } = args as { query: string };
            result = await this.openai.search(query);
          } else {
            result = { error: 'Missing or invalid { query: string }.' };
          }
          break;
        case 'book_time':
          if (!(await this.leads.hasAddress(phone))) {
            result = { error: 'please set the address before proceding' };
            break;
          }
          if (isBookArgs(args)) {
            const details = await this.leads.getBookingInfo(phone);
            if (!details) {
              result = { error: 'lead not found' };
              break;
            }
            const booking = { ...details, ...args };
            try {
              await this.booking.createOrUpdate(booking);
              await this.conversation.stop(phone);
              result = { status: 'booked' };
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'booking failed';
              result = { error: msg };
            }
          } else {
            result = { error: 'invalid booking args' };
          }
          break;
        case 'list_available_times':
          if (!(await this.leads.hasAddress(phone))) {
            result = { error: 'please set the address before proceding' };
            break;
          }
          if (isAvailArgs(args)) {
            const { date } = args as { date: string };
            const details = await this.leads.getBookingInfo(phone);
            if (!details) {
              result = { error: 'lead not found' };
              break;
            }
            const open = await this.calendar.getOpenSlots(
              details.realtor_id,
              date,
            );
            result = { open: open.open };
          } else {
            result = { error: 'invalid availability args' };
          }
          break;
        case 'set_address':
          if (isAddressArgs(args)) {
            const addrs = Array.isArray(args.addresses)
              ? args.addresses
              : [args as { address: string; neighberhood?: string }];
            await this.leads.setAddress(phone, addrs);
            result = { status: 'ok' };
          } else {
            result = { error: 'invalid address' };
          }
          break;
        case 'book_true':
          console.debug('[AgentService] book_true tool triggered for', phone);
          await this.leads.markBooked(phone);
          await this.conversation.stop(phone);
          const realtorName = info ? info.realtorName : 'o corretor';
          await this.messenger.sendSms(
            phone,
            `${realtorName} entrará em contato em breve.`,
          );
          result = { status: 'booked' };
          break;
        case 'stop_messages':
          await this.scheduler.cancelMessages(phone);
          await this.conversation.stop(phone);
          result = { status: 'stopped' };
          break;
        default:
          result = { error: `Tool ${name} not implemented` };
      }

      const toolMsg: OpenAI.Chat.ChatCompletionMessageParam = {
        role: 'tool',
        tool_call_id: call.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      };
      await this.conversation.store(phone, toolMsg);
    }

    return this.agentLoop(phone, model);
  }
}

function isSearchArgs(args: unknown): args is { query: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'query' in args &&
    typeof (args as { query: unknown }).query === 'string'
  );
}

function isBookArgs(
  args: unknown,
): args is { booked_date: string; booked_time: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'booked_date' in args &&
    'booked_time' in args
  );
}

function isAvailArgs(args: unknown): args is { date: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'date' in args
  );
}

function isAddressArgs(
  args: unknown,
): args is { address: string; neighberhood?: string } | { addresses: { address: string; neighberhood?: string }[] } {
  if (typeof args !== 'object' || args === null) return false;
  if ('addresses' in args) {
    const arr = (args as { addresses: unknown }).addresses;
    return (
      Array.isArray(arr) &&
      arr.every(
        (a) =>
          typeof a === 'object' &&
          a !== null &&
          'address' in a &&
          typeof (a as { address: unknown }).address === 'string',
      )
    );
  }
  return 'address' in args && typeof (args as { address: unknown }).address === 'string';
}

