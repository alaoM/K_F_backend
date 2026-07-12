import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // The handleRequest method determines what happens after the strategy is executed
  handleRequest(err, user, info, context) {
    // If there is an error (expired token, etc) or no user, 
    // we simply return null instead of throwing an UnauthorizedException.
    if (err || !user) {
      return null;
    }
    
    // If the token is valid, req.user will be populated normally.
    return user;
  }
}