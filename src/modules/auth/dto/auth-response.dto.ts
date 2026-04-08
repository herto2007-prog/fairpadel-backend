import { UserStatus } from '@prisma/client';

export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    documento: string;
    estado: UserStatus;
    fotoUrl?: string;
    roles: string[];
  };
}
