import { IsString, IsIn, IsOptional, IsArray, ArrayUnique, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  CreateFragmentRequest,
  FragmentType,
  PillarKey,
} from '@shared/api.interface';

export class CreateFragmentDto implements CreateFragmentRequest {
  @IsOptional()
  @IsString()
  @IsIn(['text', 'link', 'voice'])
  @Type(() => String)
  type?: FragmentType;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  rawUrl?: string | null;

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
  audioUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Type(() => String)
  tagIds?: string[];

  @IsOptional()
  @IsObject({ each: true })
  @Type(() => Object)
  images?: Array<{ url: string; width?: number; height?: number; size?: number }>;
}
