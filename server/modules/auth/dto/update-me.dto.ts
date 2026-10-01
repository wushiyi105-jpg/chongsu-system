import { IsOptional, IsString } from 'class-validator';
import type { UpdateMeRequest } from '@shared/api.interface';

export class UpdateMeDto implements UpdateMeRequest {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
