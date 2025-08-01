import { Controller, Get, Param } from '@nestjs/common';
import { ConversationService, MAX_HISTORY } from './conversation.service';

@Controller('conversation')
export class ConversationController {
  //TODO: add validation
  constructor(private readonly conversation: ConversationService) {}
  @Get(':phone')
  async getAll(@Param('phone') phone: string) {
    const history = await this.conversation.fetchAll(phone);
    if (history.length > MAX_HISTORY) {
      await this.conversation.stop(phone);
    }
    return history;
  }
}
