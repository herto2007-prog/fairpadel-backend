import { IsString, IsObject, IsOptional, IsUUID } from 'class-validator';

export class SendNotificationDto {
  @IsUUID()
  userId: string;

  @IsString()
  template: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;
}
