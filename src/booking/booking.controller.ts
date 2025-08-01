import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { BookingInput, BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: BookingInput) {
    return this.bookings.createOrUpdate(body);
  }

  @Get('existing')
  async existing(@Query('phone') phone: string) {
    return this.bookings.getExisting(phone);
  }
}
