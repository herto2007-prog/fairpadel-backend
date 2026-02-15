import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notificaciones/email.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════

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
    const verificationToken = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Enviar email de verificación
    try {
      await this.emailService.enviarEmailVerificacion(
        user.email,
        user.nombre,
        verificationToken,
      );
    } catch (e) {
      this.logger.error(`Error enviando email de verificación a ${user.email}: ${e.message}`);
    }

    return {
      message: '¡Registro exitoso! Verifica tu email para activar tu cuenta',
      userId: user.id,
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { documento: loginDto.documento },
      include: {
        roles: { include: { role: true } },
        categoriaActual: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!user.emailVerificado) {
      throw new UnauthorizedException('Debes verificar tu email antes de iniciar sesión');
    }

    if (user.estado !== 'ACTIVO') {
      if (user.estado === 'INACTIVO') {
        throw new UnauthorizedException('Tu cuenta ha sido desactivada. Contacta al administrador');
      }
      if (user.estado === 'SUSPENDIDO') {
        throw new UnauthorizedException('Tu cuenta está suspendida temporalmente');
      }
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
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
        telefono: user.telefono,
        genero: user.genero,
        ciudad: user.ciudad,
        fotoUrl: user.fotoUrl,
        fechaNacimiento: user.fechaNacimiento,
        bio: user.bio,
        esPremium: user.esPremium,
        categoriaActualId: user.categoriaActualId,
        categoriaActual: user.categoriaActual,
        roles: user.roles.map((ur) => ur.role.nombre),
      },
    };
  }

  // ═══════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ═══════════════════════════════════════════════════════

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token de verificación requerido');
    }

    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      throw new BadRequestException('Token de verificación inválido');
    }

    if (verification.expiresAt < new Date()) {
      // Limpiar token expirado
      await this.prisma.emailVerification.delete({
        where: { id: verification.id },
      });
      throw new BadRequestException('El token de verificación ha expirado. Solicita uno nuevo.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
    });

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

    // Enviar email de bienvenida
    if (user) {
      try {
        await this.emailService.enviarEmailBienvenida(user.email, user.nombre);
      } catch (e) {
        this.logger.error(`Error enviando email de bienvenida: ${e.message}`);
      }
    }

    return {
      message: '¡Email verificado exitosamente! Ya puedes iniciar sesión',
    };
  }

  // ═══════════════════════════════════════════════════════
  // RESEND VERIFICATION
  // ═══════════════════════════════════════════════════════

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // No revelar si el email existe o no (seguridad)
    if (!user) {
      return { message: 'Si el email está registrado, recibirás un correo de verificación' };
    }

    if (user.emailVerificado) {
      return { message: 'Este email ya está verificado. Puedes iniciar sesión.' };
    }

    // Eliminar tokens anteriores de este usuario
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    // Crear nuevo token
    const verificationToken = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Enviar email
    try {
      await this.emailService.enviarEmailVerificacion(
        user.email,
        user.nombre,
        verificationToken,
      );
    } catch (e) {
      this.logger.error(`Error reenviando email de verificación a ${user.email}: ${e.message}`);
    }

    return { message: 'Si el email está registrado, recibirás un correo de verificación' };
  }

  // ═══════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // No revelar si el email existe o no (seguridad)
    if (!user) {
      return { message: 'Si existe una cuenta con ese email, recibirás instrucciones para restablecer tu contraseña' };
    }

    // Eliminar tokens anteriores de reset para este usuario
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Crear token de reset
    const resetToken = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Enviar email de recuperación
    try {
      await this.emailService.enviarEmailRecuperacion(
        user.email,
        user.nombre,
        resetToken,
      );
      this.logger.log(`Email de recuperación enviado a ${user.email}`);
    } catch (e) {
      this.logger.error(`Error enviando email de recuperación a ${user.email}: ${e.message}`);
    }

    return { message: 'Si existe una cuenta con ese email, recibirás instrucciones para restablecer tu contraseña' };
  }

  // ═══════════════════════════════════════════════════════
  // RESET PASSWORD
  // ═══════════════════════════════════════════════════════

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
    });

    if (!resetRecord) {
      throw new BadRequestException('Token de recuperación inválido');
    }

    if (resetRecord.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({
        where: { id: resetRecord.id },
      });
      throw new BadRequestException('El token de recuperación ha expirado. Solicita uno nuevo.');
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Actualizar contraseña
    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    // Eliminar token usado
    await this.prisma.passwordReset.delete({
      where: { id: resetRecord.id },
    });

    // Eliminar todos los tokens de reset pendientes del usuario
    await this.prisma.passwordReset.deleteMany({
      where: { userId: resetRecord.userId },
    });

    return { message: '¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión con tu nueva contraseña.' };
  }

  // ═══════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        categoriaActual: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      documento: user.documento,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      telefono: user.telefono,
      genero: user.genero,
      ciudad: user.ciudad,
      fotoUrl: user.fotoUrl,
      fechaNacimiento: user.fechaNacimiento,
      esPremium: user.esPremium,
      estado: user.estado,
      categoriaActualId: user.categoriaActualId,
      categoriaActual: user.categoriaActual,
      roles: user.roles.map((ur) => ur.role.nombre),
      createdAt: user.createdAt,
      ultimaSesion: user.ultimaSesion,
    };
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
