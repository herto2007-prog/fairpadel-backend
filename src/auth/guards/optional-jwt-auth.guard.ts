import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that optionally authenticates the user.
 * If a valid JWT is present, populates req.user.
 * If not, req.user = null (never throws).
 * Use for public endpoints that benefit from knowing the viewer.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || null;
  }
}
