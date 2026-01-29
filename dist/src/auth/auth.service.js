"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        if (registerDto.password !== registerDto.confirmPassword) {
            throw new common_1.BadRequestException('Las contraseñas no coinciden');
        }
        const existingDocumento = await this.prisma.user.findUnique({
            where: { documento: registerDto.documento },
        });
        if (existingDocumento) {
            throw new common_1.ConflictException('El documento ya está registrado');
        }
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: registerDto.email },
        });
        if (existingEmail) {
            throw new common_1.ConflictException('El email ya está registrado');
        }
        const existingTelefono = await this.prisma.user.findUnique({
            where: { telefono: registerDto.telefono },
        });
        if (existingTelefono) {
            throw new common_1.ConflictException('El teléfono ya está registrado');
        }
        const passwordHash = await bcrypt.hash(registerDto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                documento: registerDto.documento,
                nombre: registerDto.nombre,
                apellido: registerDto.apellido,
                genero: registerDto.genero,
                email: registerDto.email,
                telefono: registerDto.telefono,
                passwordHash,
                ciudad: registerDto.ciudad,
                fotoUrl: registerDto.fotoUrl,
                estado: 'NO_VERIFICADO',
                emailVerificado: false,
            },
        });
        const jugadorRole = await this.prisma.role.findUnique({
            where: { nombre: 'jugador' },
        });
        if (jugadorRole) {
            await this.prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: jugadorRole.id,
                },
            });
        }
        const verificationToken = this.generateRandomToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await this.prisma.emailVerification.create({
            data: {
                userId: user.id,
                token: verificationToken,
                expiresAt,
            },
        });
        console.log('🔗 Token de verificación:', verificationToken);
        console.log('📧 Enviar email a:', user.email);
        return {
            message: '¡Registro exitoso! Verifica tu email para activar tu cuenta',
            userId: user.id,
            verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
        };
    }
    async login(loginDto) {
        const user = await this.prisma.user.findUnique({
            where: { documento: loginDto.documento },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales incorrectas');
        }
        if (!user.emailVerificado) {
            throw new common_1.UnauthorizedException('Debes verificar tu email antes de iniciar sesión');
        }
        if (user.estado !== 'ACTIVO') {
            if (user.estado === 'INACTIVO') {
                throw new common_1.UnauthorizedException('Tu cuenta ha sido desactivada. Contacta al administrador');
            }
            if (user.estado === 'SUSPENDIDO') {
                throw new common_1.UnauthorizedException('Tu cuenta está suspendida temporalmente');
            }
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Credenciales incorrectas');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { ultimaSesion: new Date() },
        });
        const payload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);
        return {
            accessToken,
            user: {
                id: user.id,
                documento: user.documento,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                genero: user.genero,
                ciudad: user.ciudad,
                fotoUrl: user.fotoUrl,
                esPremium: user.esPremium,
                roles: user.roles.map((ur) => ur.role.nombre),
            },
        };
    }
    async verifyEmail(token) {
        const verification = await this.prisma.emailVerification.findUnique({
            where: { token },
        });
        if (!verification) {
            throw new common_1.BadRequestException('Token de verificación inválido');
        }
        if (verification.expiresAt < new Date()) {
            throw new common_1.BadRequestException('El token de verificación ha expirado');
        }
        await this.prisma.user.update({
            where: { id: verification.userId },
            data: {
                emailVerificado: true,
                estado: 'ACTIVO',
            },
        });
        await this.prisma.emailVerification.delete({
            where: { id: verification.id },
        });
        return {
            message: '¡Email verificado exitosamente! Ya puedes iniciar sesión',
        };
    }
    generateRandomToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map