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
import { AuthGuard } from '@nestjs/passport';
import { SellerService } from './seller.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRole } from 'src/users/user-role.enum';
import { Roles, ROLES_KEY } from 'src/auth/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AddBankDto } from './dto/add-bank.dto';


@Controller('seller')
@UseGuards(JwtAuthGuard)
export class SellerController {
  constructor(private readonly sellerService: SellerService) { }

  /* ---------------- CREATE STORE ---------------- */
  @Post()
  
  create(@Req() req, @Body() dto: CreateSellerDto) {

    return this.sellerService.create(req.user.sub, dto);
  }

  @Get('analytics')
 @Roles(UserRole.SELLER)
async getAnalytics(@Req() req: any) {
   return this.sellerService.getSellerStats(req.user.sub);
}

  /* ---------------- UPDATE MY STORE ---------------- */
  @Patch('me')
  updateMyStore(@Req() req, @Body() dto: UpdateSellerDto) {
    return this.sellerService.update(req.user.sub, dto);
  }

  /* ---------------- GET MY STORE ---------------- */
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('me')
  getMyStore(@Req() req) {
    return this.sellerService.getMyStore(req.user.sub);
  }

  /* ---------------- DELETE MY STORE (SOFT) ---------------- */
  @Delete('me')
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/suspend')
  suspendStore(@Param('id') id: string) {
    return this.sellerService.suspend(id);
  }

  /* ---------------- ADMIN: UNSUSPEND STORE ---------------- */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/unsuspend')
  unsuspendStore(@Param('id') id: string) {
    return this.sellerService.unsuspend(id);
  }

  /* ---------------- SELLER: BANK ---------------- */
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @Post('banks')
  async addBank(
     @Req() req: any,
      @Body() dto: AddBankDto) {

    return this.sellerService.addBank(req.user.sub, dto);
  }

  @Get('banks')
  async getMyBanks(@Req() req) {
    return this.sellerService.findAllBanks(req.user.sub);
  }

  @Patch('banks/:bankId/primary')
  async setPrimary(@Req() req, @Param('bankId') bankId: string) {
    return this.sellerService.setPrimary(req.user.sub, bankId);
  }

  @Delete('banks/:bankId')
  async removeBank(@Req() req, @Param('bankId') bankId: string) {
    return this.sellerService.removeBank(req.user.sub, bankId);
  }



  /* ---------------- PUBLIC: GET SINGLE STORE ---------------- */
@Get(':slug')
getStore(@Param('slug') slug: string) {
  return this.sellerService.getPublicStore(slug);
}
}
