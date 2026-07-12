import { UserRole } from 'src/users/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  id: string
}
