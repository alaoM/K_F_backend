import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class MailserviceService {
  private readonly logger = new Logger(MailserviceService.name);

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fromName = 'FKstores Support';

  constructor(private readonly config: ConfigService) {
    this.apiUrl = this.config.get<string>('ZEPTOMAIL_API_URL') ?? 'https://api.zeptomail.com/v1.1/email';
    this.apiKey = this.config.get<string>('ZEPTOMAIL_API_KEY') ?? '';
    this.fromAddress = this.config.get<string>('MAIL_FROM') ?? 'donotreply@fkstores.com';
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Compiles a Handlebars template file and returns rendered HTML.
   */
  private renderTemplate(templateName: string, context: Record<string, unknown>): string {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    const source = fs.readFileSync(templatePath, 'utf8');
    const compiled = handlebars.compile(source);
    return compiled(context);
  }

  /**
   * Sends an email via ZeptoMail REST API.
   * @see https://www.zoho.com/zeptomail/help/api/email-sending.html
   */
  private async send(params: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const payload = {
      from: {
        address: this.fromAddress,
        name: this.fromName,
      },
      to: [
        {
          email_address: {
            address: params.to,
            name: params.toName ?? params.to,
          },
        },
      ],
      subject: params.subject,
      htmlbody: params.html,
    };

    try {
      await axios.post(this.apiUrl, payload, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.apiKey, // e.g. "Zoho-enczapikey ..."
        },
      });
      this.logger.log(`Email sent to ${params.to} — "${params.subject}"`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${params.to}: ${error?.response?.data?.message ?? error.message}`,
      );
      throw error;
    }
  }

  // ─── Public methods ─────────────────────────────────────────────────────────

  async sendGenericNotification(
    email: string,
    name: string,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    const html = this.renderTemplate('notification', {
      name,
      title,
      message,
      link,
      year: new Date().getFullYear(),
    });
    await this.send({ to: email, toName: name, subject: title, html });
  }

  async sendUserWelcome(
    user: { email: string; fullName?: string },
    verificationUrl: string,
  ): Promise<void> {
    const html = this.renderTemplate('welcome', {
      name: user.fullName ?? '',
      verificationUrl,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: user.email,
      toName: user.fullName,
      subject: 'Welcome to FKstores – Verify Your Email',
      html,
    });
  }

  async sendPasswordReset(user: { email: string; fullName?: string }, url: string): Promise<void> {
    const html = this.renderTemplate('reset-password', {
      name: user.fullName,
      url,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: user.email,
      toName: user.fullName,
      subject: 'Password Reset Request – FKstores',
      html,
    });
  }

  async send2FACode(user: { email: string; fullName?: string }, code: string): Promise<void> {
    const html = this.renderTemplate('otp', {
      name: user.fullName,
      otp: code,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: user.email,
      toName: user.fullName,
      subject: 'Your FKstores Verification Code',
      html,
    });
  }

  async sendShippingNotification(
    order: { buyer?: { email?: string; fullName?: string } },
    title: string,
  ): Promise<void> {
    const html = this.renderTemplate('order-shipped', {
      name: order.buyer?.fullName ?? 'Customer',
      title,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: order.buyer?.email ?? '',
      toName: order.buyer?.fullName,
      subject: `Your order – ${title} has been shipped`,
      html,
    });
  }

  async sendDeliveryNotification(
    order: { buyer?: { email?: string; fullName?: string } },
    title: string,
  ): Promise<void> {
    const html = this.renderTemplate('order-delivered', {
      name: order.buyer?.fullName ?? 'Customer',
      title,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: order.buyer?.email ?? '',
      toName: order.buyer?.fullName,
      subject: `Your order – ${title} has been delivered`,
      html,
    });
  }

  async sendSellerApprovalEmail(email: string, name: string): Promise<void> {
    const loginUrl = `${this.config.get('FRONTEND_URL') ?? 'https://fkstores.com'}/login`;
    const html = this.renderTemplate('seller-approval', {
      name,
      loginUrl,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: email,
      toName: name,
      subject: 'Congratulations! Your FKstores Seller Account is Approved',
      html,
    });
  }

  async sendRejectionEmail(email: string, name: string, reason: string): Promise<void> {
    const onboardingUrl = `${this.config.get('FRONTEND_URL') ?? 'https://fkstores.com'}/onboarding/become-a-seller`;
    const html = this.renderTemplate('seller-rejection', {
      name,
      reason,
      onboardingUrl,
      year: new Date().getFullYear(),
    });
    await this.send({
      to: email,
      toName: name,
      subject: 'Action Required: Update needed for your FKstores Seller Application',
      html,
    });
  }
}
