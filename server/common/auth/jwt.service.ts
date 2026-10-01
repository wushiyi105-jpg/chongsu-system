import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret-change-me'; // 生产必须通过 JWT_SECRET 覆盖
const JWT_EXPIRES_IN = '30d';

export interface JwtPayload {
  userId: string;
  phone: string;
}

@Injectable()
export class JwtService {
  sign(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verify(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}
