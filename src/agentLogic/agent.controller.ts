import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('message')
export class AgentController {
  constructor(private readonly messageService: AgentService) {}

  @Post()
  @HttpCode(200)
  async send(@Body('phone') phone: string, @Body('message') message: string) {
    const assistant = await this.messageService.send(
      phone,
      message,
      'gpt-4o-mini',
    );
    return { assistant };
  }
}
