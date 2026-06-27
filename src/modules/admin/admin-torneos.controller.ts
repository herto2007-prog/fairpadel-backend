import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsUUID, ValidateNested, Matches, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { ComisionService } from '../../common/services/comision.service';
import { RankingsService } from '../rankings/rankings.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AlertasService } from '../alertas/alertas.service';
import { EmailService } from '../../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';
import { ESTADOS_TERMINALES } from '../bracket/match-estados';

// Validador custom para fechas futuras
@ValidatorConstraint({ name: 'isFutureDate', async: false })
class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(dateString: string) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(dateString + 'T00:00:00');
    return inputDate >= today;
  }
  defaultMessage() {
    return 'La fecha debe ser hoy o futura';
  }
}

// DTOs
class CreateTorneoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  @Validate(IsFutureDateConstraint)
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  @Validate(IsFutureDateConstraint)
  fechaFin: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFinales debe tener formato YYYY-MM-DD' })
  fechaFinales?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaLimiteInscripcion debe tener formato YYYY-MM-DD' })
  fechaLimiteInscripcion?: string;

  // Borrador 30s: ciudad/costo son opcionales al crear; se completan luego (roadmap)
  // y se exigen al "enviar a aprobación".
  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  pais?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    // Convertir string a number si es necesario
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  costoInscripcion?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  minutosPorPartido?: number;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsString()
  @IsOptional()
  flyerUrl?: string;

  @IsString()
  @IsOptional()
  flyerPublicId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  modalidadIds?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categoriaIds?: string[];
}

@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneosController {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private comisionService: ComisionService,
    private rankingsService: RankingsService,
    private tournamentsService: TournamentsService,
    private alertasService: AlertasService,
    private emailService: EmailService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════

  @Get()
  async findAll(@Request() req) {
    const user = req.user;
    const where = user.roles.includes('admin')
      ? {}
      : {
          OR: [
            { organizadorId: user.userId },
            { coorganizadores: { some: { userId: user.userId } } },
          ],
        };

    const torneos = await this.prisma.tournament.findMany({
      where,
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true },
        },
        categorias: {
          include: { category: true },
        },
        modalidades: {
          include: { modalidadConfig: true },
        },
        sedePrincipal: true,
        _count: {
          select: { inscripciones: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      torneos,
    };
  }

  /**
   * GET /admin/torneos/pendientes-aprobacion
   * Solo para admin: listar torneos pendientes de aprobación
   */
  @Get('pendientes-aprobacion')
  @Roles('admin')
  async getPendientesAprobacion() {
    const torneos = await this.prisma.tournament.findMany({
      where: {
        // Solo los que el organizador ENVIÓ a revisión. Los BORRADOR son
        // torneos que todavía se están armando: no ensucian la cola del admin.
        estado: {
          in: ['PENDIENTE_APROBACION'],
        },
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
        },
        categorias: {
          include: { category: true },
        },
        _count: {
          select: { inscripciones: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Palanca blanda: marcar si el organizador adeuda comisión de torneos
    // anteriores (por cobrar o con comprobante sin verificar), para decidir
    // la aprobación con info. Ver modelo-comision.
    const orgIds = [...new Set(torneos.map((t) => t.organizador?.id).filter(Boolean))] as string[];
    const comisionesAdeudadas = orgIds.length
      ? await this.prisma.torneoComision.findMany({
          where: {
            estado: { in: ['POR_COBRAR', 'PENDIENTE_VERIFICACION'] },
            tournament: { organizadorId: { in: orgIds } },
          },
          select: { montoEstimado: true, tournament: { select: { organizadorId: true } } },
        })
      : [];

    const deudaPorOrg = new Map<string, { torneos: number; monto: number }>();
    for (const c of comisionesAdeudadas) {
      const oid = c.tournament.organizadorId;
      const d = deudaPorOrg.get(oid) ?? { torneos: 0, monto: 0 };
      d.torneos += 1;
      d.monto += c.montoEstimado || 0;
      deudaPorOrg.set(oid, d);
    }

    const torneosConDeuda = torneos.map((t) => ({
      ...t,
      deudaOrganizador: deudaPorOrg.get(t.organizador?.id ?? '') ?? { torneos: 0, monto: 0 },
    }));

    return {
      success: true,
      torneos: torneosConDeuda,
    };
  }

  /**
   * POST /admin/torneos/:id/aprobar
   * Solo para admin: aprobar y publicar un torneo
   */
  @Post(':id/aprobar')
  @Roles('admin')
  async aprobarTorneo(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'PUBLICADO',
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
      },
    });

    // Crear notificación para el organizador
    await this.prisma.notificacion.create({
      data: {
        userId: torneo.organizadorId,
        tipo: 'TORNEO',
        titulo: '¡Tu torneo fue aprobado!',
        contenido: `El torneo "${torneo.nombre}" ha sido aprobado y ya está visible públicamente.`,
        enlace: `/mis-torneos/${torneo.id}/gestionar`,
      },
    });

    // Avisar a los suscritos a "torneos en mi ciudad" (best-effort)
    await this.alertasService.notificarNuevoTorneo(torneo.id);

    // Email inmediato al organizador (best-effort, no rompe la respuesta).
    if (torneo.organizador?.email) {
      this.emailService
        .sendTorneoAprobado(
          torneo.organizador.email,
          torneo.organizador.nombre,
          torneo.nombre,
          torneo.id,
        )
        .catch((e) => console.error('Email de torneo aprobado falló:', e?.message));
    }

    return {
      success: true,
      message: 'Torneo aprobado y publicado exitosamente',
      torneo,
    };
  }

  /**
   * POST /admin/torneos/:id/rechazar
   * Solo para admin: rechazar un torneo
   */
  @Post(':id/rechazar')
  @Roles('admin')
  async rechazarTorneo(
    @Param('id') id: string,
    @Body('motivo') motivo?: string,
  ) {
    const torneo = await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
      },
    });

    // Crear notificación para el organizador
    await this.prisma.notificacion.create({
      data: {
        userId: torneo.organizadorId,
        tipo: 'TORNEO',
        titulo: 'Tu torneo no fue aprobado',
        contenido: `El torneo "${torneo.nombre}" no cumple con los requisitos.${motivo ? ` Motivo: ${motivo}` : ''}`,
        enlace: `/mis-torneos`,
      },
    });

    return {
      success: true,
      message: 'Torneo rechazado',
      torneo,
    };
  }

  /**
   * POST /admin/torneos/:id/enviar-aprobacion
   * El organizador manda su torneo (BORRADOR o RECHAZADO) a revisión del admin.
   * NO publica: lo deja en PENDIENTE_APROBACION. Recién el admin lo aprueba
   * (ver POST :id/aprobar). Es la palanca del modelo: el flujo pasa por el dueño.
   */
  @UseGuards(TorneoGestionGuard)
  @Post(':id/enviar-aprobacion')
  async enviarAAprobacion(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        nombre: true,
        ciudad: true,
        sedeId: true,
        costoInscripcion: true,
        flyerUrl: true,
        organizador: { select: { nombre: true, apellido: true } },
        _count: { select: { categorias: true } },
      },
    });
    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }
    if (!['BORRADOR', 'RECHAZADO'].includes(torneo.estado)) {
      throw new BadRequestException(
        'Solo se pueden enviar a aprobación torneos en borrador o rechazados',
      );
    }

    // Candado: el torneo no sale público hasta tener lo mínimo para mostrarse.
    const faltan: string[] = [];
    if (!torneo.ciudad) faltan.push('ciudad');
    if (!torneo.sedeId) faltan.push('sede');
    if (!torneo.costoInscripcion || Number(torneo.costoInscripcion) <= 0) faltan.push('costo de inscripción');
    if (!torneo.flyerUrl) faltan.push('flyer');
    if (!torneo._count.categorias) faltan.push('al menos una categoría');
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Antes de enviar a aprobación, completá: ${faltan.join(', ')}.`,
      );
    }
    const actualizado = await this.prisma.tournament.update({
      where: { id },
      data: { estado: 'PENDIENTE_APROBACION' },
    });

    // Avisar a los admins (in-app + email) para que aprueben sin demora.
    const orgNombre =
      [torneo.organizador?.nombre, torneo.organizador?.apellido].filter(Boolean).join(' ') ||
      'Un organizador';
    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { nombre: 'admin' } } } },
      select: { id: true, email: true, nombre: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.prisma.notificacion.create({
          data: {
            userId: admin.id,
            tipo: 'TORNEO',
            titulo: 'Nuevo torneo por aprobar',
            contenido: `${orgNombre} envió "${torneo.nombre}" (${torneo.ciudad}) para aprobación.`,
            enlace: '/admin',
          },
        }),
      ),
    );

    // Emails best-effort: no romper la respuesta si Resend falla.
    for (const admin of admins) {
      if (!admin.email) continue;
      this.emailService
        .sendTorneoPorAprobar(admin.email, admin.nombre, torneo.nombre, orgNombre, torneo.ciudad)
        .catch((e) => console.error('Email de aprobación al admin falló:', e?.message));
    }

    return {
      success: true,
      message: 'Torneo enviado a aprobación de FairPadel',
      torneo: actualizado,
    };
  }

  @UseGuards(TorneoGestionGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        categorias: {
          include: { category: true },
        },
        modalidades: {
          include: { modalidadConfig: true },
        },
        sedePrincipal: {
          include: {
            canchas: { where: { activa: true } },
          },
        },
        _count: {
          select: { inscripciones: true },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return torneo;
  }

  @Post()
  async create(@Body() dto: CreateTorneoDto, @Request() req) {
    const user = req.user;
    console.log('[CreateTorneo] User desde JWT:', user);
    console.log('[CreateTorneo] User.userId:', user.userId);
    try {
      // Obtener configuración de comisión
      const configComision = await this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      });
      const comisionPorJugador = parseInt(configComision?.valor || '0');

      // Crear en transacción
      const result = await this.prisma.$transaction(async (tx) => {
        // Generar slug único
        const slug = dto.nombre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

        // Preparar datos del torneo para Prisma
        const torneoData: any = {
          nombre: dto.nombre,
          descripcion: dto.descripcion || '',
          // FIX: fechas ahora son String YYYY-MM-DD directamente
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          // Fecha de finales = último día del torneo (derivada, no es un dato aparte).
          fechaFinales: dto.fechaFinales || dto.fechaFin,
          fechaLimiteInscr: dto.fechaLimiteInscripcion || dto.fechaInicio || dto.fechaFin,
          ciudad: dto.ciudad || '',
          costoInscripcion: dto.costoInscripcion ?? 0, // se define luego (roadmap)
          organizador: { connect: { id: user.userId } },
          estado: 'BORRADOR',
          pais: dto.pais || 'Paraguay',
          region: dto.region || dto.ciudad || '',
          flyerUrl: dto.flyerUrl || '',
          slug,
          minutosPorPartido: dto.minutosPorPartido || 120,
        };

        // Agregar sede solo si existe
        if (dto.sedeId) {
          torneoData.sedePrincipal = { connect: { id: dto.sedeId } };
        }

        // Crear torneo usando sintaxis de relación de Prisma
        const torneo = await tx.tournament.create({
          data: torneoData,
        });

        // Si hay sede, copiar sus canchas activas como TorneoCancha
        if (dto.sedeId) {
          const canchasSede = await tx.sedeCancha.findMany({
            where: {
              sedeId: dto.sedeId,
              activa: true,
            },
          });

          for (const cancha of canchasSede) {
            await tx.torneoCancha.create({
              data: {
                tournamentId: torneo.id,
                sedeCanchaId: cancha.id,
              },
            });
          }

          console.log(`[CreateTorneo] ${canchasSede.length} canchas copiadas de la sede`);
        }

        // Crear registro de comisión
        await tx.torneoComision.create({
          data: {
            tournamentId: torneo.id,
            montoEstimado: 0,
            montoPagado: 0,
            estado: 'PENDIENTE_PAGO',
            bloqueoActivo: false,
          },
        });

        // Crear checklist desde template
        const template = await tx.checklistTemplate.findFirst({
          where: { esDefault: true, activo: true },
          include: { items: true },
        });

        if (template) {
          for (const item of template.items) {
            await tx.checklistItem.create({
              data: {
                tournamentId: torneo.id,
                templateItemId: item.id,
                categoria: item.categoria,
                titulo: item.titulo,
                descripcion: item.descripcion,
                orden: item.orden,
                valorCalculado: item.esCalculado ? 0 : null,
              },
            });
          }
        }

        // Asignar modalidades si se proporcionaron
        if (dto.modalidadIds?.length) {
          for (const modalidadId of dto.modalidadIds) {
            await tx.tournamentModalidad.create({
              data: {
                tournamentId: torneo.id,
                modalidadConfigId: modalidadId,
              },
            });
          }
        }

        // Asignar categorías si se proporcionaron
        if (dto.categoriaIds?.length) {
          for (const categoriaId of dto.categoriaIds) {
            await tx.tournamentCategory.create({
              data: {
                tournamentId: torneo.id,
                categoryId: categoriaId,
              },
            });
          }
        }

        return torneo;
      });

      console.log('[CreateTorneo] Torneo creado exitosamente:', result.id);
      
      return {
        success: true,
        message: 'Torneo creado correctamente con checklist inicial',
        torneo: result,
        comisionPorJugador,
      };
    } catch (error: any) {
      console.error('[CreateTorneo] Error:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error creando torneo',
        error: error.message,
      });
    }
  }

  @UseGuards(TorneoGestionGuard)
  @Put(':id')
  async update(
    @Param('id') torneoId: string,
    @Body() dto: Partial<CreateTorneoDto> & { canchasFinales?: string[]; horaInicioFinales?: string; horaFinFinales?: string },
    @Request() req,
  ) {
    try {
      const user = req.user;
      
      // Verificar que el torneo existe
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: torneoId },
        select: { id: true, organizadorId: true, fechaFinales: true, minutosPorPartido: true } as any,
      });
      
      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }
      
      // Verificar permisos (admin, organizador o co-organizador)
      const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, user.userId, user.roles);
      if (!puede) {
        throw new ForbiddenException('No tienes permiso para editar este torneo');
      }

      const torneoActualizado = await this.prisma.tournament.update({
        where: { id: torneoId },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
          ...(dto.fechaInicio && { fechaInicio: dto.fechaInicio }),
          // Al mover la fecha fin, la fecha de finales la sigue (= último día).
          ...(dto.fechaFin && { fechaFin: dto.fechaFin, fechaFinales: dto.fechaFin }),
          ...(dto.fechaLimiteInscripcion && { fechaLimiteInscr: dto.fechaLimiteInscripcion }),
          ...(dto.ciudad && { ciudad: dto.ciudad, region: dto.ciudad }),
          ...(dto.costoInscripcion !== undefined && { costoInscripcion: dto.costoInscripcion }),
          ...(dto.sedeId !== undefined && { sedeId: dto.sedeId }),
          ...(dto.flyerUrl !== undefined && { flyerUrl: dto.flyerUrl }),
          ...(dto.canchasFinales !== undefined && { canchasFinales: dto.canchasFinales }),
          ...(dto.horaInicioFinales !== undefined && { horaInicioFinales: dto.horaInicioFinales }),
          // @ts-ignore - campo nuevo
          ...(dto.horaFinFinales !== undefined && { horaFinFinales: dto.horaFinFinales }),
        },
      });

      // Crear automáticamente día y slots para finales si se configuran canchas
      if (dto.canchasFinales !== undefined && dto.canchasFinales.length > 0) {
        // @ts-ignore
        const fechaFinales = torneoActualizado.fechaFinales || torneo.fechaFinales;
        // @ts-ignore
        const horaInicio = dto.horaInicioFinales || torneoActualizado.horaInicioFinales || '18:00';
        // @ts-ignore
        const horaFin = dto.horaFinFinales || torneoActualizado.horaFinFinales || '23:00';
        
        if (fechaFinales) {
          // FIX: fechaFinales ya es String YYYY-MM-DD
          const fechaStr = fechaFinales as string;
          // @ts-ignore
          const minutosSlot: number = torneoActualizado.minutosPorPartido || torneo.minutosPorPartido || 70;
          
          console.log('[UpdateTorneo] Creando día de finales automáticamente:', {
            torneoId,
            fecha: fechaStr,
            horaInicio,
            canchas: dto.canchasFinales,
          });

          try {
            // 1. Crear o actualizar el día de disponibilidad para finales
            // Nueva clave compuesta permite múltiples franjas por día
            const diaFinales = await this.prisma.torneoDisponibilidadDia.upsert({
              where: {
                tournamentId_fecha_horaInicio: {
                  tournamentId: torneoId,
                  fecha: fechaStr,
                  horaInicio,
                },
              },
              update: {
                horaFin, // Horario configurable para finales
                minutosSlot,
                activo: true,
              },
              create: {
                tournamentId: torneoId,
                fecha: fechaStr,
                horaInicio,
                horaFin,
                minutosSlot,
              },
            });

            console.log('[UpdateTorneo] Día de finales creado/actualizado:', diaFinales.id);

            // 2. Generar slots para cada cancha seleccionada
            const slotsCreados = [];
            const horaFinNum = this.parseHora(horaFin);
            for (const torneoCanchaId of dto.canchasFinales) {
              let horaActual = this.parseHora(horaInicio);

              while (horaActual < horaFinNum) {
                const horaInicioStr = this.formatHora(horaActual);
                const horaFinSlot = horaActual + minutosSlot;
                const horaFinStr = this.formatHora(horaFinSlot);

                try {
                  const slot = await this.prisma.torneoSlot.create({
                    data: {
                      disponibilidadId: diaFinales.id,
                      torneoCanchaId,
                      horaInicio: horaInicioStr,
                      horaFin: horaFinStr,
                      estado: 'LIBRE',
                    },
                  });
                  slotsCreados.push(slot);
                } catch (createError: any) {
                  // Si el error es de duplicado (P2002), ignorar y continuar
                  if (createError.code !== 'P2002') {
                    throw createError;
                  }
                }

                horaActual = horaFinSlot;
              }
            }

            console.log('[UpdateTorneo] Slots creados para finales:', slotsCreados.length);
          } catch (error: any) {
            console.error('[UpdateTorneo] Error creando día/slots para finales:', error);
            // No lanzamos el error para no fallar la actualización del torneo
          }
        }
      }

      return {
        success: true,
        message: 'Torneo actualizado',
        torneo: torneoActualizado,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando torneo',
        error: error.message,
      };
    }
  }

  /**
   * PUT /admin/torneos/:id/categorias
   * Sincroniza las categorías de un torneo de forma SEGURA (editable en cualquier
   * momento, no solo al crear). A diferencia del POST del wizard (que borra y recrea),
   * acá: se agregan las nuevas libremente y se quitan SOLO las que no tengan cuadro
   * sorteado ni inscripciones. Las que no se pueden quitar se reportan en `bloqueadas`.
   */
  @UseGuards(TorneoGestionGuard)
  @Put(':id/categorias')
  async sincronizarCategorias(
    @Param('id') torneoId: string,
    @Body() dto: { categoriaIds?: string[] },
    @Request() req,
  ) {
    try {
      const user = req.user;
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: torneoId },
        select: { id: true },
      });
      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }
      const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, user.userId, user.roles);
      if (!puede) {
        throw new ForbiddenException('No tienes permiso para editar este torneo');
      }

      const deseadas = Array.isArray(dto.categoriaIds) ? [...new Set(dto.categoriaIds)] : [];

      const actuales = await this.prisma.tournamentCategory.findMany({
        where: { tournamentId: torneoId },
        select: {
          id: true,
          categoryId: true,
          fixtureVersionId: true,
          category: { select: { nombre: true } },
        },
      });
      const actualesIds = actuales.map((c) => c.categoryId);

      // Agregar las nuevas (siempre seguro)
      const aAgregar = deseadas.filter((id) => !actualesIds.includes(id));
      for (const categoryId of aAgregar) {
        await this.prisma.tournamentCategory.create({
          data: { tournamentId: torneoId, categoryId },
        });
      }

      // Quitar SOLO las seguras: sin cuadro sorteado y sin inscripciones
      const aQuitar = actuales.filter((c) => !deseadas.includes(c.categoryId));
      const quitadas: string[] = [];
      const bloqueadas: { categoryId: string; nombre: string; motivo: string }[] = [];
      for (const tc of aQuitar) {
        if (tc.fixtureVersionId) {
          bloqueadas.push({ categoryId: tc.categoryId, nombre: tc.category?.nombre || '', motivo: 'ya tiene cuadro sorteado' });
          continue;
        }
        const inscCount = await this.prisma.inscripcion.count({
          where: { tournamentId: torneoId, categoryId: tc.categoryId },
        });
        if (inscCount > 0) {
          bloqueadas.push({ categoryId: tc.categoryId, nombre: tc.category?.nombre || '', motivo: `tiene ${inscCount} inscripción(es)` });
        } else {
          await this.prisma.tournamentCategory.delete({ where: { id: tc.id } });
          quitadas.push(tc.categoryId);
        }
      }

      return {
        success: true,
        message: 'Categorías actualizadas',
        agregadas: aAgregar,
        quitadas,
        bloqueadas,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      return {
        success: false,
        message: 'Error actualizando categorías',
        error: error.message,
      };
    }
  }

  @UseGuards(TorneoGestionGuard)
  @Delete(':id')
  async remove(@Param('id') torneoId: string) {
    try {
      await this.prisma.tournament.delete({
        where: { id: torneoId },
      });

      return {
        success: true,
        message: 'Torneo eliminado correctamente',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error eliminando torneo',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FINALIZACIÓN DE CATEGORÍA Y CÁLCULO DE PUNTOS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /admin/torneos/:tournamentId/categorias/:categoryId/finalizar
   * Finaliza una categoría de torneo y calcula automáticamente los puntos de ranking.
   * Solo disponible para torneos con circuito aprobado.
   */
  @UseGuards(TorneoGestionGuard)
  @Post(':tournamentId/categorias/:categoryId/finalizar')
  async finalizarCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
    @Request() req: any,
  ) {
    const user = req.user;

    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, organizadorId: true, nombre: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Verificar permisos
    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, user.userId, user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para finalizar esta categoría');
    }

    // Verificar que la categoría pertenezca al torneo
    const tournamentCategory = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId },
    });

    if (!tournamentCategory) {
      throw new NotFoundException('Categoría no encontrada en este torneo');
    }

    // No finalizar con partidos sin resultado: finalizar calcula puntos de ranking,
    // así que un partido pendiente ensuciaría el cálculo. Solo cuentan los partidos
    // jugables (con ambas parejas asignadas) que aún no tienen un estado terminal.
    if (tournamentCategory.fixtureVersionId) {
      const pendientes = await this.prisma.match.count({
        where: {
          fixtureVersionId: tournamentCategory.fixtureVersionId,
          estado: { notIn: ESTADOS_TERMINALES as unknown as any },
          inscripcion1Id: { not: null },
          inscripcion2Id: { not: null },
        },
      });
      if (pendientes > 0) {
        throw new BadRequestException(
          `No se puede finalizar: hay ${pendientes} partido(s) sin resultado. Cargá los resultados (o WO/retiro) antes de finalizar la categoría.`,
        );
      }
    }

    // El circuito/ranking es OPCIONAL: si el torneo está en un circuito aprobado
    // se calculan puntos; si es un torneo independiente, igual se finaliza (sin
    // ranking). Antes esto bloqueaba a los torneos independientes.
    const torneoCircuito = await this.prisma.torneoCircuito.findFirst({
      where: { torneoId: tournamentId, estado: 'APROBADO' },
      include: { circuito: true },
    });

    // Actualizar estado de la categoría
    await this.prisma.tournamentCategory.update({
      where: { id: tournamentCategory.id },
      data: { estado: 'FINALIZADA' },
    });

    // Calcular puntos SOLO si hay circuito (ranking). Si no, se omite.
    let puntos: any = null;
    if (torneoCircuito) {
      const resultado = await this.rankingsService.calcularPuntosTorneo(tournamentId, categoryId);
      puntos = resultado.data;
    }

    return {
      success: true,
      message: torneoCircuito
        ? `Categoría finalizada y puntos calculados para ${torneo.nombre}`
        : `Categoría finalizada (torneo independiente, sin ranking) para ${torneo.nombre}`,
      data: {
        categoriaId: categoryId,
        circuito: torneoCircuito?.circuito.nombre ?? null,
        puntos,
      },
    };
  }

  /**
   * POST /admin/torneos/:id/finalizar
   * Marca el torneo como TERMINADO. Fija la comisión a cobrar según los
   * jugadores que REALMENTE jugaron (calcularComisionReal) y avisa al
   * organizador. NO bloquea nada en vivo: el torneo ya corrió libre y ahora
   * queda "por cobrar" (modelo acordado con Héctor, ver modelo-comision).
   */
  @UseGuards(TorneoGestionGuard)
  @Post(':id/finalizar')
  async finalizarTorneo(
    @Param('id') tournamentId: string,
    @Request() req: any,
  ) {
    const user = req.user;

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, nombre: true, estado: true, organizadorId: true },
    });
    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, user.userId, user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para finalizar este torneo');
    }

    if (!['PUBLICADO', 'EN_CURSO'].includes(torneo.estado)) {
      throw new BadRequestException('Solo se puede finalizar un torneo publicado o en curso');
    }

    // Marcar terminado.
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { estado: 'FINALIZADO' },
    });

    // Fijar la comisión real: jugadores que jugaron × tarifa. Al estar el
    // torneo finalizado, este número queda firme.
    const comision = await this.comisionService.calcularComisionReal(tournamentId);

    // Solo los torneos con comisión (>0) generan cuenta por cobrar; el
    // americano da 0 y no avisa.
    if (comision.monto > 0) {
      await this.prisma.torneoComision.upsert({
        where: { tournamentId },
        create: {
          tournamentId,
          montoEstimado: comision.monto,
          montoPagado: 0,
          estado: 'POR_COBRAR',
          bloqueoActivo: false,
        },
        update: { montoEstimado: comision.monto, estado: 'POR_COBRAR' },
      });

      const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      await this.prisma.notificacion.create({
        data: {
          userId: torneo.organizadorId,
          tipo: 'TORNEO',
          titulo: `Comisión a abonar — ${torneo.nombre}`,
          contenido: `Tu torneo terminó 🎾. Jugaron ${comision.jugaronCount} jugadores → comisión de FairPadel: Gs ${fmt(comision.monto)}. Coordiná el pago desde la gestión del torneo.`,
          enlace: `/mis-torneos/${tournamentId}/gestionar`,
        },
      });

      // Aviso por email best-effort (el aviso in-app ya quedó creado).
      try {
        const [organizador, bancoConfigs] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: torneo.organizadorId },
            select: { email: true, nombre: true },
          }),
          this.prisma.fairpadelConfig.findMany({
            where: {
              clave: {
                in: ['BANCO_CUENTA', 'BANCO_NUMERO_CUENTA', 'BANCO_ALIAS', 'BANCO_TITULAR', 'WHATSAPP_ADMIN'],
              },
            },
          }),
        ]);
        if (organizador?.email) {
          const cfg = (k: string) => bancoConfigs.find((c) => c.clave === k)?.valor || '';
          await this.emailService.sendComisionPorCobrar(
            organizador.email,
            organizador.nombre || 'organizador',
            torneo.nombre,
            comision.jugaronCount,
            comision.monto,
            {
              banco: cfg('BANCO_CUENTA'),
              numeroCuenta: cfg('BANCO_NUMERO_CUENTA'),
              alias: cfg('BANCO_ALIAS'),
              titular: cfg('BANCO_TITULAR'),
              whatsapp: cfg('WHATSAPP_ADMIN'),
            },
          );
        }
      } catch {
        // best-effort: no romper la finalización si el email falla.
      }
    }

    return {
      success: true,
      message: 'Torneo finalizado',
      comision,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private parseHora(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  private formatHora(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
