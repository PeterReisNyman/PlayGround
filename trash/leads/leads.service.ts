import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../utils/phone';
import { DateTime } from 'luxon';

export interface AddressInput {
  address: string;
  neighberhood?: string;
}

interface LeadInput {
  name: string;
  phone: string;
  email: string;
  adId?: string;
  formId?: string;
  leadgenId?: string;
  addresses?: AddressInput[];
  surveyAnswers?: Record<string, unknown>;
}

@Injectable()
export class LeadsService {
  private readonly uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(private readonly email: EmailService) {}

  async listLeads(states: string[]): Promise<
    {
      phone: string;
      first_name: string;
      last_name: string;
      addresses: AddressInput[] | null;
      lead_state: string;
    }[]
  > {
    const { data, error } = await supabase
      .from('leads')
      .select('phone,first_name,last_name,addresses,lead_state')
      .in('lead_state', states);
    if (error) {
      console.error('[LeadsService] failed to list leads', error);
      throw error;
    }
    return (
      (data as {
        phone: string;
        first_name: string;
        last_name: string;
        addresses: AddressInput[] | null;
        lead_state: string;
      }[]) || []
    );
  }

  async markHotIfCold(phone: string): Promise<void> {
    const sanitized = normalizePhone(phone);
    const { data, error } = await supabase
      .from('leads')
      .select('lead_state')
      .eq('phone', sanitized)
      .maybeSingle();
    if (error) {
      console.error('[LeadsService] failed to fetch lead state', error);
      return;
    }
    const lead = data as { lead_state?: string } | null;
    if (!lead) return;
    if (lead.lead_state === 'cold') {
      const { error: updErr } = await supabase
        .from('leads')
        .update({ lead_state: 'hot' })
        .eq('phone', sanitized);
      if (updErr) {
        console.error('[LeadsService] failed to update lead state', updErr);
      }
    }
  }

  async markBooked(phone: string, appointment?: Date): Promise<void> {
    console.debug('[LeadsService] markBooked called', { phone, appointment });
    const sanitized = normalizePhone(phone);
    const { error } = await supabase
      .from('leads')
      .update({ lead_state: 'booked' })
      .eq('phone', sanitized);
    if (error) {
      console.error('[LeadsService] failed to mark booked', error);
      return;
    }

    try {
      const { data } = await supabase
        .from('leads')
        .select('first_name,last_name,addresses,realtor_id')
        .eq('phone', sanitized)
        .maybeSingle();
      const lead = data as {
        first_name?: string;
        last_name?: string;
        addresses?: AddressInput[];
        realtor_id: string;
      } | null;
      if (!lead) {
        console.warn('[LeadsService] no lead found for', sanitized);
        return;
      }

      const { data: realtorData } = await supabase
        .from('realtor')
        .select('sent_to_email')
        .eq('realtor_id', lead.realtor_id)
        .maybeSingle();

      let realtorEmail =
        (realtorData as { sent_to_email?: string } | null)?.sent_to_email || null;

      if (!realtorEmail) {
        const userRes = await supabase.auth.admin.getUserById(lead.realtor_id);
        realtorEmail = userRes.data.user?.email ?? null;
      }

      if (!realtorEmail) {
        console.warn('[LeadsService] no email for realtor', lead.realtor_id);
        return;
      }

      const name = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim();
      const bookingDateTime = appointment
        ? DateTime.fromJSDate(appointment)
            .setLocale('en-US')
            .toFormat("LLLL d, yyyy 'at' h:mm a")
        : 'Unknown';
      const consoleLink = `https://br.myrealvaluation.com/console/reports/${sanitized}`;

      await this.email.sendBookingNotification(
        realtorEmail,
        name,
        (lead.addresses && lead.addresses[0]?.address) || '',
        bookingDateTime,
        consoleLink,
      );
      console.debug('[LeadsService] booking email sent to', realtorEmail);
    } catch (err) {
      console.error('[LeadsService] booking email failed', err);
    }
  }

  async setAddress(phone: string, addresses: AddressInput[]): Promise<void> {
    const sanitized = normalizePhone(phone);
    const { data, error } = await supabase
      .from('leads')
      .select('addresses')
      .eq('phone', sanitized)
      .maybeSingle();
    if (error) {
      console.error('[LeadsService] failed to fetch existing addresses', error);
      return;
    }
    const existing =
      ((data as { addresses?: AddressInput[] } | null)?.addresses) ?? [];
    const updated = [...existing, ...addresses];
    const { error: updErr } = await supabase
      .from('leads')
      .update({ addresses: updated })
      .eq('phone', sanitized);
    if (updErr) {
      console.error('[LeadsService] failed to set address', updErr);
    }
  }

  async hasAddress(phone: string): Promise<boolean> {
    const sanitized = normalizePhone(phone);
    const { data } = await supabase
      .from('leads')
      .select('addresses')
      .eq('phone', sanitized)
      .maybeSingle();
    const lead = data as { addresses?: AddressInput[] } | null;
    return Array.isArray(lead?.addresses) && lead.addresses.length > 0;
  }

  async createLead(input: LeadInput): Promise<void> {
    console.debug('[LeadsService] createLead called with', input);

    let realtorId = '';
    let timeZone = null;

    // Dynamically lookup from add table if adId is provided
    if (input.adId) {
      console.debug('[LeadsService] Fetching ad details for ad_id:', input.adId);
      const { data: adData, error: adError } = await supabase
        .from('add')
        .select('realtor_id, time_zone')
        .eq('ad_id', input.adId)
        .maybeSingle();
      if (adError) {
        console.error('[LeadsService] Failed to fetch ad details', adError);
      } else if (adData) {
        realtorId = adData.realtor_id;
        timeZone = adData.time_zone;
      } else {
        console.warn('[LeadsService] No ad found for adId:', input.adId, ' - using input values');
      }
    }

    const [firstName, ...rest] = input.name.trim().split(' ');
    const lastName = rest.join(' ');
    console.debug('[LeadsService] parsed name', { firstName, lastName });

    const sanitizedPhone = normalizePhone(input.phone);
    const leadRecord = {
      phone: sanitizedPhone,
      realtor_id: realtorId,
      first_name: firstName,
      last_name: lastName,
      email: input.email,
      addresses: input.addresses ?? null,
      time_zone: timeZone,
      ad_id: input.adId ?? null,
      form_id: input.formId ?? null,
      leadgen_id: input.leadgenId ?? null,
      lead_state: 'cold',
      survey_answers: input.surveyAnswers ?? null,
      };
    console.debug('[LeadsService] upserting lead', leadRecord);

    const { error: upsertError } = await supabase
      .from('leads')
      .upsert(leadRecord);
    if (upsertError) {
      console.error('[LeadsService] failed to upsert lead', upsertError);
      throw upsertError;
    }

    console.debug('[LeadsService] lead saved successfully');
  }

  async findByPhone(phone: string) {
    const sanitized = normalizePhone(phone);
    const { data } = await supabase
      .from('leads')
      .select('first_name,last_name,phone')
      .eq('phone', sanitized)
      .maybeSingle();
    const lead = data as {
      first_name: string;
      last_name: string;
      phone: string;
    } | null;
    if (!lead) return null;
    return {
      full_name: `${lead.first_name} ${lead.last_name}`.trim(),
      phone: lead.phone,
    };
  }

  async findRealtor(realtorId: string) {
    console.debug('[LeadsService] fetching realtor', realtorId);
    if (!this.uuidRe.test(realtorId)) {
      console.debug('[LeadsService] invalid uuid format', realtorId);
      return null;
    }
    const { data, error } = await supabase
      .from('realtor')
      .select(
        'realtor_id,f_name,e_name,video_url,website_url,calendar_use,sent_to_email',
      )
      .eq('realtor_id', realtorId)
      .maybeSingle();
    if (error) {
      console.error('[LeadsService] Supabase error', error);
      throw error;
    }
    const realtor = data as {
      realtor_id: string;
      f_name: string;
      e_name: string;
      video_url: string;
      website_url: string;
      calendar_use: boolean;
      sent_to_email?: string | null;
    } | null;
    if (!realtor) {
      console.debug('[LeadsService] no realtor found for', realtorId);
      return null;
    }
    console.debug('[LeadsService] found realtor id', realtor.realtor_id);
    return {
      realtorId: realtor.realtor_id,
      name: `${realtor.f_name} ${realtor.e_name}`.trim(),
      video_url: realtor.video_url,
      website_url: realtor.website_url,
      calendar_use: realtor.calendar_use,
      sent_to_email: realtor.sent_to_email ?? null,
    };
  }

  async getBookingInfo(phone: string): Promise<{
    phone: string;
    full_name: string;
    time_zone: string;
    realtor_id: string;
  } | null> {
    const sanitized = normalizePhone(phone);
    const { data } = await supabase
      .from('leads')
      .select('first_name,last_name,phone,time_zone,realtor_id')
      .eq('phone', sanitized)
      .maybeSingle();
    const lead =
      (data as {
        first_name?: string;
        last_name?: string;
        phone: string;
        time_zone: string;
        realtor_id: string;
      } | null) ?? null;
    if (!lead) return null;
    return {
      phone: lead.phone,
      full_name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
      time_zone: lead.time_zone,
      realtor_id: lead.realtor_id,
    };
  }

  async getInfoForAgent(phone: string): Promise<{
    realtorName: string;
    answers: { question: string; answer: string }[];
    leadName: string;
    phone: string;
    timeZone: string | null;
    calendarUse: boolean;
    customPrompt: string | null;
  } | null> {
    const sanitized = normalizePhone(phone);

    console.debug(
      '[LeadsService] getInfoForAgent for:', sanitized);

    const { data } = await supabase
      .from('leads')
      .select(
        `first_name,last_name,phone,time_zone,addresses,survey_answers,realtor:realtor_id(f_name,e_name,calendar_use,custom_prompt)`,
      )
      .eq('phone', sanitized)
      .maybeSingle();
    const lead =
      (data as {
        first_name?: string;
        last_name?: string;
        phone: string;
        time_zone?: string | null;
        addresses?: AddressInput[];
        survey_answers?: { question: string; answer: string }[] | Record<string, unknown>;
        realtor?: {
          f_name?: string;
          e_name?: string;
          calendar_use?: boolean;
          custom_prompt?: string | null;
        } | null;
      } | null) ?? null;
    if (!lead) return null;

    const leadName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim();
    const tz = lead.time_zone ?? null;

    const realtorName = lead.realtor
      ? `${lead.realtor.f_name ?? ''} ${lead.realtor.e_name ?? ''}`.trim()
      : 'o corretor';
    const calendarUse = lead.realtor?.calendar_use !== false;
    
    console.debug(
      '[LeadsService] lead.realtor?.calendar_use type:',
      typeof lead.realtor?.calendar_use,
      'value:',
      lead.realtor?.calendar_use
    );

    console.debug(
      '[LeadsService] calendarUse value:',
      calendarUse
    );
    const customPrompt = lead.realtor?.custom_prompt ?? null;

    // const adQuestions = Array.isArray(lead.ad?.questions)
    //   ? (lead.ad?.questions as string[])
    //   : [];

    // let answers: { question: string; answer: string }[] = [];
    // if (adQuestions.length && lead.survey_answers && typeof lead.survey_answers === 'object') {
    //   if (Array.isArray(lead.survey_answers)) {
    //     for (let i = 0; i < adQuestions.length; i++) {
    //       const ansItem = lead.survey_answers[i];
    //       const ans =
    //         typeof ansItem === 'object' && ansItem !== null && 'answer' in ansItem
    //           ? (ansItem as { answer?: string }).answer
    //           : (ansItem as string | undefined);
    //       if (ans) answers.push({ question: adQuestions[i], answer: ans });
    //     }
    //   } else {
    //     const ansObj = lead.survey_answers as Record<string, unknown>;
    //     adQuestions.forEach((q, idx) => {
    //       const val = ansObj[String(idx)];
    //       if (val !== undefined && val !== null)
    //         answers.push({ question: q, answer: String(val) });
    //     });
    //   }
    // } else if (Array.isArray(lead.survey_answers)) {
    //   answers = lead.survey_answers.filter((a) => a.answer);
    // }

    return {
      realtorName,
      answers: [],
      leadName,
      phone: lead.phone,
      timeZone: tz,
      calendarUse,
      customPrompt,
    };
  }

  async getLeadReport(phone: string): Promise<{
    name: string;
    email: string | null;
    phone: string;
    addresses: AddressInput[] | null;
    answers: { question: string; answer: string }[];
    lead_state: string;
  } | null> {
    const sanitized = normalizePhone(phone);
    const { data } = await supabase
      .from('leads')
      .select(
        `first_name,last_name,email,phone,addresses,survey_answers,lead_state`,
      )
      .eq('phone', sanitized)
      .maybeSingle();
    const lead =
      (data as {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone: string;
        addresses?: AddressInput[];
        survey_answers?: { question: string; answer: string }[];
        lead_state?: string;
      } | null) ?? null;
    if (!lead) return null;

    const answers = Array.isArray(lead.survey_answers)
      ? lead.survey_answers.filter((a) => a.answer)
      : [];

    return {
      name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
      email: lead.email ?? null,
      phone: lead.phone,
      addresses: lead.addresses ?? null,
      answers,
      lead_state: lead.lead_state ?? 'cold',
    };
  }

  async updateSummaries(
    phone: string,
    survey?: string,
    message?: { number: number; content: string },
  ): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (survey !== undefined) updates.survey_summary = survey;
    if (message !== undefined) updates.message_summary = message;
    if (Object.keys(updates).length === 0) return;
    await supabase
      .from('leads')
      .update(updates)
      .eq('phone', normalizePhone(phone));
  }
}
