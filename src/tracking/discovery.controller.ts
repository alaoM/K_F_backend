import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt.guard';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('personalized')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Req() req: any, 
    @Query('limit') limit?: number,
    @Query('exclude') excludeId?: string // Capture the ID to ignore
  ) {
    const userId = req.user?.id || null;
    
    const products = await this.discoveryService.getPersonalizedFeed(
        userId, 
        limit || 8, 
        excludeId
    );
    console.log('Personalized Feed for User:', {
      userId,
      limit: limit || 8,
      excludeId,
        });

    return {
      success: true,
      data: products
    };
  }
}