import { IsString, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import type { UpdateFragmentRequest } from '@shared/api.interface';

export class UpdateFragmentDto implements UpdateFragmentRequest {
  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsObject({ each: true })
  @Type(() => Object)
  images?: Array<{ url: string; width?: number; height?: number; size?: number }>;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  cover?: string | null;

  @IsOptional()
  @IsString()
  rawUrl?: string | null;

  @IsOptional()
  @IsString()
  audioUrl?: string | null;
}
