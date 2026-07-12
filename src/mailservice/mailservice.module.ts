import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module, Global } from '@nestjs/common';

import { join } from 'path';
import { ConfigService } from '@nestjs/config'; 
import { MailserviceService } from './mailservice.service';
 
@Global()  
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST'),
          port: config.get<number>('MAIL_PORT'), 
          secure: false, // true for 465, false for other ports
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASS'),
          },
          tls:{
             rejectUnauthorized: false, 
          }
        },
        defaults: {
          from: `"AgroCommerce Support" <${config.get('MAIL_FROM')}>`,
        },
        template: {
          dir: join(__dirname, 'templates'), 
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailserviceService],
  exports: [MailserviceService],
})
export class MailserviceModule {}