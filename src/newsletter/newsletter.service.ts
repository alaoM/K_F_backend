import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscription } from './entities/newsletter-subscription.entity';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscription)
    private readonly newsletterRepository: Repository<NewsletterSubscription>,
  ) {}

  async subscribe(email: string) {
    const existing = await this.newsletterRepository.findOne({ where: { email } });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This email is already subscribed to our newsletter.');
      }
      existing.isActive = true;
      return this.newsletterRepository.save(existing);
    }

    const subscription = this.newsletterRepository.create({ email });
    return this.newsletterRepository.save(subscription);
  }

  async unsubscribe(email: string) {
    const subscription = await this.newsletterRepository.findOne({ where: { email } });
    if (subscription) {
      subscription.isActive = false;
      await this.newsletterRepository.save(subscription);
    }
    return { message: 'Successfully unsubscribed from newsletter' };
  }

  async findAll() {
    return this.newsletterRepository.find({ order: { createdAt: 'DESC' } });
  }
}
