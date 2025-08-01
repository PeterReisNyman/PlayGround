import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getIntro(): string {
    return 'FitCoachAI is a conversational fitness coach. It will generate personalised 7‑day training and supplementation plans while safely guiding you toward your fitness goals. It is able to reason over a your’s context (equipment, constraints, health notes) and call auxiliary functions such as search or scheduling **within a single response**.';
  }
}
