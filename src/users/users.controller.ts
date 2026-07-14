import { Controller, Get, Body, Patch, Param, Delete, UseGuards, Req, ForbiddenException, ClassSerializerInterceptor, UseInterceptors, Query } from '@nestjs/common';
import { UsersService } from './users.service';

import { UserRole } from './user-role.enum';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll(+page, +limit, search, role, status);
  }

  @Get('me')
@UseGuards(JwtAuthGuard)
async getMe(@Req() req: any) {
  
  return this.usersService.findmyProfile(req.user.sub);
}
  


   // 1. SELF-UPDATE: For Buyers/Sellers to update their own profiles
    @Patch('profile')
  async updateSelf(@Req() req: any, @Body() dto: UpdateUserDto) {
    const userId = req.user.sub;
    
    // SECURITY: Prevent non-admins from changing their own role or verification status
    delete dto.role;
    // @ts-ignore
    delete dto.isVerified;
    
    return this.usersService.update(userId, dto);
  }

   //ADMIN-UPDATE: For Admins to update any user (including roles)
  @Patch(':id/admin-update')
  @Roles(UserRole.ADMIN)
  async adminUpdate(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/delete')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;

    await this.usersService.remove(id, adminId, reason);

    return {
      message: 'User soft-deleted successfully',
    };
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  async restore(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;

    await this.usersService.restoreUser(id, adminId);

    return {
      message: 'User soft-deleted successfully',
    };
  }

  @Patch('change-password') 
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.sub, dto);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.ADMIN)
  suspend(@Param('id') id: string) {
    return this.usersService.suspendUser(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    if (req.user.role !== UserRole.ADMIN && req.user.sub !== id) {
      throw new ForbiddenException();
    }
    return this.usersService.update(id, dto);
  }

  @Get('admin/verification-queue')
  @Roles(UserRole.ADMIN)
  async getQueue() {
    return this.usersService.getVerificationQueue();
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.usersService.verifySeller(id, req.user.sub);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.usersService.rejectVerification(id, reason);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    // Ownership Check: Allow if Admin OR if the ID matches the logged-in user
    if (req.user.role !== UserRole.ADMIN && req.user.sub !== id) {
      throw new ForbiddenException('Access to this profile is restricted');
    }
    return this.usersService.findOne(id);
  }

  
}