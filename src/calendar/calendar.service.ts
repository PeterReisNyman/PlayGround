import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SchedulerService } from '../scheduler/scheduler.service';

export interface EventInput {
  summary: string;
  description?: string;
  start: string; // ISO string
  end: string; // ISO string
  calendarId: string;
  phone: string; // lead phone number for follow-up texts
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly scheduler: SchedulerService,
  ) {}

  generateAuthUrl(realtorId: string) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI as string,
      response_type: 'code',
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/calendar',
      state: realtorId,
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, realtorId: string) {
    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI as string,
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    await this.supabase.insertCredentials(realtorId, json);
  }

  async hasCredentials(realtorId: string) {
    const creds = await this.supabase.getCredentials(realtorId);
    return { connected: !!creds };
  }

  private async refreshAccessToken(realtorId: string, refreshToken: string) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    await this.supabase.updateCredentials(realtorId, json);
    return json.access_token;
  }

  private async getAccessToken(realtorId: string) {
    const creds = await this.supabase.getCredentials(realtorId);
    if (!creds) throw new Error('No Google credentials');
    if (new Date(creds.token_expires) <= new Date()) {
      return this.refreshAccessToken(realtorId, creds.refresh_token);
    }
    return creds.access_token;
  }

  async addEvent(realtorId: string, input: EventInput) {
    const accessToken = await this.getAccessToken(realtorId);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${input.calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
        }),
      },
    );
    const data = (await res.json()) as { id: string };
    await this.supabase.upsertEvent(
      realtorId,
      data.id,
      input as unknown as Record<string, unknown>,
    );
    await this.scheduler.scheduleFollowUps(input.phone, input.start);
    return data;
  }

  async updateEvent(
    realtorId: string,
    calendarId: string,
    eventId: string,
    update: Partial<Omit<EventInput, 'calendarId' | 'phone'>>,
  ) {
    const accessToken = await this.getAccessToken(realtorId);
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: update.summary,
          description: update.description,
          start: update.start ? { dateTime: update.start } : undefined,
          end: update.end ? { dateTime: update.end } : undefined,
        }),
      },
    );
    await this.supabase.upsertEvent(realtorId, eventId, {
      summary: update.summary,
      description: update.description,
      start: update.start,
      end: update.end,
    });
  }

  async removeEvent(realtorId: string, calendarId: string, eventId: string) {
    const accessToken = await this.getAccessToken(realtorId);
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    await this.supabase.removeEvent(eventId);
  }

  async getBookedSlots(realtorId: string, date: string) {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    const booked = await this.supabase.query(
      `bookings?realtor_id=eq.${realtorId}&appointment_time=gte.${start}&appointment_time=lte.${end}&select=appointment_time`,
    );
    const bookedList = Array.isArray(booked)
      ? (booked as { appointment_time: string }[])
      : [];

    const eventsResult = await this.supabase.query(
      `google_calendar_events?realtor_id=eq.${realtorId}&start_time=lte.${end}&end_time=gte.${start}&select=start_time,end_time`,
    );
    const events = Array.isArray(eventsResult)
      ? (eventsResult as { start_time: string; end_time: string }[])
      : [];

    const times = new Set(
      bookedList.map((b) =>
        new Date(b.appointment_time).toISOString().substring(11, 16),
      ),
    );
    for (const e of events) {
      const s = new Date(e.start_time);
      const en = new Date(e.end_time);
      for (let t = new Date(s); t < en; t.setMinutes(t.getMinutes() + 30)) {
        times.add(t.toISOString().substring(11, 16));
      }
    }

    return { booked: Array.from(times) };
  }

  async getOpenSlots(realtorId: string, date: string) {
    const booked = await this.getBookedSlots(realtorId, date);
    const slots: string[] = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        );
      }
    }
    const open = slots.filter((s) => !booked.booked.includes(s));
    return { open };
  }
}
