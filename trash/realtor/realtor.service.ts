import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateRealtorDto } from './dto/create-realtor.dto';
import { normalizePhone } from '../utils/phone';

@Injectable()
export class RealtorService {
  private readonly client: SupabaseClient<any>;

  constructor() {
    const url = process.env.SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.client = createClient(url, key);
  }

  async createRealtor(input: CreateRealtorDto) {
    const [first, ...rest] = input.name.trim().split(' ');
    const last = rest.join(' ');
    const phone = normalizePhone(input.phone);
    const { error } = await this.client.from('realtor').insert({
      realtor_id: input.userId,
      phone,
      f_name: first,
      e_name: last,
      website_url: input.websiteUrl ?? null,
      sent_to_email: input.sentToEmail ?? null,
      video_url: input.videoUrl ?? null,
      calendar_use: input.calendarUse !== false,
    });
    if (error) throw error;
    return { realtor_id: input.userId };
  }

  async updateSentToEmail(realtorId: string, email: string | null) {
    const { error } = await this.client
      .from('realtor')
      .update({ sent_to_email: email })
      .eq('realtor_id', realtorId);
    if (error) throw error;
  }
}
