import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, UserController],
  providers: [AuthService],
})
export class AuthModule {}
