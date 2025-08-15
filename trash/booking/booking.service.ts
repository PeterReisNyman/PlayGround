import { Injectable } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { MessengerService } from '../messenger/messenger.service';
import { CalendarService } from '../calendar/calendar.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationService } from '../conversation/conversation.service';
import { MetaService } from '../meta/meta.service';
import { DateTime } from 'luxon';
import { normalizePhone } from '../utils/phone';

export interface BookingInput {
  phone: string;
  full_name: string;
  booked_date: string; // YYYY-MM-DD
  booked_time: string; // HH:mm
  time_zone: string;
  realtor_id: string;
}

@Injectable()
export class BookingService {
  private readonly supabase: SupabaseClient<any>;

  constructor(
    private readonly messenger: MessengerService,
    private readonly calendar: CalendarService,
    private readonly leads: LeadsService,
    private readonly conversation: ConversationService,
    private readonly meta: MetaService,
  ) {
    this.supabase = createClient<any>(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  async getExisting(phone: string) {
    const sanitized = normalizePhone(phone);
    const { data } = await this.supabase
      .from('bookings')
      .select('appointment_time')
      .eq('phone', sanitized)
      .maybeSingle();
    if (!data) return null;
    const iso = data.appointment_time as string;
    const dt = DateTime.fromISO(iso);
    return {
      date: dt.toISODate(),
      time: dt.toFormat('HH:mm'),
    };
  }

  async createOrUpdate(input: BookingInput) {
    const phone = normalizePhone(input.phone);
    const existing = await this.getExisting(phone);
    const start = DateTime.fromISO(
      `${input.booked_date}T${input.booked_time}`,
      {
        zone: input.time_zone,
      },
    );
    const now = DateTime.now().setZone(input.time_zone);
    const today = now.toISODate();
    const startDate = start.toISODate();
    if (!startDate || !today) throw new Error('Invalid booking time');
    if (startDate < today)
      throw new Error(
        `today is ${today} day and you are not allowed to book for days that has already passed`,
      );
    const end = start.plus({ minutes: 30 });
    const startIso = start.toISO();
    const endIso = end.toISO();
    if (!startIso || !endIso) throw new Error('Invalid booking time');

    const day = start.toISODate();
    const openings = await this.calendar.getBookedSlots(
      input.realtor_id,
      day ?? input.booked_date,
    );
    if (openings.booked.includes(start.toFormat('HH:mm')))
      throw new Error('Time slot already booked');

    const event = await this.calendar.addEvent(input.realtor_id, {
      summary: `Meeting with ${input.full_name}`,
      description: `Phone: ${phone}\nReport: https://br.myrealvaluation.com/console/reports/${phone}`,
      start: startIso,
      end: endIso,
      calendarId: 'primary',
      phone,
    });

    await this.supabase.from('bookings').upsert({
      phone,
      appointment_time: start.toISO(),
      realtor_id: input.realtor_id,
      google_calendar_id: 'primary',
      google_event_id: event.id,
    });

    await this.leads.markBooked(phone, start.toJSDate());

    const { data: leadInfo } = await this.supabase
      .from('leads')
      .select('email,leadgen_id')
      .eq('phone', phone)
      .maybeSingle();
    const email = (leadInfo as { email?: string } | null)?.email ?? null;
    const leadgenId =
      (leadInfo as { leadgen_id?: string } | null)?.leadgen_id ?? undefined;

    await this.meta.bookingSuccess(email, phone, leadgenId);
    // stop any further conversation after a successful booking
    await this.conversation.stop(phone);

    const formatted = start
      .setLocale('pt-BR')
      .toLocaleString(DateTime.DATETIME_FULL);
    const msg = `Obrigado ${input.full_name}, seu compromisso está confirmado para ${formatted}.`;
    await this.messenger.sendSms(phone, msg);
    return { wasRebooking: !!existing };
  }
}
