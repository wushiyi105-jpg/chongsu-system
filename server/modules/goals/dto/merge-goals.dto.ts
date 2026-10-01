import { IsString, IsNotEmpty } from 'class-validator';
import type { MergeGoalsRequest } from '@shared/api.interface';

export class MergeGoalsDto implements MergeGoalsRequest {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  targetId!: string;
}
