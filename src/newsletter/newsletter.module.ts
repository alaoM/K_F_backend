import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterSubscription } from './entities/newsletter-subscription.entity';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSubscription])],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
