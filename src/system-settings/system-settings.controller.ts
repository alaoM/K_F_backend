import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user-role.enum';
import { CreateSystemSettingDto } from './dto/create-system-setting.dto';
import { AnalyticsService } from './analyticsService.service';

// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system-settings')
export class SystemSettingsController {
  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly analyticsService: AnalyticsService) { }

  // Get all settings (Admin Only)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAll() {
    return this.settingsService.findAll();
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    return this.analyticsService.getPlatformStats();
  }

  @Get('seller/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerStats(@Req() req) {
    return this.analyticsService.getSellerStats(req.user.sub);
  }

  // Update multiple settings at once (Admin Only)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateBulk(@Body() dto: CreateSystemSettingDto) {
    return this.settingsService.updateBulk(dto);
  }
}