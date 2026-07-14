import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MailserviceService } from 'src/mailservice/mailservice.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailserviceService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) { }

  /**
   * Register a new user
   */
  async onBoardUser(userId: string, dto: any) {
    
    this.logger.log(`Onboarding user ID: ${userId}`);
    const user = await this.usersService.onboardUser(userId, dto);

   

    this.logger.log(`User onboarded successfully: ${user.email} (ID: ${user.id})`);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isOnboarded: user.isOnboarded,
    };
  }


  async register(dto: any) {
    const user = await this.usersService.create(dto);

    this.logger.log(`User registered successfully: ${user.email} (ID: ${user.id})`);

    // 1. Generate verification token (RAW)
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash token for storage
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // 3. Store hashed token + expiry
    await this.usersService.setEmailVerificationAttributes(
      user.id,
      hashedToken,
      new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    );

   

    // 4. Build verification URL
    const baseUrl = this.config.get<string>('FRONTEND_URL');
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    console.log("Verification URL:", verificationUrl);

    // 5. Send welcome email
    try {
      await this.mailService.sendUserWelcome(
        {
          email: user.email,
          fullName: user.fullName,
        },
        verificationUrl,
      );
    } catch (e) {
      this.logger.error(
        `Post-registration email failed for ${user.email}`,
        e.stack,
      );
    }

    // 6. Issue tokens (user still blocked by isVerified in login)
    const tokens = await this.issueTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isOnboarded: user.isOnboarded,
      },
      ...tokens,
    };
  }


  /**
   * Resend verification email
   */
 async resendVerificationEmail(email?: string, token?: string) {
  let user;
 

  // 1️⃣ Identify user
  if (token) {
    user = await this.findUserByVerificationToken(token);
    if (!user) {
      this.logger.warn(`Invalid or expired verification token used`);
      throw new NotFoundException('Invalid or expired verification link.');
    }
  } else if (email) {
    this.logger.log(`Request to resend verification email for: ${email}`);
    user = await this.usersService.findForAuth({ email });
    if (!user) {
      // Security: don't reveal if email exists
      this.logger.warn(`Resend failed: User ${email} not found`);
      return; // silently succeed
    }
  } else {
    throw new BadRequestException('Email or token must be provided');
  }

  // 2️⃣ Check if user is already verified
  if (user.isVerified) {
    this.logger.warn(`Resend skipped: User ${user.email} is already verified`);
    return; // silently succeed
  }

  // 3️⃣ Generate new verification token only if not using valid token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // 4️⃣ Store hashed token + expiry (overwrite existing)
  await this.usersService.setEmailVerificationAttributes(
    user.id,
    hashedToken,
    new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
  );

  // 5️⃣ Build verification URL
  const baseUrl = this.config.get<string>('FRONTEND_URL');
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

  console.log("Verification URL:", verificationUrl);

  // 6️⃣ Send verification email
  try {
    await this.mailService.sendUserWelcome(
      {
        email: user.email,
        fullName: user.fullName,
      },
      verificationUrl,
    );
    this.logger.log(`Verification email sent to ${user.email}`);
  } catch (e) {
    this.logger.error(
      `Failed to send verification email to ${user.email}`,
      e.stack,
    );
  }
}

private async findUserByVerificationToken(token: string) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return this.usersService.findByEmailVerificationToken(hashedToken);
}

  /**
   * Login user
   */
  async login(email: string, pass: string) {
    this.logger.log(`Login attempt: ${email}`);

    const user = await this.usersService.findForAuth({ email });

    // 1. Credentials check
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      this.logger.warn(`Invalid login credentials for: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  

    const userResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isOnboarded: user.isOnboarded,
    };

    // 2. Email verification gate
    if (!user.isEmailVerified) {
      this.logger.warn(`Unverified email login attempt: ${email}`);
      return {
        user: userResponse,
        message: 'Verification required',
      };
    }

    // 3. Onboarding gate
    if (!user.isOnboarded) {
      const tokens = await this.issueTokens(user);
      this.logger.warn(`Unonboarded profile login attempt: ${email}`);
      const { accessToken: n } = tokens;
      return {
        user: userResponse,
        accessToken: n,
        message: 'Onboarding required',
      };
    }

    // 4. MFA gate (last check before tokens)
    if (user.isTwoFactorEnabled) {
    
      this.logger.log(`MFA challenge issued for: ${email}`);
      return {
        mfaRequired: true,
        userId: user.id,
      };
    }

    // 5. Issue tokens
    this.logger.log(`Full login successful: ${email}`);
    const tokens = await this.issueTokens(user);

    // 6. Persist refresh token hash
    await this.usersService.updateRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    return {
      user: userResponse,
      ...tokens,
    };
  }


  /**
   * Verify 2FA code
   */
  async verify2FAAndLogin(userId: string, code: string) {
    const dbUser = await this.usersService.findForAuth({ id: userId });

    const isValid = authenticator.verify({
      token: code,
      secret: dbUser.twoFactorSecret,
    });

    if (!isValid) {
      this.logger.warn(`Invalid 2FA code provided for User ID: ${userId}`);
      throw new UnauthorizedException('Invalid 2FA code');
    }

    this.logger.log(`2FA verified for User ID: ${userId}`);
    const tokens = await this.issueTokens(dbUser);
    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        isVerified: dbUser.isVerified,
        isOnboarded: dbUser.isOnboarded,
      },
      ...tokens,
    };
  }

  /**
   * Token Refresh Logic (with Theft Detection)
   */
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findForAuth({ email: payload.email });
      if (!user || !user.hashedRefreshToken) throw new UnauthorizedException();

      const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);

      if (!isMatch) {
        this.logger.error(`CRITICAL: Potential Token Reuse/Theft detected for User: ${user.email}`);
        await this.usersService.updateRefreshToken(user.id, null);
        throw new ForbiddenException('Access denied');
      }

      this.logger.log(`Tokens rotated for User: ${user.email}`);
      return this.issueTokens(user);
    } catch (e) {
      this.logger.warn(`Refresh attempt failed with invalid token`);
      throw new UnauthorizedException();
    }
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    // 1. Hash incoming token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');


    // 2. Find user by hashed token
    const user = await this.usersService.findByEmailVerificationToken(hashedToken);

    if (!user) {
      this.logger.warn('Invalid email verification token');
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    // 3. Check expiry
    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      this.logger.warn(`Expired email verification token for user: ${user.email}`);
      throw new UnauthorizedException('Verification token has expired');
    }

    // 4. Prevent double verification
    if (user.isEmailVerified) {
      throw new ConflictException('Email already verified');
    }

    // 5. Activate user
    await this.usersService.markEmailAsVerified(user.id);

    this.logger.log(`Email successfully verified for user: ${user.email}`);

    return {
      message: 'Email verified successfully',
      isVerified: true,
    };
  }


  /**
   * Forgot Password
   */
  async forgotPassword(email: string) {
    const user = await this.usersService.findForAuth({ email });
    if (!user) {
      this.logger.warn(`Forgot password request for non-existent email: ${email}`);
      return { message: 'If the email exists, a reset link was sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await this.usersService.setPasswordResetAttributes(
      user.id,
      hashedToken,
      new Date(Date.now() + 15 * 60 * 1000),
    );
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const url = `${baseUrl}/reset-password?q=${resetToken}&email=${encodeURIComponent(user.email)}`;

      console.log(url);
      await this.mailService.sendPasswordReset(user, url);
      this.logger.log(`Password reset email sent to: ${email}`);
    } catch (e) {
      this.logger.error(`Failed to send password reset email to ${email}`, e.stack);
    }

    return { message: 'If the email exists, a reset link was sent' };
  }

  /**
   * Reset Password
   */
  async resetPassword(email: string, token: string, newPass: string) {
    const user = await this.usersService.findForAuth({ email });



    if (!user || !user.passwordResetToken || user.passwordResetExpires < new Date()) {
      this.logger.warn(`Invalid or expired password reset attempt for: ${email}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const isValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!isValid) {
      this.logger.warn(`Invalid password reset token provided for: ${email}`);
      throw new UnauthorizedException('Invalid token');
    }

    const hashedPass = await bcrypt.hash(newPass, 12);
    await this.usersService.finalizePasswordReset(user.id, hashedPass);
    this.logger.log(`Password successfully reset for: ${email}`);
  }

  /**
   * Enable 2FA (Initiate)
   */
  async enable2FA(userId: string) {
    const user = await this.usersService.findOne(userId);
    const secret = authenticator.generateSecret();

    await this.usersService.update2FASecret(userId, secret, false);
    this.logger.log(`MFA initiation started for user: ${user.email}`);

    const appName = this.config.get('APP_NAME') || 'Bleefy';
    return {
      otpauthUrl: authenticator.keyuri(user.email, appName, secret),
      secret,
    };
  }

  // Authenticate the 2FA
async authenticate2FA(userId: string, code: string) {
    const user = await this.usersService.findForAuth({ id: userId });
 
    const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
    });

    if (!isValid) throw new UnauthorizedException('Invalid verification code');

    // Issue real tokens now that 2FA is passed
    const tokens = await this.issueTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            isOnboarded: user.isOnboarded,
        },
        ...tokens,
    };
}

  /**
   * Confirm 2FA (Activate)
   */
  async confirm2FA(userId: string, code: string) {
    const user = await this.usersService.findForAuth({ id: userId });

    if (!user.twoFactorSecret) {
      throw new BadRequestException('MFA not initiated');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      this.logger.warn(`Failed MFA confirmation attempt for User ID: ${userId}`);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.usersService.update2FASecret(userId, user.twoFactorSecret, true);
    this.logger.log(`MFA officially enabled for User ID: ${userId}`);
    return { success: true };
  }

  /**
   * Issue JWT Access and Refresh Tokens
   */
  private async issueTokens(user: any) {
    const payload = { sub: user.id, id: user.id, email: user.email, role: user.role };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: '1d',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    await this.usersService.updateRefreshToken(user.id, rt);
    return { accessToken: at, refreshToken: rt };
  }

  /**
   * Logout
   */
  async logout(userId: string) {
    this.logger.log(`User logged out: ${userId}`);
    await this.usersService.updateRefreshToken(userId, null);
  }

   
}