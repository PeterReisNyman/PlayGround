import { Body, Controller, HttpCode, Post, Patch } from '@nestjs/common';
import { RealtorService } from './realtor.service';
import { CreateRealtorDto } from './dto/create-realtor.dto';

@Controller('realtor')
export class RealtorController {
  constructor(private readonly realtors: RealtorService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateRealtorDto) {
    return this.realtors.createRealtor(body);
  }

  @Patch('sent-email')
  async updateEmail(
    @Body('realtorId') realtorId: string,
    @Body('sentToEmail') sentToEmail: string | null,
  ) {
    await this.realtors.updateSentToEmail(realtorId, sentToEmail ?? null);
    return { realtor_id: realtorId };
  }
}
