import { Inject, Injectable, Logger } from '@nestjs/common';
import Mailchimp = require('@mailchimp/mailchimp_transactional');

@Injectable()
export class EmailService {
  private readonly log = new Logger('EmailService');

  constructor(@Inject('MAILCHIMP_CLIENT') private readonly mandrill: Mailchimp.ApiClient) {}

  async sendBookingNotification(
    realtorEmail: string,
    leadName: string,
    address: string,
    bookingDateTime: string,
    consoleReportLink: string,
  ): Promise<Mailchimp.MessagesSendResponse[] | import('axios').AxiosError> {
    const message: Mailchimp.MessagesMessage = {
      from_email: 'notifications@myrealvaluation.com',
      to: [{ email: realtorEmail, type: 'to' }],
      subject: `New Lead Booked: ${leadName}`,
      text: `A new lead has been booked:\n\nName: ${leadName}\nAddress: ${address}\nDate/Time: ${bookingDateTime}\nConsole Report: ${consoleReportLink}`,
    };

    try {
      const response = await this.mandrill.messages.send({ message });
      this.log.log(`Email sent: ${JSON.stringify(response)}`);
      return response;
    } catch (err) {
      this.log.error('Failed to send email', err as Error);
      throw err;
    }
  }
}
