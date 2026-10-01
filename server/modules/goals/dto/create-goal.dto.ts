import { IsString, IsOptional, IsIn, Length } from 'class-validator';
import type { CreateGoalRequest, PillarKey } from '@shared/api.interface';

const PILLAR_KEYS: PillarKey[] = ['cognition', 'meaning', 'energy', 'relation', 'value'];

export class CreateGoalDto implements CreateGoalRequest {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(PILLAR_KEYS)
  pillar?: PillarKey | null;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;
}
