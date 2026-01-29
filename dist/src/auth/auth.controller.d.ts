import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
}
