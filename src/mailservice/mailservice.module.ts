import { Module, Global } from '@nestjs/common';
import { MailserviceService } from './mailservice.service';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './email.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || '127.0.0.1',
          port: Number(config.get<number>('REDIS_PORT')) || 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'email-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: {
          age: 3600, // 1 hour retention
          count: 500,
        },
        removeOnFail: {
          age: 86400 * 7, // 7 days retention for failed jobs / Dead Letter Queue inspection
        },
      },
    }),
  ],
  providers: [MailserviceService, EmailProcessor],
  exports: [MailserviceService, BullModule],
})
export class MailserviceModule {}