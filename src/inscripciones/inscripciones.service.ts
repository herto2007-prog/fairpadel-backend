import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { ParejasService } from '../parejas/parejas.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CloudinaryService } from '../fotos/cloudinary.service';
import { LogrosService } from '../logros/logros.service';

@Injectable()
export class InscripcionesService {
  private readonly logger = new Logger(InscripcionesService.name);

  constructor(
    private prisma: PrismaService,
    private parejasService: ParejasService,
    private notificacionesService: NotificacionesService,
    private cloudinaryService: CloudinaryService,
    private logrosService: LogrosService,
  ) {}

  /**
   * Get commission percentage: tournament-specific override OR global default.
   */
  private async getComisionPorcentaje(tournament: any, tx: any): Promise<number> {
    if (tournament.comisionPorcentaje != null) {
      return parseFloat(tournament.comisionPorcentaje.toString()) / 100;
    }
    const config = await tx.configuracionSistema.findUnique({
      where: { clave: 'COMISION_INSCRIPCION' },
    });
    return config ? parseFloat(config.valor) / 100 : 0.05;
  }

  async create(createInscripcionDto: CreateInscripcionDto, userId: string) {
    const {
      tournamentId,
      categoryId,
      modalidad,
      jugador2Documento,
      metodoPago,
      modoPagoInscripcion,
    } = createInscripcionDto;

    // ── Pre-transaction validations (read-only) ──

    // Verificar que el torneo existe y acepta inscripciones
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: true,
        modalidades: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!['PUBLICADO', 'EN_CURSO'].includes(tournament.estado)) {
      throw new BadRequestException('El torneo no acepta inscripciones');
    }

    // Enforce inscription deadline
    if (tournament.fechaLimiteInscr) {
      const now = new Date();
      const deadline = new Date(tournament.fechaLimiteInscr);
      if (now > deadline) {
        throw new BadRequestException(
          'La fecha límite de inscripción ya ha pasado. Contacta al organizador para más información.',
        );
      }
    }

    // Verificar categoría en el torneo y abierta
    const categoriaRelacion = tournament.categorias.find(
      (c) => c.categoryId === categoryId,
    );
    if (!categoriaRelacion) {
      throw new BadRequestException('Categoría no disponible en este torneo');
    }
    if (!categoriaRelacion.inscripcionAbierta) {
      throw new BadRequestException(
        'Las inscripciones están cerradas para esta categoría',
      );
    }

    // Verificar restricción de nivel de categoría
    const categorySelected = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (categorySelected) {
      const jugador1Full = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { categoriaActual: true },
      });

      if (jugador1Full?.categoriaActualId && jugador1Full.categoriaActual) {
        const catActual = jugador1Full.categoriaActual;
        if (modalidad === 'TRADICIONAL' && catActual.tipo === categorySelected.tipo) {
          const levelDiff = catActual.orden - categorySelected.orden;
          if (levelDiff < 0) {
            throw new BadRequestException(
              `No puedes inscribirte en una categoría inferior a la tuya (${catActual.nombre})`,
            );
          }
          if (levelDiff > 1) {
            throw new BadRequestException(
              `Solo puedes inscribirte en tu categoría (${catActual.nombre}) o una categoría superior`,
            );
          }
        }
      }
    }

    // Verificar modalidad en el torneo
    const modalidadExiste = tournament.modalidades.some(
      (m) => m.modalidad === modalidad,
    );
    if (!modalidadExiste) {
      throw new BadRequestException('Modalidad no disponible en este torneo');
    }

    // Obtener jugador 1
    const jugador1 = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!jugador1) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar compatibilidad de género
    const jugador2 = await this.prisma.user.findUnique({
      where: { documento: jugador2Documento },
    });

    if (jugador2) {
      if (modalidad === 'TRADICIONAL') {
        if (jugador1.genero !== jugador2.genero) {
          throw new BadRequestException(
            'En modalidad Tradicional, ambos jugadores deben ser del mismo género',
          );
        }
      }
      if (modalidad === 'MIXTO') {
        if (jugador1.genero === jugador2.genero) {
          throw new BadRequestException(
            'En modalidad Mixto, los jugadores deben ser de géneros diferentes',
          );
        }
      }

      // Validar nivel de categoría del jugador 2
      if (modalidad === 'TRADICIONAL' && categorySelected) {
        const j2Full = await this.prisma.user.findUnique({
          where: { id: jugador2.id },
          include: { categoriaActual: true },
        });
        if (j2Full?.categoriaActualId && j2Full.categoriaActual) {
          const cat2 = j2Full.categoriaActual;
          if (cat2.tipo === categorySelected.tipo) {
            const levelDiff2 = cat2.orden - categorySelected.orden;
            if (levelDiff2 < 0) {
              throw new BadRequestException(
                `Tu compañero/a no puede inscribirse en una categoría inferior a la suya (${cat2.nombre})`,
              );
            }
            if (levelDiff2 > 1) {
              throw new BadRequestException(
                `Tu compañero/a solo puede inscribirse en su categoría (${cat2.nombre}) o una categoría superior`,
              );
            }
          }
        }
      }
    }

    // ── Atomic transaction: find/create pareja + check duplicate + create inscription + create pago ──

    return this.prisma.$transaction(async (tx) => {
      // Find or create pareja (within transaction)
      const pareja = await this.parejasService.findOrCreate(
        { jugador2Documento },
        userId,
        tx,
      );

      // Duplicate check: same tournament + (same pareja OR same jugadores in any pareja)
      const inscripcionExistente = await tx.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId,
          estado: { notIn: ['CANCELADA'] },
          pareja: {
            OR: [
              { jugador1Id: userId, jugador2Documento },
              ...(jugador2 ? [{ jugador1Id: jugador2.id, jugador2Documento: jugador1.documento }] : []),
            ],
          },
        },
      });

      if (inscripcionExistente) {
        throw new BadRequestException('Esta pareja ya está inscrita en esta categoría del torneo');
      }

      // Determinar estado inicial
      const esGratis = tournament.costoInscripcion.toNumber() === 0;
      const estadoInicial = esGratis
        ? 'CONFIRMADA'
        : metodoPago === 'EFECTIVO'
          ? 'PENDIENTE_PAGO_PRESENCIAL'
          : 'PENDIENTE_PAGO';

      // Crear inscripción
      const inscripcion = await tx.inscripcion.create({
        data: {
          tournamentId,
          parejaId: pareja.id,
          categoryId,
          modalidad,
          estado: estadoInicial,
        },
        include: {
          pareja: {
            include: {
              jugador1: true,
              jugador2: true,
            },
          },
          tournament: true,
          category: true,
        },
      });

      // Crear registro(s) de pago si no es gratis
      if (!esGratis) {
        const porcentajeComision = await this.getComisionPorcentaje(tournament, tx);
        const costoTotal = tournament.costoInscripcion.toNumber();
        const costoPorJugador = costoTotal / 2;
        const modo = modoPagoInscripcion || 'COMPLETO';

        // Set modoPago on the inscription
        await tx.inscripcion.update({
          where: { id: inscripcion.id },
          data: { modoPago: modo },
        });

        if (modo === 'INDIVIDUAL') {
          // 2 pagos: uno por cada jugador
          const comisionPorJugador = costoPorJugador * porcentajeComision;

          // Pago jugador 1 (el que está inscribiendo)
          await tx.pago.create({
            data: {
              inscripcionId: inscripcion.id,
              jugadorId: userId,
              metodoPago: metodoPago as any,
              monto: costoPorJugador,
              comision: comisionPorJugador,
              estado: 'PENDIENTE',
            },
          });

          // Pago jugador 2 (pendiente hasta que pague)
          const jugador2Db = await tx.user.findUnique({ where: { documento: jugador2Documento } });
          await tx.pago.create({
            data: {
              inscripcionId: inscripcion.id,
              jugadorId: jugador2Db?.id || null,
              metodoPago: metodoPago as any,
              monto: costoPorJugador,
              comision: comisionPorJugador,
              estado: 'PENDIENTE',
            },
          });
        } else {
          // COMPLETO: 1 pago con el total, comisión sobre el total
          const comisionTotal = costoTotal * porcentajeComision;
          await tx.pago.create({
            data: {
              inscripcionId: inscripcion.id,
              jugadorId: userId,
              metodoPago: metodoPago as any,
              monto: costoTotal,
              comision: comisionTotal,
              estado: 'PENDIENTE',
            },
          });
        }
      }

      // Fire-and-forget notifications after transaction
      const formatMonto = (n: number) => `Gs. ${new Intl.NumberFormat('es-PY').format(n)}`;
      const costoPair = tournament.costoInscripcion.toNumber();
      const jugador1Nombre = inscripcion.pareja?.jugador1;
      const jugador2Nombre = inscripcion.pareja?.jugador2;
      const torneoNombre = inscripcion.tournament?.nombre || 'Torneo';
      const categoriaNombre = inscripcion.category?.nombre || 'Categoría';

      if (esGratis) {
        // Gratis: send inscription confirmed
        setImmediate(async () => {
          try {
            await this.enviarNotificacionInscripcion(inscripcion);
          } catch (e) {
            this.logger.error(`Error notificando inscripcion gratuita: ${e.message}`);
          }
        });
      } else {
        // Paid: send inscription registered (pending payment)
        const estadoLabel = estadoInicial === 'PENDIENTE_PAGO_PRESENCIAL' ? 'Pendiente pago presencial' : 'Pendiente de pago';
        const metodoLabel = metodoPago === 'EFECTIVO' ? 'Efectivo' : metodoPago;

        setImmediate(async () => {
          try {
            const notifData = {
              torneoNombre,
              categoria: categoriaNombre,
              monto: formatMonto(costoPair),
              metodoPago: metodoLabel,
              estado: estadoLabel,
            };

            if (jugador1Nombre) {
              await this.notificacionesService.notificarInscripcionRegistrada(
                jugador1Nombre.id,
                { ...notifData, companero: jugador2Nombre ? `${jugador2Nombre.nombre} ${jugador2Nombre.apellido || ''}`.trim() : 'Por confirmar' },
              );
            }
            if (jugador2Nombre) {
              await this.notificacionesService.notificarInscripcionRegistrada(
                jugador2Nombre.id,
                { ...notifData, companero: jugador1Nombre ? `${jugador1Nombre.nombre} ${jugador1Nombre.apellido || ''}`.trim() : 'Por confirmar' },
              );
            }
          } catch (e) {
            this.logger.error(`Error notificando inscripcion registrada: ${e.message}`);
          }
        });
      }

      return inscripcion;
    }, { timeout: 15000 });
  }

  /**
   * Internal findOne — no authorization check. Used by other service methods.
   */
  async findOne(id: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        tournament: true,
        category: true,
        pagos: true,
        comprobantes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscripcion;
  }

  /**
   * Public findOne — with ownership/role authorization.
   * Players can only see their own inscriptions.
   * Admins/organizers can see any.
   */
  async findOneAuthorized(id: string, userId: string, userRoles: string[]) {
    const inscripcion = await this.findOne(id);

    const isAdmin = userRoles.includes('admin');
    const isInPareja =
      inscripcion.pareja.jugador1Id === userId ||
      inscripcion.pareja.jugador2Id === userId;
    const isOrganizer = inscripcion.tournament?.organizadorId === userId;

    if (!isAdmin && !isInPareja && !isOrganizer) {
      throw new ForbiddenException('No tienes permiso para ver esta inscripción');
    }

    return inscripcion;
  }

  async findByUser(userId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        pareja: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        tournament: true,
        category: true,
        pagos: true,
        comprobantes: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return inscripciones;
  }

  /**
   * Find inscriptions by tournament — restricted to organizer, ayudantes, or admin.
   */
  async findByTournament(tournamentId: string, userId: string, userRoles: string[], estado?: string) {
    // Verify authorization: only organizer, ayudantes, or admin can list all inscriptions
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { ayudantes: true },
      });
      if (!tournament) {
        throw new NotFoundException('Torneo no encontrado');
      }
      const isOrganizer = tournament.organizadorId === userId;
      const isAyudante = tournament.ayudantes?.some(a => a.userId === userId);
      if (!isOrganizer && !isAyudante) {
        throw new ForbiddenException('No tienes permiso para ver las inscripciones de este torneo');
      }
    }

    const where: any = { tournamentId };
    if (estado) {
      where.estado = estado;
    }

    const inscripciones = await this.prisma.inscripcion.findMany({
      where,
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        category: true,
        pagos: true,
        comprobantes: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return inscripciones;
  }

  async cancelar(id: string, userId: string) {
    const inscripcion = await this.findOne(id);

    // Verificar que el usuario es parte de la pareja
    if (
      inscripcion.pareja.jugador1Id !== userId &&
      inscripcion.pareja.jugador2Id !== userId
    ) {
      throw new ForbiddenException('No tienes permiso para cancelar esta inscripción');
    }

    // Solo se puede cancelar si está pendiente
    if (!['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'].includes(inscripcion.estado)) {
      throw new BadRequestException('No se puede cancelar esta inscripción');
    }

    return this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'CANCELADA' },
    });
  }

  async subirComprobante(
    inscripcionId: string,
    userId: string,
    file?: Express.Multer.File,
    comprobanteUrl?: string,
  ) {
    const inscripcion = await this.findOne(inscripcionId);

    // Ownership check: only players in the pareja can upload comprobantes
    if (
      inscripcion.pareja.jugador1Id !== userId &&
      inscripcion.pareja.jugador2Id !== userId
    ) {
      throw new ForbiddenException('No tienes permiso para subir comprobantes de esta inscripción');
    }

    // Allow RECHAZADA state so users can resubmit after rejection
    if (!['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'RECHAZADA'].includes(inscripcion.estado)) {
      throw new BadRequestException('Esta inscripción no acepta comprobantes');
    }

    let url: string;

    if (file) {
      // Upload file to Cloudinary
      const result = await this.cloudinaryService.uploadImage(file, {
        folder: 'fairpadel/comprobantes',
      });
      url = result.url;
    } else if (comprobanteUrl) {
      // Basic URL validation
      try {
        new URL(comprobanteUrl);
      } catch {
        throw new BadRequestException('URL de comprobante inválida');
      }
      url = comprobanteUrl;
    } else {
      throw new BadRequestException('Debe enviar un archivo o una URL de comprobante');
    }

    // Crear comprobante
    await this.prisma.comprobantePago.create({
      data: {
        inscripcionId,
        url,
        estado: 'PENDIENTE',
      },
    });

    // Actualizar estado de inscripción a PENDIENTE_CONFIRMACION
    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'PENDIENTE_CONFIRMACION' },
      include: {
        pareja: { include: { jugador1: true, jugador2: true } },
        tournament: true,
        category: true,
        pagos: true,
        comprobantes: true,
      },
    });
  }

  async confirmarPagoCompleto(inscripcionId: string) {
    const inscripcion = await this.findOne(inscripcionId);

    const estadosPermitidos = [
      'PENDIENTE_PAGO',
      'PENDIENTE_CONFIRMACION',
      'PENDIENTE_PAGO_PRESENCIAL',
    ];

    if (!estadosPermitidos.includes(inscripcion.estado)) {
      throw new BadRequestException(
        `No se puede confirmar una inscripción en estado ${inscripcion.estado}`,
      );
    }

    // Actualizar todos los Pago records
    if (inscripcion.pagos && inscripcion.pagos.length > 0) {
      for (const pago of inscripcion.pagos) {
        if (pago.estado === 'PENDIENTE') {
          await this.prisma.pago.update({
            where: { id: pago.id },
            data: {
              estado: 'CONFIRMADO',
              fechaPago: pago.fechaPago || new Date(),
              fechaConfirm: new Date(),
            },
          });
        }
      }
    }

    // Aprobar comprobantes pendientes
    await this.prisma.comprobantePago.updateMany({
      where: { inscripcionId, estado: 'PENDIENTE' },
      data: { estado: 'APROBADA' },
    });

    // Confirmar inscripción
    const inscripcionConfirmada = await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'CONFIRMADA' },
      include: {
        pareja: {
          include: { jugador1: true, jugador2: true },
        },
        tournament: true,
        category: true,
        pagos: true,
      },
    });

    // Notificar ambos jugadores (inscripción confirmada + pago confirmado)
    try {
      await this.enviarNotificacionInscripcion(inscripcionConfirmada);

      // Also send "pago confirmado" notification
      const formatMonto = (n: number) => `Gs. ${new Intl.NumberFormat('es-PY').format(n)}`;
      const pagoData = {
        torneoNombre: inscripcionConfirmada.tournament?.nombre || 'Torneo',
        categoria: inscripcionConfirmada.category?.nombre || 'Categoría',
        monto: formatMonto(inscripcionConfirmada.tournament?.costoInscripcion?.toNumber() || 0),
        tournamentId: inscripcionConfirmada.tournament?.id || '',
      };

      const j1 = inscripcionConfirmada.pareja?.jugador1;
      const j2 = inscripcionConfirmada.pareja?.jugador2;
      if (j1) await this.notificacionesService.notificarPagoConfirmado(j1.id, pagoData);
      if (j2) await this.notificacionesService.notificarPagoConfirmado(j2.id, pagoData);
    } catch (e) {
      this.logger.error(`Error notificando inscripcion confirmada: ${e.message}`);
    }

    // Verificar logros para ambos jugadores
    try {
      if (inscripcionConfirmada.pareja) {
        await this.logrosService.verificarLogros(inscripcionConfirmada.pareja.jugador1Id);
        await this.logrosService.verificarLogros(inscripcionConfirmada.pareja.jugador2Id);
      }
    } catch (e) {
      this.logger.error(`Error verificando logros inscripcion: ${e.message}`);
    }

    return inscripcionConfirmada;
  }

  async rechazarPagoCompleto(inscripcionId: string, motivo?: string) {
    const inscripcion = await this.findOne(inscripcionId);

    const estadosPermitidos = [
      'PENDIENTE_PAGO',
      'PENDIENTE_CONFIRMACION',
      'PENDIENTE_PAGO_PRESENCIAL',
    ];

    if (!estadosPermitidos.includes(inscripcion.estado)) {
      throw new BadRequestException(
        `No se puede rechazar una inscripción en estado ${inscripcion.estado}`,
      );
    }

    // Actualizar todos los Pago records
    if (inscripcion.pagos && inscripcion.pagos.length > 0) {
      for (const pago of inscripcion.pagos) {
        if (pago.estado === 'PENDIENTE') {
          await this.prisma.pago.update({
            where: { id: pago.id },
            data: { estado: 'RECHAZADO' },
          });
        }
      }
    }

    // Rechazar comprobantes pendientes
    await this.prisma.comprobantePago.updateMany({
      where: { inscripcionId, estado: 'PENDIENTE' },
      data: {
        estado: 'RECHAZADA',
        motivoRechazo: motivo || 'Rechazado por el organizador',
      },
    });

    // Rechazar inscripción
    const inscripcionRechazada = await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'RECHAZADA' },
      include: {
        pareja: {
          include: { jugador1: true, jugador2: true },
        },
        tournament: true,
        category: true,
        pagos: true,
      },
    });

    // Notificar ambos jugadores del rechazo
    setImmediate(async () => {
      try {
        const rechazData = {
          torneoNombre: inscripcionRechazada.tournament?.nombre || 'Torneo',
          categoria: inscripcionRechazada.category?.nombre || 'Categoría',
          motivo: motivo || 'Rechazado por el organizador',
        };
        const j1 = inscripcionRechazada.pareja?.jugador1;
        const j2 = inscripcionRechazada.pareja?.jugador2;
        if (j1) await this.notificacionesService.notificarInscripcionRechazada(j1.id, rechazData);
        if (j2) await this.notificacionesService.notificarInscripcionRechazada(j2.id, rechazData);
      } catch (e) {
        this.logger.error(`Error notificando inscripcion rechazada: ${e.message}`);
      }
    });

    return inscripcionRechazada;
  }

  // ═══════════════════════════════════════════════════════
  // INDIVIDUAL PAYMENT METHODS
  // ═══════════════════════════════════════════════════════

  /**
   * Player pays their individual part of an INDIVIDUAL inscription.
   */
  async pagarMiParte(inscripcionId: string, userId: string, metodoPago?: string) {
    const inscripcion = await this.findOne(inscripcionId);

    // Verify user is part of the pareja
    const isInPareja =
      inscripcion.pareja.jugador1Id === userId ||
      inscripcion.pareja.jugador2Id === userId;
    if (!isInPareja) {
      throw new ForbiddenException('No eres parte de esta inscripción');
    }

    if (inscripcion.modoPago !== 'INDIVIDUAL') {
      throw new BadRequestException('Esta inscripción no es de pago individual');
    }

    // Find the pending pago for this user
    const miPago = inscripcion.pagos?.find(
      (p: any) => p.jugadorId === userId && p.estado === 'PENDIENTE',
    );
    if (!miPago) {
      throw new BadRequestException('No tienes un pago pendiente en esta inscripción');
    }

    // Update metodo de pago if provided
    if (metodoPago) {
      await this.prisma.pago.update({
        where: { id: miPago.id },
        data: { metodoPago: metodoPago as any },
      });
    }

    return this.findOne(inscripcionId);
  }

  /**
   * Confirm a single pago (for individual payment mode).
   * When all pagos are confirmed, the inscription becomes CONFIRMADA.
   */
  async confirmarPagoIndividual(pagoId: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: { inscripcion: { include: { pagos: true, pareja: { include: { jugador1: true, jugador2: true } }, tournament: true, category: true } } },
    });

    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.estado !== 'PENDIENTE') {
      throw new BadRequestException(`No se puede confirmar un pago en estado ${pago.estado}`);
    }

    // Confirm this pago
    await this.prisma.pago.update({
      where: { id: pagoId },
      data: {
        estado: 'CONFIRMADO',
        fechaPago: pago.fechaPago || new Date(),
        fechaConfirm: new Date(),
      },
    });

    // Check if ALL pagos for this inscription are now confirmed
    const allPagos = pago.inscripcion.pagos;
    const otherPagosConfirmed = allPagos
      .filter((p: any) => p.id !== pagoId)
      .every((p: any) => p.estado === 'CONFIRMADO');

    if (otherPagosConfirmed) {
      // All pagos confirmed → confirm inscription
      await this.prisma.inscripcion.update({
        where: { id: pago.inscripcionId },
        data: { estado: 'CONFIRMADA' },
      });

      // Approve pending comprobantes
      await this.prisma.comprobantePago.updateMany({
        where: { inscripcionId: pago.inscripcionId, estado: 'PENDIENTE' },
        data: { estado: 'APROBADA' },
      });

      // Notify players
      try {
        const insc = pago.inscripcion;
        await this.enviarNotificacionInscripcion(insc);

        const formatMonto = (n: number) => `Gs. ${new Intl.NumberFormat('es-PY').format(n)}`;
        const pagoData = {
          torneoNombre: insc.tournament?.nombre || 'Torneo',
          categoria: insc.category?.nombre || 'Categoría',
          monto: formatMonto(insc.tournament?.costoInscripcion?.toNumber() || 0),
          tournamentId: insc.tournament?.id || '',
        };
        const j1 = insc.pareja?.jugador1;
        const j2 = insc.pareja?.jugador2;
        if (j1) await this.notificacionesService.notificarPagoConfirmado(j1.id, pagoData);
        if (j2) await this.notificacionesService.notificarPagoConfirmado(j2.id, pagoData);
      } catch (e) {
        this.logger.error(`Error notificando pago individual confirmado: ${e.message}`);
      }
    }

    return this.findOne(pago.inscripcionId);
  }

  // ═══════════════════════════════════════════════════════
  // NOTIFICATION HELPER
  // ═══════════════════════════════════════════════════════

  /**
   * Envía notificación de inscripción confirmada a ambos jugadores de la pareja.
   */
  private async enviarNotificacionInscripcion(inscripcion: any) {
    const torneoNombre = inscripcion.tournament?.nombre || 'Torneo';
    const categoriaNombre = inscripcion.category?.nombre || 'Categoría';
    const jugador1 = inscripcion.pareja?.jugador1;
    const jugador2 = inscripcion.pareja?.jugador2;

    // Obtener fechas del torneo
    const fechaInicio = inscripcion.tournament?.fechaInicio
      ? new Date(inscripcion.tournament.fechaInicio).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const fechaFin = inscripcion.tournament?.fechaFin
      ? new Date(inscripcion.tournament.fechaFin).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const fechas = fechaInicio && fechaFin ? `${fechaInicio} - ${fechaFin}` : fechaInicio || '';

    // Notificar jugador1 (compañero = jugador2)
    if (jugador1) {
      try {
        await this.notificacionesService.notificarInscripcionConfirmada(
          jugador1.id,
          torneoNombre,
          categoriaNombre,
          jugador2?.nombre ? `${jugador2.nombre} ${jugador2.apellido || ''}`.trim() : 'Por confirmar',
          fechas,
        );
      } catch (e) {
        this.logger.error(`Error notificando inscripcion a jugador1: ${e.message}`);
      }
    }

    // Notificar jugador2 (compañero = jugador1)
    if (jugador2) {
      try {
        await this.notificacionesService.notificarInscripcionConfirmada(
          jugador2.id,
          torneoNombre,
          categoriaNombre,
          jugador1?.nombre ? `${jugador1.nombre} ${jugador1.apellido || ''}`.trim() : 'Por confirmar',
          fechas,
        );
      } catch (e) {
        this.logger.error(`Error notificando inscripcion a jugador2: ${e.message}`);
      }
    }
  }
}