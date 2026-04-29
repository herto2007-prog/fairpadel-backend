import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return (super.canActivate(context) as Promise<any>).catch(() => true);
  }

  handleRequest(err: any, user: any) {
    return user || null;
  }
}
