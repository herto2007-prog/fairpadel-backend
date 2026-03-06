import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RoleName, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    // Check if documento exists
    const existingDocumento = await this.prisma.user.findUnique({
      where: { documento: dto.documento },
    });

    if (existingDocumento) {
      throw new ConflictException('El documento ya está registrado');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user with jugador role
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        documento: dto.documento,
        telefono: dto.telefono,
        status: UserStatus.ACTIVO,
        roles: {
          create: {
            role: {
              connect: { name: RoleName.jugador },
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Generate token (using documento as identifier)
    const token = this.generateToken(user.id, user.documento);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        documento: user.documento,
        roles: user.roles.map((ur) => ur.role.name),
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user by documento (C.I. Paraguaya)
    const user = await this.prisma.user.findUnique({
      where: { documento: dto.documento },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Check user status
    if (user.status === UserStatus.INACTIVO || user.status === UserStatus.SUSPENDIDO) {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    // Generate token (using documento as identifier)
    const token = this.generateToken(user.id, user.documento);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        documento: user.documento,
        roles: user.roles.map((ur) => ur.role.name),
      },
    };
  }

  private generateToken(userId: string, documento: string): string {
    const payload = { sub: userId, documento };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION'),
    });
  }
}
