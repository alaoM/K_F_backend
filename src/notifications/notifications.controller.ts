import { Controller, Get, Param, Patch, Req, UseGuards, Body, Sse } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  streamNotifications(@Req() req: any): Observable<MessageEvent> {
    return this.notificationsService.getSseStream(req.user.id).pipe(
      map((event) => ({
        data: JSON.stringify(event),
      }))
    );
  }

  @Get()
  async getAll(@Req() req: any) {
    return this.notificationsService.findAll(req.user.id);
  }

  @Get('unread-count')
  async getCount(@Req() req: any) {
    return { count: await this.notificationsService.getUnreadCount(req.user.id) };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Get('settings')
  async getSettings(@Req() req: any) {
    return this.notificationsService.getSettings(req.user.id);
  }

  @Patch('settings')
  async updateSettings(@Body() dto: { emailNotificationsEnabled?: boolean; pushNotificationsEnabled?: boolean }, @Req() req: any) {
    return this.notificationsService.updateSettings(req.user.id, dto);
  }
}

