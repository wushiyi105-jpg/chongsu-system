import { IsString, IsOptional, IsIn, IsBoolean, Length } from 'class-validator';
import type { UpdateGoalRequest, PillarKey } from '@shared/api.interface';

const PILLAR_KEYS: PillarKey[] = ['cognition', 'meaning', 'energy', 'relation', 'value'];

export class UpdateGoalDto implements UpdateGoalRequest {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(PILLAR_KEYS)
  pillar?: PillarKey | null;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
