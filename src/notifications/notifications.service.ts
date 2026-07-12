import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsOrder } from "typeorm";
import { Notification, NotificationType } from "./entities/notification.entity";

import { User } from "../users/entities/user.entity";
import { MailserviceService } from "../mailservice/mailservice.service";
import { PushNotificationService } from "./push-notification.service";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailserviceService,
    private readonly pushService: PushNotificationService,
  ) {}

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

    // 2. Fetch user preferences
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return saved;

    // 3. Send via Email if enabled
    if (user.emailNotificationsEnabled) {
      try {
        await this.mailService.sendGenericNotification(
          user.email,
          user.fullName,
          title,
          message,
          link
        );
      } catch (err) {
        console.error('Failed to send notification email', err);
      }
    }

    // 4. Send via Push if enabled
    if (user.pushNotificationsEnabled) {
      try {
        await this.pushService.sendPush(userId, title, message, { link });
      } catch (err) {
        console.error('Failed to send push notification', err);
      }
    }

    return saved;
  }

  async findAll(userId: string) {
    return this.notificationRepo.find({
      where: { recipient: { id: userId } },
      // Use 'as any' here if TS still complains about the global Notification type
      order: { createdAt: 'DESC' } as any, 
      take: 20,
    });
  }

  async markAsRead(id: string, userId: string) {
    // TypeORM update is safer when filtering by ID first
    // We check both ID and recipient ID to ensure users can't mark others' notifications as read
    const result = await this.notificationRepo.update(
        { id, recipient: { id: userId } as any }, 
        { isRead: true }
    );

    if (result.affected === 0) {
        throw new NotFoundException('Notification not found or access denied');
    }
    
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepo.count({ 
        where: { 
            recipient: { id: userId }, 
            isRead: false 
        } 
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
