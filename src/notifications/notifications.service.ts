import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification, NotificationType } from "./entities/notification.entity";

import { User } from "../users/entities/user.entity";
import { MailserviceService } from "../mailservice/mailservice.service";
import { PushNotificationService } from "./push-notification.service";
import { Subject, Observable, of, interval, merge } from "rxjs";
import { filter, map } from "rxjs/operators";

export interface SseNotificationEvent {
  userId: string;
  unreadCount: number;
  notification?: any;
  type?: string;
}

@Injectable()
export class NotificationsService {
  private readonly unreadCountCache = new Map<string, number>();
  private readonly sseSubject = new Subject<SseNotificationEvent>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailserviceService,
    private readonly pushService: PushNotificationService,
  ) {}

  getSseStream(userId: string): Observable<SseNotificationEvent> {
    const currentCount = this.unreadCountCache.get(userId) ?? 0;
    const initial$ = of({ userId, unreadCount: currentCount, type: 'connected' });
    const userEvents$ = this.sseSubject.asObservable().pipe(
      filter((event) => event.userId === userId)
    );
    const keepAlive$ = interval(15000).pipe(
      map(() => ({ userId, unreadCount: this.unreadCountCache.get(userId) ?? 0, type: 'ping' }))
    );

    return merge(initial$, userEvents$, keepAlive$);
  }


  async create(userId: string, title: string, message: string, type: NotificationType, link?: string) {
    // 1. Persist to DB
    const notification = this.notificationRepo.create({
      recipient: { id: userId } as any,
      title,
      message,
      type,
      link,
    });
    const saved = await this.notificationRepo.save(notification);

    // Option B: Fast cache update
    const currentCount = (this.unreadCountCache.get(userId) ?? (await this.getUnreadCountFromDb(userId)) - 1) + 1;
    this.unreadCountCache.set(userId, currentCount);

    // Option A: Emit SSE event to user in real-time
    this.sseSubject.next({
      userId,
      unreadCount: currentCount,
      notification: saved,
    });

    // 2. Fetch user preferences asynchronously
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return saved;

    // 3. Send via Email if enabled
    if (user.emailNotificationsEnabled) {
      this.mailService.sendGenericNotification(
        user.email,
        user.fullName,
        title,
        message,
        link
      ).catch(err => console.error('Failed to send notification email', err));
    }

    // 4. Send via Push if enabled
    if (user.pushNotificationsEnabled) {
      this.pushService.sendPush(userId, title, message, { link })
        .catch(err => console.error('Failed to send push notification', err));
    }

    return saved;
  }

  async findAll(userId: string) {
    return this.notificationRepo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' } as any, 
      take: 20,
    });
  }

  async markAsRead(id: string, userId: string) {
    const result = await this.notificationRepo.update(
      { id, recipient: { id: userId } as any }, 
      { isRead: true }
    );

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found or access denied');
    }

    // Option B: Decrement cache and Option A: Push SSE update
    const newCount = Math.max(0, (this.unreadCountCache.get(userId) ?? 1) - 1);
    this.unreadCountCache.set(userId, newCount);

    this.sseSubject.next({
      userId,
      unreadCount: newCount,
    });

    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Option B: Return cached count if available
    if (this.unreadCountCache.has(userId)) {
      return this.unreadCountCache.get(userId)!;
    }
    const count = await this.getUnreadCountFromDb(userId);
    this.unreadCountCache.set(userId, count);
    return count;
  }

  private async getUnreadCountFromDb(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: {
        recipient: { id: userId },
        isRead: false,
      },
    });
  }

  async getSettings(userId: string) {
    const user = await this.userRepo.findOne({ 
      where: { id: userId },
      select: ['emailNotificationsEnabled', 'pushNotificationsEnabled']
    });
    return user;
  }

  async updateSettings(userId: string, dto: { emailNotificationsEnabled?: boolean; pushNotificationsEnabled?: boolean }) {
    await this.userRepo.update(userId, dto);
    return { success: true };
  }
}

