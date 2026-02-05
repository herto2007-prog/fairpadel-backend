import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getByDocumento(documento: string): Promise<{
        id: string;
        documento: string;
        nombre: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        fotoUrl: string;
    }>;
    obtenerPerfil(id: string): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        ciudad: string;
        bio: string;
        fotoUrl: string;
        esPremium: boolean;
    }>;
    actualizarPerfil(id: string, data: any, req: any): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        documento: string;
        email: string;
        telefono: string;
        apellido: string;
        genero: import(".prisma/client").$Enums.Gender;
        passwordHash: string;
        fechaNacimiento: Date | null;
        ciudad: string | null;
        bio: string | null;
        fotoUrl: string | null;
        estado: import(".prisma/client").$Enums.UserStatus;
        emailVerificado: boolean;
        esPremium: boolean;
        ultimaSesion: Date | null;
        updatedAt: Date;
    }>;
}
