import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  async logSurveyLoad(uuid: string) {
    const url = process.env.GRAFANA_METRICS_URL;
    const apiKey = process.env.GRAFANA_API_KEY;
    if (!url || !apiKey) {
      console.warn('[MetricsService] Missing Grafana config; skipping metric');
      return;
    }

    const ts = Date.now() * 1_000_000; // nanoseconds
    const payload = {
      streams: [
        {
          stream: { metric: 'survey_page_load_total', uuid },
          values: [[String(ts), '1']],
        },
      ],
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('[MetricsService] Failed to send metric', err);
    }
  }

  async logSurveyAnswer(uuid: string, question: string, answer: string) {
    console.log('[MetricsService] survey answer', { uuid, question, answer });
  }
}
