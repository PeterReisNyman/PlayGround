import { Injectable } from '@nestjs/common';

interface GoogleCredentials {
  realtor_id: string;
  access_token: string;
  refresh_token: string;
  token_expires: string;
}

@Injectable()
export class SupabaseService {
  private readonly baseUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private readonly key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  get headers() {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  async getCredentials(realtorId: string): Promise<GoogleCredentials | null> {
    const res = await fetch(
      `${this.baseUrl}/google_credentials?realtor_id=eq.${realtorId}&select=*`,
      { headers: this.headers },
    );
    const data = (await res.json()) as GoogleCredentials[];
    return data[0] || null;
  }

  async updateCredentials(
    realtorId: string,
    token: { access_token: string; expires_in: number },
  ): Promise<void> {
    const expires = new Date(
      Date.now() + token.expires_in * 1000,
    ).toISOString();
    await fetch(
      `${this.baseUrl}/google_credentials?realtor_id=eq.${realtorId}`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({
          access_token: token.access_token,
          token_expires: expires,
        }),
      },
    );
  }

  async insertCredentials(
    realtorId: string,
    token: { access_token: string; refresh_token: string; expires_in: number },
  ): Promise<void> {
    const expires = new Date(
      Date.now() + token.expires_in * 1000,
    ).toISOString();
    await fetch(`${this.baseUrl}/google_credentials`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        realtor_id: realtorId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires: expires,
      }),
    });
  }

  async upsertEvent(
    realtorId: string,
    googleEventId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await fetch(`${this.baseUrl}/google_calendar_events`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        realtor_id: realtorId,
        google_event_id: googleEventId,
        summary: payload.summary,
        description: payload.description,
        start_time: payload.start,
        end_time: payload.end,
      }),
    });
  }

  async removeEvent(googleEventId: string): Promise<void> {
    await fetch(
      `${this.baseUrl}/google_calendar_events?google_event_id=eq.${googleEventId}`,
      { method: 'DELETE', headers: this.headers },
    );
  }

  async query(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${path}`, {
      headers: this.headers,
    });
    return res.json();
  }
}
