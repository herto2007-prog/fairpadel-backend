import { IsUUID } from 'class-validator';

export class RequestConsentDto {
  @IsUUID()
  userId: string;
}
