import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<{
        message: string;
        userId: string;
        verificationToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            documento: string;
            nombre: string;
            apellido: string;
            email: string;
            genero: import(".prisma/client").$Enums.Gender;
            ciudad: string;
            fotoUrl: string;
            esPremium: boolean;
            roles: string[];
        };
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    private generateRandomToken;
}
