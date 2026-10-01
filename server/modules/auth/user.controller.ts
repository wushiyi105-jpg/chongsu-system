import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { UserInfo } from '@shared/api.interface';
import { AuthGuard } from '@server/common/auth/auth.guard';
import { CurrentUser } from '@server/common/auth/current-user.decorator';
import { AuthService } from './auth.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Controller('api')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(
    @CurrentUser() user: { userId: string; phone: string },
  ): Promise<UserInfo> {
    return this.authService.getMe(user.userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: { userId: string; phone: string },
    @Body() dto: UpdateMeDto,
  ): Promise<UserInfo> {
    return this.authService.updateMe(user.userId, dto);
  }
}
