import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { ConversationController } from './conversation/conversation.controller';
import { AgentController } from './agentLogic/agent.controller';
import { CalendarController } from './calendar/calendar.controller';
import { SchedulerController } from './scheduler/scheduler.controller';
import { LeadsController } from './leads/leads.controller';

import { AppService } from './app.service';
import { ConversationService } from './conversation/conversation.service';
import { AgentService } from './agentLogic/agent.service';

import { CalendarService } from './calendar/calendar.service';
import { SupabaseService } from './supabase/supabase.service';
import { SchedulerService } from './scheduler/scheduler.service';

import { LeadsService } from './leads/leads.service';
import { MessengerService } from './messenger/messenger.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { BookingService } from './booking/booking.service';
import { BookingController } from './booking/booking.controller';
import { SystemMessageController } from './system-message.controller';
import { RealtorController } from './realtor/realtor.controller';
import { RealtorService } from './realtor/realtor.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';
import { FacebookController } from './facebook/facebook.controller';
import { FacebookService } from './facebook/facebook.service';
import { MetaService } from './meta/meta.service';
import { LeadGenController } from './leadgen/leadgen.controller';
import { LeadGenService } from './leadgen/leadgen.service';

import { OpenAiService } from './agentHelp/openai.service';
import { PromptService } from './agentHelp/prompt.service';
import Mailchimp = require('@mailchimp/mailchimp_transactional');
import { EmailService } from './email/email.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'backend/.env',
    }),

    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', 'frontend', 'site', 'dist'),
        serveRoot: '/',
      },
      {
        rootPath: join(__dirname, '..', '..', 'frontend', 'survey', 'dist'),
        serveRoot: '/survey',
      },
      {
        rootPath: join(
          __dirname,
          '..',
          '..',
          'frontend',
          'RealtorInterface',
          'Onboarding',
          'dist',
        ),
        serveRoot: '/realtor',
      },
      {
        rootPath: join(
          __dirname,
          '..',
          '..',
          'frontend',
          'RealtorInterface',
          'Console',
          'dist',
        ),
        serveRoot: '/console',
      },
    ),
  ],
  controllers: [
    AppController,
    ConversationController,
    AgentController,
    CalendarController,
    SchedulerController,
    LeadsController,
    LeadGenController,
    BookingController,
    RealtorController,
    SystemMessageController,
    ReportsController,
    WhatsAppController,
    MetricsController,
    FacebookController,
  ],
  providers: [
    AppService,
    ConversationService,
    AgentService,
    SchedulerService,
    OpenAiService,
    PromptService,
    CalendarService,
    SupabaseService,
    {
      provide: 'MAILCHIMP_CLIENT',
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('MANDRILL_API_KEY');
        if (!apiKey) {
          throw new Error('MANDRILL_API_KEY not set');
        }
        return Mailchimp(apiKey);
      },
      inject: [ConfigService],
    },
    EmailService,
    LeadsService,
    MessengerService,
    WhatsAppService,
    BookingService,
    RealtorService,
    ReportsService,
    MetricsService,
    FacebookService,
    MetaService,
    LeadGenService,
  ],
})
export class AppModule {}
