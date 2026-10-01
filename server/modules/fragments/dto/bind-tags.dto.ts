import { IsArray, ArrayUnique, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { BindTagsRequest } from '@shared/api.interface';

export class BindTagsDto implements BindTagsRequest {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Type(() => String)
  tagIds!: string[];
}
