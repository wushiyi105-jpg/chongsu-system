import { IsString } from 'class-validator';
import type { ParseLinkRequest } from '@shared/api.interface';

export class ParseLinkDto implements ParseLinkRequest {
  @IsString()
  url!: string;
}
