import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('survey-load')
  @HttpCode(204)
  async surveyLoad(@Body('uuid') uuid: string) {
    if (!uuid) return;
    await this.metrics.logSurveyLoad(uuid);
  }

  @Post('survey-answer')
  @HttpCode(204)
  async surveyAnswer(
    @Body('uuid') uuid: string,
    @Body('question') question: string,
    @Body('answer') answer: string,
  ) {
    if (!uuid || !question || answer === undefined) return;
    await this.metrics.logSurveyAnswer(uuid, question, answer);
  }
}
