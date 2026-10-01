import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from './jwt.service';
import type { Request } from 'express';

export const AUTH_COOKIE_NAME = 'chongsu_auth_token';

export interface AuthRequest extends Request {
  user: {
    userId: string;
    phone: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authHeader = request.headers.authorization;
    const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];

    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    const payload = this.jwtService.verify(token);

    if (!payload) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    request.user = payload;
    return true;
  }
}
