import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from 'src/users/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Admins can bypass standard seller role guards if needed, or we check membership
    if (user.role === UserRole.ADMIN) return true;

    // If seller role is required, ensure seller profile is verified/active
    if (requiredRoles.includes(UserRole.SELLER)) {
      if (user.role !== UserRole.SELLER || !user.isVerified) {
        throw new ForbiddenException('Your seller account must be verified by an admin to access this resource.');
      }
    }

    return requiredRoles.includes(user.role);
  }
}
