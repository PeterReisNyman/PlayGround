import { Controller, Get, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':phone')
  async get(@Param('phone') phone: string) {
    return this.reports.getReport(phone);
  }
}
