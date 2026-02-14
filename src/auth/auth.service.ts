import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Validar que las contraseñas coincidan
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    // Verificar que documento no exista
    const existingDocumento = await this.prisma.user.findUnique({
      where: { documento: registerDto.documento },
    });

    if (existingDocumento) {
      throw new ConflictException('El documento ya está registrado');
    }

    // Verificar que email no exista
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar que teléfono no exista
    const existingTelefono = await this.prisma.user.findUnique({
      where: { telefono: registerDto.telefono },
    });

    if (existingTelefono) {
      throw new ConflictException('El teléfono ya está registrado');
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Determinar categoría inicial
    let categoriaActualId = registerDto.categoriaActualId || null;
    if (!categoriaActualId) {
      const defaultCat = await this.prisma.category.findFirst({
        where: { orden: 8, tipo: registerDto.genero },
      });
      categoriaActualId = defaultCat?.id || null;
    }

    // Crear usuario
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
        categoriaActualId,
        estado: 'NO_VERIFICADO',
        emailVerificado: false,
      },
    });

    // Registrar asignación inicial de categoría
    if (categoriaActualId) {
      await this.prisma.historialCategoria.create({
        data: {
          userId: user.id,
          categoriaNuevaId: categoriaActualId,
          tipo: 'ASIGNACION_INICIAL',
          motivo: 'Categoría seleccionada al registrarse',
        },
      });
    }

    // Asignar rol de "jugador" por defecto
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

    // Crear token de verificación de email
    const verificationToken = this.generateRandomToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // TODO: Enviar email de verificación (lo haremos después)
    console.log('🔗 Token de verificación:', verificationToken);
    console.log('📧 Enviar email a:', user.email);

    return {
      message: '¡Registro exitoso! Verifica tu email para activar tu cuenta',
      userId: user.id,
      // En desarrollo, devolvemos el token (en producción NO)
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    };
  }

  async login(loginDto: LoginDto) {
    // Buscar usuario por documento
    const user = await this.prisma.user.findUnique({
      where: { documento: loginDto.documento },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        categoriaActual: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Verificar que el email esté verificado
    if (!user.emailVerificado) {
      throw new UnauthorizedException('Debes verificar tu email antes de iniciar sesión');
    }

    // Verificar que el usuario esté activo
    if (user.estado !== 'ACTIVO') {
      if (user.estado === 'INACTIVO') {
        throw new UnauthorizedException('Tu cuenta ha sido desactivada. Contacta al administrador');
      }
      if (user.estado === 'SUSPENDIDO') {
        throw new UnauthorizedException('Tu cuenta está suspendida temporalmente');
      }
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Actualizar última sesión
    await this.prisma.user.update({
      where: { id: user.id },
      data: { ultimaSesion: new Date() },
    });

    // Generar JWT token
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
        categoriaActualId: user.categoriaActualId,
        categoriaActual: user.categoriaActual,
        roles: user.roles.map((ur) => ur.role.nombre),
      },
    };
  }

  async verifyEmail(token: string) {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      throw new BadRequestException('Token de verificación inválido');
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('El token de verificación ha expirado');
    }

    // Actualizar usuario
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: {
        emailVerificado: true,
        estado: 'ACTIVO',
      },
    });

    // Eliminar token usado
    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    return {
      message: '¡Email verificado exitosamente! Ya puedes iniciar sesión',
    };
  }

  private generateRandomToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}