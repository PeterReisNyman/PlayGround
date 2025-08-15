import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { AgentService } from '../agentLogic/agent.service';
import { LeadsService } from '../leads/leads.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { MessengerService } from '../messenger/messenger.service';
import { ConversationService } from '../conversation/conversation.service';
import { WhatsAppService } from './whatsapp.service';
import { MetaService } from '../meta/meta.service';

@Controller('webhook')
export class WhatsAppController {
  private readonly log = new Logger('WhatsAppWebhook');

  constructor(
    private readonly agent: AgentService,
    private readonly leads: LeadsService,
    private readonly scheduler: SchedulerService,
    private readonly messenger: MessengerService,
    private readonly whatsapp: WhatsAppService,
    private readonly conversation: ConversationService,
    private readonly meta: MetaService,
  ) {}

  @Get('whatsapp')
  verify(@Query('hub.mode') mode: string, @Query('hub.challenge') challenge: string, @Query('hub.verify_token') token: string) {
    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN ) {
      return challenge;
    }
    return 'error';
  }

  @Post('whatsapp')
  async handleWebhook(@Body() body: any) {
    this.log.log(`Received Meta webhook: ${JSON.stringify(body)}`);
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body;
    if (typeof from === 'string' && typeof text === 'string') {
      const phone = from;
      const trimmed = text.trim().toUpperCase();
      if (trimmed === 'STOP') {
        await this.scheduler.cancelMessages(phone);
        await this.conversation.stop(phone);
        return { status: 'stopped' };
      }
      const sentCount = await this.messenger.countSent(phone);
      if (sentCount >= 10) {
        this.log.warn(`Message limit reached for ${phone}`);
        return { status: 'limit-reached' };
      }
      await this.leads.markHotIfCold(phone);
      await this.meta.leadMessage(phone);
      await this.agent.send(phone, text);
    } else {
      this.log.warn('Invalid webhook payload');
    }
    return { status: 'ok' };
  }
}
