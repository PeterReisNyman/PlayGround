import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LeadGenService, LeadScoreInput } from './leadgen.service';

@Controller('leadgen')
export class LeadGenController {
  constructor(private readonly svc: LeadGenService) {}

  @Post('score')
  @HttpCode(200)
  score(@Body() body: LeadScoreInput) {
    return this.svc.scoreLead(body);
  }
}

