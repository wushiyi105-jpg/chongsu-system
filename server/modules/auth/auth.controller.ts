import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { LoginResponse, SendCodeResponse } from '@shared/api.interface';
import { AuthService } from './auth.service';
import { SendCodeDto } from './dto/send-code.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard, AUTH_COOKIE_NAME } from '@server/common/auth/auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto): Promise<SendCodeResponse> {
    return this.authService.sendCode(dto.phone);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { token, user, isNewUser } = await this.authService.login(
      dto.phone,
      dto.code,
    );
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return { token, user, isNewUser };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }
}
