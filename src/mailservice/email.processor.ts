import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface EmailJobPayload {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

@Processor('email-queue', {
  concurrency: 10,
  limiter: {
    max: 50,
    duration: 1000, // Max 50 emails per second to respect provider rate limits
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fromName = 'FKstores Support';

  constructor(private readonly config: ConfigService) {
    super();
    this.apiUrl = this.config.get<string>('ZEPTOMAIL_API_URL') ?? 'https://api.zeptomail.com/v1.1/email';
    this.apiKey = (this.config.get<string>('ZEPTOMAIL_API_KEY') ?? '').trim();
    this.fromAddress = (this.config.get<string>('MAIL_FROM') ?? 'donotreply@fkstores.com').trim();
  }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    const { to, toName, subject, html } = job.data;
    this.logger.log(
      `[Queue Job #${job.id}] Processing email for ${to} — "${subject}" (Attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`,
    );

    const payload = {
      from: {
        address: this.fromAddress,
        name: this.fromName,
      },
      to: [
        {
          email_address: {
            address: to,
            name: toName ?? to,
          },
        },
      ],
      subject,
      htmlbody: html,
    };

    try {
      await axios.post(this.apiUrl, payload, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
        },
        timeout: 15000,
      });

      this.logger.log(`[Queue Job #${job.id}] Email successfully delivered to ${to}`);
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      this.logger.error(
        `[Queue Job #${job.id}] Failed to send email to ${to} | Status: ${status ?? 'N/A'} | Body: ${JSON.stringify(body) ?? error.message}`,
      );
      // Re-throw so BullMQ triggers exponential backoff retry or DLQ
      throw error;
    }
  }
}
