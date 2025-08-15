import { Injectable } from '@nestjs/common';

export interface LeadScoreInput {
  message: string;
  name?: string;
  phone?: string;
  email?: string;
  channel?: 'sms' | 'whatsapp' | 'facebook' | 'web' | 'email' | string;
}

export interface LeadScoreResult {
  score: number; // 0..100
  stage: 'cold' | 'warm' | 'hot';
  recommendedAction: string;
  recommendedReply: string;
  extracted: {
    budget?: number | null;
    timeline?: string | null;
    explicitSignals: string[];
  };
}

@Injectable()
export class LeadGenService {
  scoreLead(input: LeadScoreInput): LeadScoreResult {
    const text = (input.message || '').toLowerCase();

    // Signals and simple NLP-lite parsing
    const signals: string[] = [];

    // Intent/urgency keywords
    const urgentWords = [
      'asap',
      'today',
      'this week',
      'ready to buy',
      'pre-approved',
      'preapproved',
      'cash',
      'make an offer',
      'schedule a tour',
      'can we see',
    ];
    const coldWords = [
      'just looking',
      'browsing',
      'maybe',
      'not sure',
      'next year',
      '6 months',
      'someday',
    ];

    let intent = 0;
    urgentWords.forEach((w) => {
      if (text.includes(w)) {
        signals.push(`signal:${w}`);
        intent += 0.15;
      }
    });
    coldWords.forEach((w) => {
      if (text.includes(w)) {
        signals.push(`cold:${w}`);
        intent -= 0.1;
      }
    });
    // Contact info presence boosts
    if (input.phone && input.phone.replace(/\D/g, '').length >= 10) intent += 0.05;
    if (input.email && input.email.includes('@')) intent += 0.05;
    if (input.channel && ['sms', 'whatsapp', 'phone'].includes(input.channel)) intent += 0.03;

    // Budget extraction: $450k, 450k, 450,000
    let budget: number | null = null;
    const moneyMatch = text.match(/\$?\s*([0-9]{2,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?\s*k)\b/);
    if (moneyMatch) {
      let raw = moneyMatch[1].replace(/,/g, '').trim();
      if (raw.endsWith('k')) {
        raw = raw.slice(0, -1);
        budget = parseFloat(raw) * 1000;
      } else {
        budget = parseFloat(raw);
      }
      if (!isNaN(budget)) {
        signals.push('budget_mentioned');
      } else {
        budget = null;
      }
    }

    // Normalize budget score (0..1) roughly across 100k..2M
    let budgetScore = 0;
    if (budget !== null) {
      const min = 100_000;
      const max = 2_000_000;
      const clamped = Math.max(min, Math.min(max, budget));
      budgetScore = (clamped - min) / (max - min);
    }

    // Timeline parsing
    let timeline: string | null = null;
    if (/today|asap|now/.test(text)) timeline = 'immediate';
    else if (/this week|next week/.test(text)) timeline = 'week';
    else if (/this month|next month/.test(text)) timeline = 'month';
    else if (/\b(\d+)\s*(days?|weeks?|months?)\b/.test(text)) {
      const m = text.match(/\b(\d+)\s*(days?|weeks?|months?)\b/);
      if (m) timeline = `${m[1]} ${m[2]}`;
    } else if (/6 months|next year|q[1-4]/.test(text)) timeline = 'later';

    // Timeline urgency score
    let tlScore = 0.3; // neutral default
    if (timeline === 'immediate') tlScore = 1.0;
    else if (timeline === 'week') tlScore = 0.8;
    else if (timeline === 'month') tlScore = 0.6;
    else if (timeline === 'later') tlScore = 0.2;

    // Base intent normalization
    intent = Math.max(0, Math.min(1, 0.4 + intent));

    // Aggregate score (weights tuned heuristically)
    const score01 = 0.55 * intent + 0.25 * tlScore + 0.20 * budgetScore;
    const score = Math.round(score01 * 100);

    let stage: 'cold' | 'warm' | 'hot' = 'warm';
    if (score >= 75) stage = 'hot';
    else if (score < 45) stage = 'cold';

    const action = this.nextAction(stage, timeline, !!input.phone, !!input.email);
    const reply = this.composeReply(input.name, stage, timeline, !!input.phone);

    return {
      score,
      stage,
      recommendedAction: action,
      recommendedReply: reply,
      extracted: {
        budget: budget ?? null,
        timeline: timeline ?? null,
        explicitSignals: signals,
      },
    };
  }

  nextAction(
    stage: 'cold' | 'warm' | 'hot',
    timeline: string | null,
    hasPhone: boolean,
    hasEmail: boolean,
  ): string {
    if (stage === 'hot') {
      if (timeline === 'immediate' || timeline === 'week') {
        return 'Call within 5 minutes and propose 2-3 tour times for the next 48 hours.';
      }
      return 'Call today, offer a brief discovery call and propose tour times this week.';
    }
    if (stage === 'warm') {
      if (hasPhone) return 'Send a text with 2 discovery call slots and a short survey link.';
      if (hasEmail) return 'Email a short survey and propose 2 discovery call slots.';
      return 'Request phone or email to schedule a brief discovery call.';
    }
    // cold
    return 'Tag as nurture: send a monthly market update and re-check in 2 weeks.';
  }

  composeReply(
    name: string | undefined,
    stage: 'cold' | 'warm' | 'hot',
    timeline: string | null,
    hasPhone: boolean,
  ): string {
    const first = name ? name.split(' ')[0] : 'there';
    const greet = `Hi ${first}, thanks for reaching out!`;
    if (stage === 'hot') {
      const when = timeline === 'immediate' ? 'today' : timeline === 'week' ? 'this week' : 'soon';
      return (
        `${greet} I can help you line up tours ${when}. ` +
        `Do any of these times work for a quick 10‑minute call to confirm details: ` +
        `today 5:30pm, tomorrow 10:30am, or tomorrow 1:00pm?`
      );
    }
    if (stage === 'warm') {
      return (
        `${greet} I’ll tailor options to your needs. ` +
        `Could we do a quick 10‑minute call to align on budget and areas? ` +
        `I’m free today 4:30pm or tomorrow 11:00am.`
      );
    }
    return (
      `${greet} I’ll send a few resources and local market updates. ` +
      `If helpful, I’m happy to do a quick intro call anytime.`
    );
  }
}

