import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Calendar, Trophy, Users, Clock, ArrowLeft,
  Share2, Heart, CheckCircle, AlertCircle, Sparkles,
  Medal, Target, ChevronRight
} from 'lucide-react';
import { AnimatedBackground } from './AnimatedBackground';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth'; // Ajusta según tu sistema de auth

interface TorneoDetail {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin: string;
  fechaLimiteInscr: string;
  ciudad: string;
  region: string;
  pais: string;
  flyerUrl: string;
  costoInscripcion: number;
  minutosPorPartido: number;
  inscripcionesAbiertas: boolean;
  organizador: {
    id: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    email: string;
  };
  sedePrincipal?: {
    id: string;
    nombre: string;
    ciudad: string;
    direccion?: string;
    mapsUrl?: string;
    canchas: Array<{ id: string; nombre: string; tipo: string }>;
  };
  sedes: Array<{
    id: string;
    nombre: string;
    ciudad: string;
  }>;
  categorias: Array<{
    id: string;
    tournamentCategoryId: string;
    nombre: string;
    tipo: string;
    orden: number;
    inscripcionAbierta: boolean;
    estado: string;
  }>;
  modalidades: Array<{
    id: string;
    nombre: string;
    descripcion: string;
  }>;
  premios: Array<{
    id: string;
    puesto: string;
    descripcion: string;
    valor?: number;
  }>;
  sponsors: Array<{
    id: string;
    nombre: string;
    logoUrl?: string;
    nivel: string;
  }>;
  totalInscritos: number;
}

export function TorneoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [torneo, setTorneo] = useState<TorneoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarTorneo = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/t/${slug}`);
        if (data.success) {
          setTorneo(data.torneo);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error cargando el torneo');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      cargarTorneo();
    }
  }, [slug]);

  const handleInscribirse = () => {
    if (!isAuthenticated) {
      // Guardar URL actual para redirigir después del login
      localStorage.setItem('redirectAfterLogin', `/t/${slug}/inscribirse`);
      navigate('/login');
      return;
    }
    navigate(`/t/${slug}/inscribirse`);
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-PY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0,
    }).format(precio);
  };

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case 'ORO': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'PLATA': return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
      case 'BRONCE': return 'bg-amber-600/20 text-amber-400 border-amber-600/30';
      default: return 'bg-white/10 text-white/60 border-white/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AnimatedBackground />
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !torneo) {
    return (
      <div className="min-h-screen">
        <AnimatedBackground />
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            {error || 'Torneo no encontrado'}
          </h1>
          <Link
            to="/torneos"
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a torneos
          </Link>
        </div>
      </div>
    );
  }

  const diasHastaCierre = Math.ceil(
    (new Date(torneo.fechaLimiteInscr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen">
      <AnimatedBackground />

      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0d14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">FairPadel</span>
            </Link>

            <Link
              to="/torneos"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a torneos
            </Link>
          </div>
        </div>
      </header>

      {/* Hero con Flyer */}
      <section className="relative">
        <div className="h-[400px] md:h-[500px] relative">
          <img
            src={torneo.flyerUrl || '/placeholder-torneo.jpg'}
            alt={torneo.nombre}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/60 to-transparent" />
        </div>

        {/* Info flotante */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-6xl mx-auto px-4 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {torneo.inscripcionesAbiertas ? (
                  <span className="px-3 py-1 bg-green-500/90 text-white text-sm font-medium rounded-full flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Inscripciones abiertas
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-500/90 text-white text-sm font-medium rounded-full">
                    Inscripciones cerradas
                  </span>
                )}
                {diasHastaCierre > 0 && diasHastaCierre <= 7 && torneo.inscripcionesAbiertas && (
                  <span className="px-3 py-1 bg-orange-500/90 text-white text-sm font-medium rounded-full">
                    ¡Cierra en {diasHastaCierre} días!
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                {torneo.nombre}
              </h1>

              {/* Stats rápidas */}
              <div className="flex flex-wrap items-center gap-6 text-white/80">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span>{formatFecha(torneo.fechaInicio)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span>{torneo.ciudad}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  <span>{torneo.totalInscritos} inscritos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span>{torneo.minutosPorPartido} min/partido</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contenido principal */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna izquierda - Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Descripción */}
              {torneo.descripcion && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    Sobre el torneo
                  </h2>
                  <p className="text-white/70 whitespace-pre-line leading-relaxed">
                    {torneo.descripcion}
                  </p>
                </motion.div>
              )}

              {/* Categorías */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
              >
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Categorías
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {torneo.categorias.map(cat => (
                    <div
                      key={cat.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        cat.tipo === 'FEMENINO'
                          ? 'bg-pink-500/10 border-pink-500/30'
                          : 'bg-blue-500/10 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          cat.tipo === 'FEMENINO' ? 'bg-pink-400' : 'bg-blue-400'
                        }`} />
                        <span className="font-medium text-white">{cat.nombre}</span>
                      </div>
                      {cat.inscripcionAbierta ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Abierta
                        </span>
                      ) : (
                        <span className="text-xs text-red-400">Cerrada</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Modalidades */}
              {torneo.modalidades.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Modalidades</h2>
                  <div className="flex flex-wrap gap-2">
                    {torneo.modalidades.map(mod => (
                      <span
                        key={mod.id}
                        className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-lg"
                      >
                        {mod.nombre}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Premios */}
              {torneo.premios.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Medal className="w-5 h-5 text-yellow-400" />
                    Premios
                  </h2>
                  <div className="space-y-3">
                    {torneo.premios.map(premio => (
                      <div
                        key={premio.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            premio.puesto === '1ro' ? 'bg-yellow-500/20 text-yellow-400' :
                            premio.puesto === '2do' ? 'bg-gray-400/20 text-gray-300' :
                            premio.puesto === '3ro' ? 'bg-amber-600/20 text-amber-400' :
                            'bg-white/10 text-white/60'
                          }`}>
                            {premio.puesto}
                          </span>
                          <span className="text-white/80">{premio.descripcion}</span>
                        </div>
                        {premio.valor && (
                          <span className="text-green-400 font-semibold">
                            {formatPrecio(Number(premio.valor))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Ubicación */}
              {torneo.sedePrincipal && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-400" />
                    Ubicación
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{torneo.sedePrincipal.nombre}</p>
                        <p className="text-white/60 text-sm">
                          {torneo.sedePrincipal.direccion}, {torneo.sedePrincipal.ciudad}
                        </p>
                        {torneo.sedePrincipal.mapsUrl && (
                          <a
                            href={torneo.sedePrincipal.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 text-sm hover:underline mt-1 inline-block"
                          >
                            Ver en Google Maps →
                          </a>
                        )}
                      </div>
                    </div>

                    {torneo.sedePrincipal.canchas.length > 0 && (
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-sm text-white/60 mb-2">Canchas disponibles:</p>
                        <div className="flex flex-wrap gap-2">
                          {torneo.sedePrincipal.canchas.map(cancha => (
                            <span
                              key={cancha.id}
                              className="px-3 py-1 bg-white/5 text-white/70 text-sm rounded-lg"
                            >
                              {cancha.nombre} ({cancha.tipo.toLowerCase()})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Columna derecha - Card de inscripción */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="sticky top-24"
              >
                <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  {/* Precio */}
                  <div className="text-center mb-6">
                    <p className="text-white/60 text-sm mb-1">Inscripción por pareja</p>
                    <p className="text-4xl font-bold text-white">
                      {formatPrecio(Number(torneo.costoInscripcion))}
                    </p>
                  </div>

                  {/* Botón de inscripción */}
                  <button
                    onClick={handleInscribirse}
                    disabled={!torneo.inscripcionesAbiertas}
                    className={`w-full py-4 rounded-xl font-semibold text-lg transition-all mb-4 ${
                      torneo.inscripcionesAbiertas
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    {torneo.inscripcionesAbiertas
                      ? isAuthenticated
                        ? 'Inscribirme ahora'
                        : 'Iniciar sesión para inscribirme'
                      : 'Inscripciones cerradas'
                    }
                  </button>

                  {/* Info adicional */}
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between text-white/60">
                      <span>Límite de inscripción:</span>
                      <span className={diasHastaCierre <= 3 ? 'text-red-400' : 'text-white/80'}>
                        {formatFecha(torneo.fechaLimiteInscr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-white/60">
                      <span>Inscritos:</span>
                      <span className="text-white/80">{torneo.totalInscritos} parejas</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-6 border-t border-white/10" />

                  {/* Organizador */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {torneo.organizador.nombre[0]}{torneo.organizador.apellido[0]}
                    </div>
                    <div>
                      <p className="text-white/60 text-xs">Organizado por</p>
                      <p className="text-white font-medium">
                        {torneo.organizador.nombre} {torneo.organizador.apellido}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sponsors */}
                {torneo.sponsors.length > 0 && (
                  <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-white/60 mb-4 text-center">
                      Auspician
                    </h3>
                    <div className="flex flex-wrap justify-center gap-4">
                      {torneo.sponsors.map(sponsor => (
                        <div
                          key={sponsor.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getNivelColor(sponsor.nivel)}`}
                        >
                          {sponsor.nombre}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
