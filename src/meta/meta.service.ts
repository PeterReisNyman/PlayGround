import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashUserData } from '../utils/hash';

@Injectable()
export class MetaService {
  private readonly log = new Logger('MetaService');
  private readonly pixelId = process.env.META_PIXEL_ID ?? '';
  private readonly token = process.env.META_ACCESS_TOKEN ?? '';

  private async send(
    eventName: string,
    userData: Record<string, string | undefined>,
    customData: Record<string, unknown> = {},
    testCode?: string,
  ): Promise<void> {
    if (!this.pixelId || !this.token) {
      this.log.warn('META_PIXEL_ID or META_ACCESS_TOKEN not configured');
      return;
    }
    const url = `https://graph.facebook.com/v18.0/${this.pixelId}/events?access_token=${this.token}`;
    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: randomUUID(),
          action_source: 'physical_store',
          user_data: userData,
          custom_data: customData,
        },
      ],
    };
    if (testCode) payload.test_event_code = testCode;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        this.log.warn(`Meta API ${res.status}: ${txt}`);
      }
    } catch (err) {
      this.log.error('Failed to send Meta event', err as Error);
    }
  }

  async leadMessage(phone: string): Promise<void> {
    await this.send('Contact', hashUserData(undefined, phone));
  }

  async leadBooking(phone: string): Promise<void> {
    await this.send('Schedule', hashUserData(undefined, phone));
  }

  async bookingSuccess(
    email: string | null,
    phone: string,
    leadgenId?: string,
    testCode?: string,
  ): Promise<void> {
    const custom: Record<string, unknown> = { value: 1.0, currency: 'USD' };
    const payloadUd = hashUserData(email ?? undefined, phone);
    if (leadgenId) {
      (payloadUd as Record<string, string | undefined>).lead_id = leadgenId;
    }
    await this.send('BookingSuccess', payloadUd, custom, testCode);
  }
}
