import { Body, Controller, Post, UseGuards, ClassSerializerInterceptor, UseInterceptors, HttpCode, HttpStatus, Patch, Param, Req, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { MfaDto } from './dto/mfa.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetCurrentUser } from './decorators/get-current-user.decorator';
import { ResetPasswordDto } from 'src/users/dto/reset-password.dto';
import { OnboardUserDto } from 'src/users/dto/onbaord-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Patch(':id/onboard')
  @UseGuards(AuthGuard('jwt'))
  async onboardUser(
    @Param('id') id: string,
    @Body() dto: OnboardUserDto,
    @Req() req: any,
  ) {

    

    // Ownership enforcement
    if (req.user.sub !== id) {
      throw new ForbiddenException('You can only onboard your own account');
    }

    return this.authService.onBoardUser(id, dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }



  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerificationEmail(@Body() dto: ResendVerificationDto) {
   
    return this.authService.resendVerificationEmail(dto.email, dto.token);
  }

  @Post('2fa/verify-login')
  @HttpCode(HttpStatus.OK)
  verify2FA(@Body() dto: MfaDto) {
    return this.authService.verify2FAAndLogin(dto.userId, dto.code);
  }

  /* ================== MFA SETUP (Authenticated) ================== */

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2FA(@GetCurrentUser('sub') userId: string) {
    return this.authService.enable2FA(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  confirm2FA(@GetCurrentUser('sub') userId: string, @Body('code') code: string) {
    return this.authService.confirm2FA(userId, code);
  }

 @Post('2fa/authenticate') 
async authenticate2FA(
    @Body('userId') userId: string, 
    @Body('code') code: string     
) {
    return this.authService.authenticate2FA(userId, code);
}


  /* ================== TOKEN & PASSWORD MGMT ================== */

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {

    return this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@GetCurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }
}