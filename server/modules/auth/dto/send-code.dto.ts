import { IsString, IsNotEmpty } from 'class-validator';
import type { SendCodeRequest } from '@shared/api.interface';

export class SendCodeDto implements SendCodeRequest {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
