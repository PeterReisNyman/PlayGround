import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { FacebookService } from './facebook.service';

@Controller('webhook/facebook')
export class FacebookController {
  private readonly log = new Logger('FacebookWebhook');

  constructor(private readonly fb: FacebookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      return challenge;
    }
    return 'error';
  }

  @Post()
  async handle(@Body() body: any) {
    this.log.log(`Received payload: ${JSON.stringify(body)}`);
    const leadgenId = body?.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (typeof leadgenId === 'string') {
      await this.fb.handleLead(leadgenId);
    } else {
      this.log.warn('No leadgen_id in payload');
    }
    return { status: 'ok' };
  }
}
