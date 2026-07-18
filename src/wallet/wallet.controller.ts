import { Controller, Get, Post, Body, UseGuards, Req, Param, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UserRole } from 'src/users/user-role.enum';
import { Roles } from 'src/auth/roles.decorator';
import { WithdrawalStatus } from './entities/withdrawal.entity';
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getBalance(@Req() req) {
    return this.walletService.getWalletData(req.user.id);
  }

  @Get('transactions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getTransactions(@Req() req) {
    return this.walletService.getTransactions(req.user.id);
  }

  @Post('withdraw')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async withdraw(@Req() req, @Body() dto: CreateWithdrawalDto) {
    return this.walletService.requestWithdrawal(req.user.id, dto);
  }

  @Get('admin/withdrawals')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN) // Only Admins can see this
  async getAllWithdrawals(@Query('status') status?: WithdrawalStatus) {
    return this.walletService.findAllWithdrawals(status);
  }

  // POST: Trigger the Paystack transfer and approve the withdrawal
  @Post('admin/withdrawals/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async approveWithdrawal(@Param('id') id: string) {
    
    return this.walletService.processWithdrawal(id);
  }

}