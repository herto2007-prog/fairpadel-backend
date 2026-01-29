import { IsNotEmpty, IsString } from 'class-validator';

export class SeguirDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}