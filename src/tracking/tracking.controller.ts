import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { ActivityType } from './entities/user-activity.entity';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt.guard';
 

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('event')
  @UseGuards(OptionalJwtAuthGuard) // This guard allows both authenticated and unauthenticated users
  async logEvent(
    @Req() req: any,
    @Body() body: { productId?: string; type: ActivityType; metadata?: any }
  ) {

     
    const userId = req.user?.id || null;
    
    // FIRE AND FORGET: 
    // We don't 'await' so the frontend gets an instant 201 response
    this.trackingService.track(userId, body.productId, body.type, body.metadata);
    
    return { success: true };
  }
}