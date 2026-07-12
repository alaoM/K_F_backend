import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user-role.enum';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body('email') email: string) {
    return this.newsletterService.subscribe(email);
  }

  @Post('unsubscribe')
  unsubscribe(@Body('email') email: string) {
    return this.newsletterService.unsubscribe(email);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.newsletterService.findAll();
  }
}
