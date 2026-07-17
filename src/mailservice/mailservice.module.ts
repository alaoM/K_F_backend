import { Module, Global } from '@nestjs/common';
import { MailserviceService } from './mailservice.service';

/**
 * Mail is sent via ZeptoMail REST API (not SMTP).
 * No MailerModule needed — the service handles Handlebars
 * template compilation and HTTP calls directly.
 */
@Global()
@Module({
  providers: [MailserviceService],
  exports: [MailserviceService],
})
export class MailserviceModule {}