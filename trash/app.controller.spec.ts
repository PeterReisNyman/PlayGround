import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the intro!', () => {
      expect(appController.getIntro()).toBe(
        'FitCoachAI is a conversational fitness coach. It will generate personalised 7‑day training and supplementation plans while safely guiding you toward your fitness goals. It is able to reason over a your’s context (equipment, constraints, health notes) and call auxiliary functions such as search or scheduling **within a single response**.',
      );
    });
  });
});
