import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { OnboardUserDto } from './dto/onbaord-user.dto';
import { UserRole } from './user-role.enum';
import { MailserviceService } from 'src/mailservice/mailservice.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly mailService: MailserviceService,
  ) { }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, password: hashedPassword });
    return this.userRepo.save(user);
  }

  async onboardUser(id: string, dto: OnboardUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Prevent re-onboarding
    if (user.isOnboarded) {
      throw new ConflictException('User has already completed onboarding');
    }

    // Assign ONLY safe profile fields
    user.phoneNumber = dto.phoneNumber;
    user.address = dto.address;
    user.location = dto.location;
    user.role = dto.role;

    
    // Lock onboarding
    user.isOnboarded = true;

    return this.userRepo.save(user);
  }


  // Used by Admin or for Profile lookup
  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id,
       deletedAt: null,
     } });
    
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findmyProfile(id: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id,
       deletedAt: null,
     }, relations: ['sellerProfile'], select: [
            'id', 'email', 'role', 'fullName', 'userAvatar', 
            'businessName', 'phoneNumber', 'address', 
            'location', 'lifetimeSalesVolume',  
             'isTwoFactorEnabled', 'isVerified', 

            'isOnboarded', 'status', 'createdAt'
        ] 
    });

    if (!user) throw new NotFoundException('User not found');
    
    return {
      ...user,
      hasCreatedStore: !!user.sellerProfile,
    };
  }


  async changePassword(id: string, dto: ChangePasswordDto) {
    // 1. Fetch user with password field (since it's usually excluded)
    const user = await this.findForAuth({ id });
    
    // 2. Verify old password
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
        throw new BadRequestException('The current password you entered is incorrect.');
    }

    // 3. Hash and Save new password
    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.save(user);

    return { success: true, message: 'Password updated successfully' };
}




  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    role?: UserRole,
    status?: string,
  ) {
    const query = this.userRepo.createQueryBuilder('user');

    query.select([
      'user.id',
      'user.email',
      'user.fullName',
      'user.role',
      'user.createdAt',
      'user.phoneNumber',
      'user.lifetimeSalesVolume',
      'user.location',
      'user.isEmailVerified',
      'user.isVerified',
      'user.isOnboarded',
      'user.isTwoFactorEnabled',
      'user.status',
      'user.isSuspended',
      'user.deletedAt'
    ]);

    if (search) {
      query.andWhere(
        `(LOWER(user.email) LIKE LOWER(:search)
        OR LOWER(user.fullName) LIKE LOWER(:search))`,
        { search: `%${search}%` }
      );
    }

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (status) {
      query.andWhere('user.status = :status', { status });
    }

    query
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }


  async findByEmailVerificationToken(hashedToken: string) {
    return this.userRepo.findOne({
      where: {
        verificationToken: hashedToken,
         deletedAt: null,
      },
    });
  }
  async markEmailAsVerified(userId: string) {
    await this.userRepo.update(userId, {
      isEmailVerified: true,
      verificationToken: null,
      verificationExpires: null,
    });
  }



  // Internal helper for Auth (includes hidden fields)
  async findForAuth(criteria: { email?: string; id?: string }): Promise<User | null> {

    const { email, id } = criteria; if (!email && !id) {
      return null;
    }

    const query = this.userRepo.createQueryBuilder('user')
      // 2. Select hidden sensitive fields
      .addSelect([
        'user.password',
        'user.hashedRefreshToken',
        'user.twoFactorSecret',
        'user.passwordResetToken',
        'user.passwordResetExpires',
      ]);

    // 3. Dynamically build the WHERE clause
    if (email) {
      query.where('user.email = :email', { email });
    }

    if (id) {
      // If email was already added, use orWhere; otherwise use where
      if (email) {
        query.orWhere('user.id = :id', { id });
      } else {
        query.where('user.id = :id', { id });
      }
    }

    return query.getOne();
  }

  async updateRefreshToken(userId: string, token: string | null) {
    const hashed = token ? await bcrypt.hash(token, 10) : null;
    await this.userRepo.update(userId, { hashedRefreshToken: hashed });
  }

  async setPasswordResetAttributes(userId: string, hashedToken: string, expires: Date) {
    await this.userRepo.update(userId, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });
  }

  async finalizePasswordReset(userId: string, hashedPass: string) {
    await this.userRepo.update(userId, {
      password: hashedPass,
      passwordResetToken: null,
      passwordResetExpires: null,
      hashedRefreshToken: null, // Logout all sessions for security
    });
  }

  async update2FASecret(userId: string, secret: string | null, enable: boolean) {
    await this.userRepo.update(userId, {
      twoFactorSecret: secret,
      isTwoFactorEnabled: enable,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

async remove(
  userId: string,
  adminId: string,
  reason?: string,
): Promise<void> {
  const user = await this.userRepo.findOne({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundException('User not found or already deleted');
  }

  user.deletedAt = new Date();
  user.deletedBy = adminId;
  user.deleteReason = reason ?? null;

  await this.userRepo.save(user);
}

async restoreUser(userId: string, adminId:string): Promise<void> {
  const user = await this.userRepo.findOne({
    where: { id: userId },
    withDeleted: true,
  });

  if (!user || !user.deletedAt) {
    throw new NotFoundException('User is not deleted');
  }

  user.deletedAt = null;
  user.deletedBy = null;
  user.deleteReason = null;
  user.restoredBy = adminId

  await this.userRepo.save(user);
}

  async setEmailVerificationAttributes(
    userId: string,
    token: string,
    expires: Date,
  ) {
    await this.userRepo.update(userId, {
      verificationToken: token,
      verificationExpires: expires,
    });
  }

  async suspendUser(id: string) {
  return this.userRepo.update(id, {
    isSuspended: true,
    status: 'suspended',
  });
}

async activateUser(id: string) {
  return this.userRepo.update(id, {
    isSuspended: false,
    status: 'active',
  });
}

async getVerificationQueue() {
    return this.userRepo.find({
        where: {
            /*  role: In([UserRole.SELLER, UserRole.CREATOR]),  */
             role:  UserRole.SELLER,  // Only show Sellers for now
            isOnboarded: true,   // Must have filled farm info
            isVerified: false,   // Not yet approved
            isSuspended: false
        },
        order: { createdAt: 'ASC' } 
    });
}

async verifySeller(id: string, adminId: string) {
    const user = await this.findOne(id);
    
    user.isVerified = true;
    user.status = 'active';
    user.verifiedBy = adminId; // to track which admin approved
    
    await this.userRepo.save(user);

    // Trigger Email Notification
      await this.mailService.sendSellerApprovalEmail(user.email, user.fullName);  

    return { success: true, message: `Seller ${user.fullName} verified.` };
}

async rejectVerification(id: string, reason: string) {
    const user = await this.findOne(id);
    
    // 2. Logic for rejection
    user.isVerified = false;
    user.isOnboarded = false; // Reset onboarding so they can fix their details
    user.rejectionReason = reason;
    user.status = 'rejected'; 

    await this.userRepo.save(user);

    // 3. Trigger Rejection Email
    await this.mailService.sendRejectionEmail(user.email, user.fullName, reason);

    return { success: true, message: 'User verification rejected and notified.' };
}
 
}