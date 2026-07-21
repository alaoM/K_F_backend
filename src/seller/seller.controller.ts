// src/sellers/seller.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SellerService } from './seller.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/users/user-role.enum';
import { Roles } from 'src/auth/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AddBankDto } from './dto/add-bank.dto';

@Controller('seller')
export class SellerController {
  constructor(private readonly sellerService: SellerService) { }

  /* ---------------- CREATE STORE ---------------- */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req, @Body() dto: CreateSellerDto) {
    return this.sellerService.create(req.user.sub, dto);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async getAnalytics(@Req() req: any) {
    return this.sellerService.getSellerStats(req.user.sub);
  }

  /* ---------------- UPDATE MY STORE ---------------- */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMyStore(@Req() req, @Body() dto: UpdateSellerDto) {
    return this.sellerService.update(req.user.sub, dto);
  }

  /* ---------------- GET MY STORE ---------------- */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyStore(@Req() req) {
    return this.sellerService.getMyStore(req.user.sub);
  }

  /* ---------------- DELETE MY STORE (SOFT) ---------------- */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMyStore(@Req() req) {
    return this.sellerService.softDelete(req.user.id);
  }

  /* ---------------- PUBLIC: GET ALL STORES ---------------- */
  @Get()
  getAllStores(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.sellerService.getAllStores(+page, +limit);
  }

  /* ---------------- ADMIN: SUSPEND STORE ---------------- */
  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  suspendStore(@Param('id') id: string) {
    return this.sellerService.suspend(id);
  }

  /* ---------------- ADMIN: UNSUSPEND STORE ---------------- */
  @Patch(':id/unsuspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  unsuspendStore(@Param('id') id: string) {
    return this.sellerService.unsuspend(id);
  }

  /* ---------------- SELLER: BANK ---------------- */
  @Post('banks')
  @UseGuards(JwtAuthGuard)
  async addBank(
    @Req() req: any,
    @Body() dto: AddBankDto,
  ) {
    return this.sellerService.addBank(req.user.sub, dto);
  }

  @Get('banks')
  @UseGuards(JwtAuthGuard)
  async getMyBanks(@Req() req) {
    return this.sellerService.findAllBanks(req.user.sub);
  }

  @Patch('banks/:bankId/primary')
  @UseGuards(JwtAuthGuard)
  async setPrimary(@Req() req, @Param('bankId') bankId: string) {
    return this.sellerService.setPrimary(req.user.sub, bankId);
  }

  @Delete('banks/:bankId')
  @UseGuards(JwtAuthGuard)
  async removeBank(@Req() req, @Param('bankId') bankId: string) {
    return this.sellerService.removeBank(req.user.sub, bankId);
  }

  /* ---------------- PUBLIC: GET SINGLE STORE ---------------- */
  @Get(':slug')
  getStore(@Param('slug') slug: string) {
    return this.sellerService.getPublicStore(slug);
  }
}
