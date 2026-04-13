import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { WhatsAppService } from '../whatsapp/services/whatsapp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserStatus, WhatsappConsentStatus, InscripcionEstado } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private whatsAppService: WhatsAppService,
    private notificacionesService: NotificacionesService,
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

    // Buscar la categoría por nombre
    const categoria = await this.prisma.category.findFirst({
      where: { nombre: dto.categoria },
    });

    if (!categoria) {
      throw new ConflictException('La categoría seleccionada no existe');
    }

    // Preparar datos de consentimiento de WhatsApp
    const consentData = dto.consentCheckboxWhatsapp
      ? {
          consentCheckboxWhatsapp: true,
          consentWhatsappStatus: WhatsappConsentStatus.PENDIENTE,
          consentWhatsappDate: new Date(),
        }
      : {};

    // Create user with jugador role - estado NO_VERIFICADO
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        documento: dto.documento,
        telefono: dto.telefono,
        // FIX: fechaNacimiento es String YYYY-MM-DD
        fechaNacimiento: dto.fechaNacimiento,
        genero: dto.genero,
        ciudad: dto.ciudad,
        fotoUrl: dto.fotoUrl,
        categoriaActualId: categoria.id,
        estado: UserStatus.NO_VERIFICADO,
        ...consentData,
        roles: {
          create: {
            role: {
              connect: { nombre: 'jugador' },
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

    // Si el usuario aceptó recibir notificaciones por WhatsApp, enviar solicitud de confirmación
    if (dto.consentCheckboxWhatsapp) {
      this.whatsAppService.requestConsent(user.id).catch(err => {
        this.logger.error('Error solicitando consentimiento de WhatsApp:', err);
      });
    }

    // Create verification token (async - no bloquea la respuesta)
    this.createVerificationToken(user.id, user.email, user.nombre).catch(err => {
      this.logger.error('Error enviando email de verificación:', err);
    });

    // Vincular inscripciones pendientes donde este usuario fue invitado (flujo normal)
    this.vincularInscripcionesPendientes(user).catch(err => {
      this.logger.error('Error vinculando inscripciones pendientes:', err);
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
        estado: user.estado,
        fotoUrl: user.fotoUrl,
        roles: user.roles.map((ur) => ur.role.nombre),
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
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Check user status
    if (user.estado === UserStatus.INACTIVO || user.estado === UserStatus.SUSPENDIDO) {
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
        estado: user.estado,
        fotoUrl: user.fotoUrl,
        roles: user.roles.map((ur) => ur.role.nombre),
      },
    };
  }

  /**
   * Crea un token de verificación y envía el email (async)
   * Optimizado: No bloquea el registro, el email se envía en segundo plano
   */
  private async createVerificationToken(userId: string, email: string, nombre: string): Promise<void> {
    // Generar token aleatorio
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira en 24 horas

    // Guardar en base de datos (esto sí debe esperarse)
    await this.prisma.emailVerification.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    // Generar link de verificación
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

    // Enviar email EN SEGUNDO PLANO (no bloquea el registro)
    // Esto hace que el registro sea instantáneo para el usuario
    this.emailService.sendVerificationEmail(email, nombre, verificationLink)
      .then(() => {
        this.logger.log(`Email de verificación enviado a ${email}`);
      })
      .catch((error) => {
        this.logger.error(`Error enviando email a ${email}:`, error);
        // No lanzamos error para no interrumpir el registro
      });
  }

  /**
   * Verifica el email con el token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    // Buscar token
    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verification) {
      throw new BadRequestException('Token de verificación inválido');
    }

    // Verificar expiración
    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('El token ha expirado. Solicita uno nuevo.');
    }

    // Actualizar usuario a ACTIVO
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { estado: UserStatus.ACTIVO },
    });

    // Eliminar token usado
    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    // También vincular inscripciones pendientes al verificar email
    // (por si invitaron al usuario mientras tenía la cuenta no verificada)
    this.vincularInscripcionesPendientes(verification.user).catch(err => {
      this.logger.error('Error vinculando inscripciones pendientes en verifyEmail:', err);
    });

    this.logger.log(`Email verificado para usuario ${verification.userId}`);

    return { message: 'Email verificado exitosamente' };
  }

  /**
   * Reenvía el email de verificación
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.estado === UserStatus.ACTIVO) {
      throw new BadRequestException('El email ya está verificado');
    }

    // Eliminar tokens anteriores
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    // Crear nuevo token y enviar
    await this.createVerificationToken(user.id, user.email, user.nombre);

    return { message: 'Email de verificación reenviado' };
  }

  /**
   * Solicita recuperación de contraseña
   * Envía email con link para resetear
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Por seguridad, no revelamos si el email existe o no
    if (!user) {
      return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña' };
    }

    // Eliminar tokens anteriores
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Generar token aleatorio
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

    // Guardar token
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Generar link
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Enviar email en segundo plano
    this.emailService.sendPasswordResetEmail(user.email, user.nombre, resetLink)
      .then(() => {
        this.logger.log(`Email de recuperación enviado a ${user.email}`);
      })
      .catch((error) => {
        this.logger.error(`Error enviando email de recuperación a ${user.email}:`, error);
      });

    return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña' };
  }

  /**
   * Resetea la contraseña con el token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Buscar token
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!reset) {
      throw new BadRequestException('Token inválido');
    }

    // Verificar expiración
    if (reset.expiresAt < new Date()) {
      throw new BadRequestException('El token ha expirado. Solicita uno nuevo.');
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: { password: passwordHash },
    });

    // Eliminar token usado
    await this.prisma.passwordReset.delete({
      where: { id: reset.id },
    });

    this.logger.log(`Contraseña actualizada para usuario ${reset.userId}`);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  /**
   * Busca inscripciones PENDIENTE_CONFIRMACION que coincidan con el email o documento
   * del usuario recién registrado/verificado, las confirma automáticamente y notifica.
   */
  private async vincularInscripcionesPendientes(user: {
    id: string;
    email: string;
    documento: string;
    nombre: string;
    apellido: string;
  }): Promise<void> {
    const inscripcionesPendientes = await this.prisma.inscripcion.findMany({
      where: {
        estado: InscripcionEstado.PENDIENTE_CONFIRMACION,
        jugador2Id: null,
        OR: [
          { jugador2Documento: user.documento },
          { jugador2Email: user.email },
        ],
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        tournament: { select: { nombre: true } },
      },
    });

    if (inscripcionesPendientes.length === 0) return;

    for (const inscripcion of inscripcionesPendientes) {
      try {
        // Actualizar inscripción: vincular jugador2 y confirmar
        await this.prisma.inscripcion.update({
          where: { id: inscripcion.id },
          data: {
            jugador2Id: user.id,
            estado: InscripcionEstado.CONFIRMADA,
          },
        });

        // Marcar invitación como aceptada (si existe)
        await this.prisma.invitacionJugador.updateMany({
          where: {
            inscripcionId: inscripcion.id,
            estado: 'PENDIENTE',
          },
          data: {
            estado: 'ACEPTADA',
            respondedAt: new Date(),
          },
        });

        // Notificación interna al jugador 1
        if (inscripcion.jugador1) {
          this.prisma.notificacion
            .create({
              data: {
                userId: inscripcion.jugador1.id,
                tipo: 'INSCRIPCION',
                titulo: '¡Tu pareja se registró!',
                contenido: `${user.nombre} ${user.apellido} creó su cuenta y confirmó ser tu pareja en "${inscripcion.tournament.nombre}"`,
                enlace: `/inscripciones/${inscripcion.id}`,
              },
            })
            .catch((err) => {
              this.logger.error(
                `Error creando notificación interna para inscripción ${inscripcion.id}:`,
                err,
              );
            });
        }

        // Notificación por email a ambos jugadores
        this.notificacionesService.notificarInscripcionConfirmada(inscripcion.id).catch((err) => {
          this.logger.error(
            `Error notificando confirmación de inscripción ${inscripcion.id}:`,
            err,
          );
        });
      } catch (error) {
        this.logger.error(
          `Error procesando inscripción pendiente ${inscripcion.id} para usuario ${user.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Vinculadas ${inscripcionesPendientes.length} inscripciones pendientes al usuario ${user.id}`,
    );
  }

  private generateToken(userId: string, documento: string): string {
    const payload = { sub: userId, documento };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION'),
    });
  }
}
