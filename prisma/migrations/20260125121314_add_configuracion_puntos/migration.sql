/*
  Warnings:

  - You are about to drop the column `fecha_limite_inscripcion` on the `tournaments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,role_id]` on the table `user_roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fecha_limite_inscr` to the `tournaments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InscripcionEstado" AS ENUM ('PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('BANCARD', 'TRANSFERENCIA', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "PagoEstado" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PROGRAMADO', 'EN_JUEGO', 'FINALIZADO', 'SUSPENDIDO', 'WO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoRanking" AS ENUM ('GLOBAL', 'PAIS', 'REGION', 'CIUDAD', 'CATEGORIA', 'LIGA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('SISTEMA', 'TORNEO', 'INSCRIPCION', 'PARTIDO', 'RANKING', 'SOCIAL', 'PAGO', 'MENSAJE');

-- CreateEnum
CREATE TYPE "SolicitudEstado" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "PlanTipo" AS ENUM ('JUGADOR', 'ORGANIZADOR');

-- CreateEnum
CREATE TYPE "PeriodoSuscripcion" AS ENUM ('MENSUAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "SuscripcionEstado" AS ENUM ('ACTIVA', 'VENCIDA', 'CANCELADA', 'PENDIENTE_PAGO');

-- AlterTable
ALTER TABLE "tournaments" DROP COLUMN "fecha_limite_inscripcion",
ADD COLUMN     "fecha_limite_inscr" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "fecha_nacimiento" SET DATA TYPE DATE;

-- CreateTable
CREATE TABLE "solicitudes_organizador" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organizacion" TEXT,
    "telefono" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "experiencia" TEXT NOT NULL,
    "motivacion" TEXT NOT NULL,
    "estado" "SolicitudEstado" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_organizador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_sponsors" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "link" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_premios" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "campeon" TEXT,
    "finalista" TEXT,
    "semifinalista" TEXT,
    "otros" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_premios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complejos" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "maps_url" TEXT,
    "es_sede_principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complejos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canchas" (
    "id" TEXT NOT NULL,
    "complejo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_competencia" (
    "id" TEXT NOT NULL,
    "complejo_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parejas" (
    "id" TEXT NOT NULL,
    "jugador1_id" TEXT NOT NULL,
    "jugador2_id" TEXT,
    "jugador2_documento" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parejas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "pareja_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "estado" "InscripcionEstado" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "inscripcion_id" TEXT NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "comision" DECIMAL(10,2) NOT NULL,
    "estado" "PagoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "transaction_id" TEXT,
    "fecha_pago" TIMESTAMP(3),
    "fecha_confirmacion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_pago" (
    "id" TEXT NOT NULL,
    "inscripcion_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "estado" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "ronda" TEXT NOT NULL,
    "numero_ronda" INTEGER NOT NULL,
    "pareja1_id" TEXT,
    "pareja2_id" TEXT,
    "cancha_id" TEXT,
    "fecha_programada" DATE,
    "hora_programada" TEXT,
    "hora_fin_estimada" TEXT,
    "estado" "MatchStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "pareja_ganadora_id" TEXT,
    "pareja_perdedora_id" TEXT,
    "set1_pareja1" INTEGER,
    "set1_pareja2" INTEGER,
    "set2_pareja1" INTEGER,
    "set2_pareja2" INTEGER,
    "set3_pareja1" INTEGER,
    "set3_pareja2" INTEGER,
    "partido_siguiente_id" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "tipo_ranking" "TipoRanking" NOT NULL,
    "alcance" TEXT NOT NULL,
    "genero" "Gender" NOT NULL,
    "puntos_totales" INTEGER NOT NULL DEFAULT 0,
    "posicion" INTEGER NOT NULL,
    "posicion_anterior" INTEGER,
    "torneos_jugados" INTEGER NOT NULL DEFAULT 0,
    "victorias" INTEGER NOT NULL DEFAULT 0,
    "derrotas" INTEGER NOT NULL DEFAULT 0,
    "porcentaje_victorias" DECIMAL(5,2),
    "racha_actual" INTEGER NOT NULL DEFAULT 0,
    "mejor_posicion" INTEGER,
    "campeonatos" INTEGER NOT NULL DEFAULT 0,
    "ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_puntos" (
    "id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "posicion_final" TEXT NOT NULL,
    "puntos_ganados" INTEGER NOT NULL,
    "fecha_torneo" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_puntos" (
    "id" TEXT NOT NULL,
    "posicion" TEXT NOT NULL,
    "puntos_base" INTEGER NOT NULL,
    "multiplicador" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimientos" (
    "id" TEXT NOT NULL,
    "seguidor_id" TEXT NOT NULL,
    "seguido_id" TEXT NOT NULL,
    "notificaciones_activas" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_privados" (
    "id" TEXT NOT NULL,
    "remitente_id" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_privados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_jugar" (
    "id" TEXT NOT NULL,
    "emisor_id" TEXT NOT NULL,
    "receptor_id" TEXT NOT NULL,
    "fecha_propuesta" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "lugar" TEXT NOT NULL,
    "mensaje" TEXT,
    "estado" "SolicitudEstado" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_jugar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "condicion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_logros" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "logro_id" TEXT NOT NULL,
    "fecha_desbloqueo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_logros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos" (
    "id" TEXT NOT NULL,
    "bloqueador_id" TEXT NOT NULL,
    "bloqueado_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes" (
    "id" TEXT NOT NULL,
    "reportador_id" TEXT NOT NULL,
    "reportado_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "SolicitudEstado" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "url_imagen" TEXT NOT NULL,
    "url_thumbnail" TEXT,
    "descripcion" VARCHAR(500),
    "tipo" TEXT NOT NULL DEFAULT 'PERSONAL',
    "estado_moderacion" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comentarios_count" INTEGER NOT NULL DEFAULT 0,
    "es_privada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foto_jugadores" (
    "id" TEXT NOT NULL,
    "foto_id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foto_jugadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "foto_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "foto_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "portada_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_fotos" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "foto_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "album_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_fotos" (
    "id" TEXT NOT NULL,
    "foto_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "SolicitudEstado" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_perfil_moderacion" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "foto_url" TEXT NOT NULL,
    "estado" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_perfil_moderacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_premium" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "PlanTipo" NOT NULL,
    "precio_mensual" DECIMAL(10,2) NOT NULL,
    "precio_anual" DECIMAL(10,2) NOT NULL,
    "caracteristicas" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_premium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "periodo" "PeriodoSuscripcion" NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "estado" "SuscripcionEstado" NOT NULL DEFAULT 'ACTIVA',
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "fecha_renovacion" TIMESTAMP(3),
    "auto_renovar" BOOLEAN NOT NULL DEFAULT true,
    "metodo_pago_id" TEXT,
    "cupon_aplicado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "limite_usos" INTEGER NOT NULL,
    "usos_actuales" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "contenido" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_inscripcion_id_key" ON "pagos"("inscripcion_id");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_jugador_id_tipo_ranking_alcance_key" ON "rankings"("jugador_id", "tipo_ranking", "alcance");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_puntos_posicion_key" ON "configuracion_puntos"("posicion");

-- CreateIndex
CREATE UNIQUE INDEX "seguimientos_seguidor_id_seguido_id_key" ON "seguimientos"("seguidor_id", "seguido_id");

-- CreateIndex
CREATE UNIQUE INDEX "logros_nombre_key" ON "logros"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_logros_user_id_logro_id_key" ON "usuario_logros"("user_id", "logro_id");

-- CreateIndex
CREATE UNIQUE INDEX "bloqueos_bloqueador_id_bloqueado_id_key" ON "bloqueos"("bloqueador_id", "bloqueado_id");

-- CreateIndex
CREATE UNIQUE INDEX "foto_jugadores_foto_id_jugador_id_key" ON "foto_jugadores"("foto_id", "jugador_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_foto_id_user_id_key" ON "likes"("foto_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_fotos_album_id_foto_id_key" ON "album_fotos"("album_id", "foto_id");

-- CreateIndex
CREATE UNIQUE INDEX "planes_premium_nombre_key" ON "planes_premium"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- AddForeignKey
ALTER TABLE "solicitudes_organizador" ADD CONSTRAINT "solicitudes_organizador_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_sponsors" ADD CONSTRAINT "tournament_sponsors_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_premios" ADD CONSTRAINT "tournament_premios_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complejos" ADD CONSTRAINT "complejos_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_complejo_id_fkey" FOREIGN KEY ("complejo_id") REFERENCES "complejos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_competencia" ADD CONSTRAINT "horarios_competencia_complejo_id_fkey" FOREIGN KEY ("complejo_id") REFERENCES "complejos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_jugador1_id_fkey" FOREIGN KEY ("jugador1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_jugador2_id_fkey" FOREIGN KEY ("jugador2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_pareja_id_fkey" FOREIGN KEY ("pareja_id") REFERENCES "parejas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_inscripcion_id_fkey" FOREIGN KEY ("inscripcion_id") REFERENCES "inscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_inscripcion_id_fkey" FOREIGN KEY ("inscripcion_id") REFERENCES "inscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pareja1_id_fkey" FOREIGN KEY ("pareja1_id") REFERENCES "parejas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pareja2_id_fkey" FOREIGN KEY ("pareja2_id") REFERENCES "parejas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pareja_ganadora_id_fkey" FOREIGN KEY ("pareja_ganadora_id") REFERENCES "parejas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pareja_perdedora_id_fkey" FOREIGN KEY ("pareja_perdedora_id") REFERENCES "parejas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_seguidor_id_fkey" FOREIGN KEY ("seguidor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_seguido_id_fkey" FOREIGN KEY ("seguido_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_privados" ADD CONSTRAINT "mensajes_privados_remitente_id_fkey" FOREIGN KEY ("remitente_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_privados" ADD CONSTRAINT "mensajes_privados_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_jugar" ADD CONSTRAINT "solicitudes_jugar_emisor_id_fkey" FOREIGN KEY ("emisor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_jugar" ADD CONSTRAINT "solicitudes_jugar_receptor_id_fkey" FOREIGN KEY ("receptor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_logros" ADD CONSTRAINT "usuario_logros_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_logros" ADD CONSTRAINT "usuario_logros_logro_id_fkey" FOREIGN KEY ("logro_id") REFERENCES "logros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_bloqueador_id_fkey" FOREIGN KEY ("bloqueador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_bloqueado_id_fkey" FOREIGN KEY ("bloqueado_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportador_id_fkey" FOREIGN KEY ("reportador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportado_id_fkey" FOREIGN KEY ("reportado_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_jugadores" ADD CONSTRAINT "foto_jugadores_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albumes" ADD CONSTRAINT "albumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_fotos" ADD CONSTRAINT "album_fotos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_fotos" ADD CONSTRAINT "album_fotos_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_fotos" ADD CONSTRAINT "reportes_fotos_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_fotos" ADD CONSTRAINT "reportes_fotos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_perfil_moderacion" ADD CONSTRAINT "fotos_perfil_moderacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes_premium"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
