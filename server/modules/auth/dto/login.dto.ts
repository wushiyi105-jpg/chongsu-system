import { IsString, Length } from 'class-validator';
import type { LoginRequest } from '@shared/api.interface';

export class LoginDto implements LoginRequest {
  @IsString()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
