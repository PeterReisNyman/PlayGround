import { Injectable, Logger } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { normalizeDigits } from '../utils/phone';

interface LeadField {
  name: string;
  values: string[];
}

interface GraphLead {
  id: string;
  ad_id?: string;
  form_id?: string;
  created_time?: string;
  field_data?: LeadField[];
}

@Injectable()
export class FacebookService {
  private readonly log = new Logger('FacebookService');

  private readonly pageToken = process.env.FB_PAGE_TOKEN ?? '';
  /**
   * TEMPORARY - DELETE WHEN IN PRODUCTION
   * When SIMULATE_FB_LEAD is set to 'true' this service will bypass the
   * Facebook Graph API and return a mock lead. This allows testing from a
   * non‑Facebook environment.
   */
  private readonly simulate = true;

  constructor(
    private readonly leads: LeadsService,
    private readonly scheduler: SchedulerService,
  ) {}

  async fetchLead(leadgenId: string): Promise<GraphLead | null> {
    if (this.simulate) {
      this.log.warn(
        'SIMULATE_FB_LEAD enabled - returning mock lead (TEMPORARY, delete when in production)',
      );
      return {
        id: '621450080583391',
        ad_id: '946169819633595',
        form_id: '722447930614660',
        created_time: new Date().toISOString(),
        field_data: [
          { name: 'nome_completo', values: ['Peter Nyman'] },
          { name: 'telefone', values: ['+5511998966766'] },
          { name: 'email', values: ['pretend@example.com'] },
          { name: 'budget', values: ['under_100k'] },
        ],
      };
    }
    if (!this.pageToken) {
      this.log.warn('FB_PAGE_TOKEN not set');
      return null;
    }
    const url = `https://graph.facebook.com/v23.0/${leadgenId}?access_token=${this.pageToken}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        this.log.error(`Graph API error ${res.status}: ${txt}`);
        return null;
      }
      const data = (await res.json()) as GraphLead;
      return data;
    } catch (err) {
      this.log.error('Graph API request failed', err as Error);
      return null;
    }
  }

  private extractField(
    fields: LeadField[] | undefined,
    name: string,
  ): string | undefined {
    const field = fields?.find((f) => f.name === name);
    if (!field || !Array.isArray(field.values)) return undefined;
    return field.values[0];
  }

  async handleLead(leadgenId: string): Promise<void> {
    const data = await this.fetchLead(leadgenId);
    if (!data) return;
    const fullName =
      this.extractField(data.field_data, 'nome_completo') ??
      this.extractField(data.field_data, 'full_name') ??
      '';
    const email = this.extractField(data.field_data, 'email');
    const phone =
      this.extractField(data.field_data, 'telefone') ??
      this.extractField(data.field_data, 'phone_number');
    if (!phone) {
      this.log.warn('Missing phone number in lead');
      return;
    }

    const realtorId = process.env.DEFAULT_REALTOR_ID ?? '';

    await this.leads.createLead({
      name: fullName,
      phone,
      email: email ?? '',
      adId: normalizeDigits(data.ad_id),
      formId: normalizeDigits(data.form_id),
      leadgenId: normalizeDigits(data.id),
    });

    // Schedule initial WhatsApp message
    const time = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await this.scheduler.scheduleTemplate(
      phone,
      time,
      'primeira_mensagem',
      'pt_BR',
      [
        {
          type: 'BODY',
          parameters: [
            { type: 'TEXT', parameter_name: 'customer_name', text: fullName },
          ],
        },
      ],
    );
  }
}
