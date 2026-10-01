import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, gt } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import type {
  LoginResponse,
  SendCodeResponse,
  UserInfo,
  UpdateMeRequest,
} from '@shared/api.interface';
import { users, smsCodes } from '@server/database/schema';
import { JwtService } from '@server/common/auth/jwt.service';

type UserRow = typeof users.$inferSelect;

function toUserInfo(row: UserRow): UserInfo {
  return {
    id: row.id,
    phone: row.phone,
    nickname: row.nickname ?? null,
    avatarUrl: row.avatarUrl ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly jwtService: JwtService,
  ) {}

  async sendCode(phone: string): Promise<SendCodeResponse> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const recent = await this.db
      .select()
      .from(smsCodes)
      .where(eq(smsCodes.phone, phone))
      .orderBy(desc(smsCodes.createdAt))
      .limit(1);

    if (recent.length > 0 && recent[0].createdAt > oneMinuteAgo) {
      throw new BadRequestException('验证码发送过于频繁，请稍后再试');
    }

    const code = process.env.LOGIN_CODE || 'changeme'; // 生产环境请务必通过 LOGIN_CODE 环境变量配置
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.db.insert(smsCodes).values({
      phone,
      code,
      expiresAt,
    });

    this.logger.log(`验证码已发送 phone=${phone} devCode=${code}`);

    return {
      expiresIn: 300,
      devCode: code,
    };
  }

  async login(phone: string, code: string): Promise<LoginResponse> {
    const isDevCode = process.env.LOGIN_CODE ? code === process.env.LOGIN_CODE : false;

    if (!isDevCode) {
      const now = new Date();
      const latestCode = await this.db
        .select()
        .from(smsCodes)
        .where(
          and(
            eq(smsCodes.phone, phone),
            eq(smsCodes.used, false),
            gt(smsCodes.expiresAt, now),
          ),
        )
        .orderBy(desc(smsCodes.createdAt))
        .limit(1);

      if (latestCode.length === 0 || latestCode[0].code !== code) {
        throw new BadRequestException('验证码错误或已过期');
      }

      await this.db
        .update(smsCodes)
        .set({ used: true })
        .where(eq(smsCodes.id, latestCode[0].id));
    }

    const existingUsers = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    let isNewUser = false;
    let userRow: UserRow;

    if (existingUsers.length === 0) {
      const created = await this.db
        .insert(users)
        .values({ phone })
        .returning();
      userRow = created[0];
      isNewUser = true;
      this.logger.log(`新用户注册 phone=${phone} userId=${userRow.id}`);
    } else {
      userRow = existingUsers[0];
    }

    const token = this.jwtService.sign({
      userId: userRow.id,
      phone: userRow.phone,
    });

    return {
      token,
      user: toUserInfo(userRow),
      isNewUser,
    };
  }

  async getMe(userId: string): Promise<UserInfo> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return toUserInfo(result[0]);
  }

  async updateMe(
    userId: string,
    dto: UpdateMeRequest,
  ): Promise<UserInfo> {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (dto.nickname !== undefined) patch.nickname = dto.nickname;
    if (dto.avatarUrl !== undefined) patch.avatarUrl = dto.avatarUrl;

    if (Object.keys(patch).length === 0) {
      return this.getMe(userId);
    }

    patch.updatedAt = new Date();

    const updated = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return toUserInfo(updated[0]);
  }
}
