import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, User, Users, Trophy, CheckCircle,
  AlertCircle, Search, UserPlus, Shield, CreditCard, Loader2,
  Check, X, Sparkles, Info, ChevronRight
} from 'lucide-react';
import { AnimatedBackground } from './AnimatedBackground';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner'; // O tu sistema de notificaciones

interface Torneo {
  id: string;
  nombre: string;
  slug: string;
  flyerUrl: string;
  costoInscripcion: number;
  ciudad: string;
  fechaInicio: string;
  categorias: Array<{
    id: string;
    tournamentCategoryId: string;
    nombre: string;
    tipo: string;
    orden: number;
    inscripcionAbierta: boolean;
  }>;
  cuentasBancarias?: Array<{
    id: string;
    banco: string;
    titular: string;
    cedulaRuc: string;
    nroCuenta?: string;
    aliasSpi?: string;
  }>;
}

interface Jugador {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  telefono?: string;
  genero: 'MASCULINO' | 'FEMENINO';
  fotoUrl?: string;
  categoria?: {
    id: string;
    nombre: string;
    tipo: string;
    orden: number;
  };
}

const STEPS = [
  { id: 1, title: 'Jugador 1', icon: User, description: 'Confirmar tu identidad' },
  { id: 2, title: 'Jugador 2', icon: Users, description: 'Buscar tu pareja' },
  { id: 3, title: 'Categoría', icon: Trophy, description: 'Seleccionar categoría' },
  { id: 4, title: 'Confirmar', icon: CheckCircle, description: 'Revisar y confirmar' },
];

export function InscripcionWizard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Datos del formulario
  const [jugador2, setJugador2] = useState<Jugador | null>(null);
  const [jugador2NoRegistrado, setJugador2NoRegistrado] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    email: '',
  });
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [modoPago, setModoPago] = useState<'COMPLETO' | 'INDIVIDUAL'>('COMPLETO');
  const [consentimiento, setConsentimiento] = useState(false);
  
  // Búsqueda de jugador2
  const [busquedaQuery, setBusquedaQuery] = useState('');
  const [busquedaTipo, setBusquedaTipo] = useState<'nombre' | 'documento'>('nombre');
  const [busquedaResultados, setBusquedaResultados] = useState<Jugador[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  
  // Validación de categoría
  const [validandoCategoria, setValidandoCategoria] = useState(false);
  const [validacionCategoria, setValidacionCategoria] = useState<{
    permitido: boolean;
    mensaje: string;
    esCategoriaInferior?: boolean;
    advertencia?: string;
  } | null>(null);

  useEffect(() => {
    const cargarTorneo = async () => {
      try {
        const { data } = await api.get(`/t/${slug}`);
        if (data.success) {
          setTorneo(data.torneo);
        }
      } catch (error) {
        toast.error('Error cargando el torneo');
        navigate('/torneos');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      cargarTorneo();
    }
  }, [slug, navigate]);

  // Buscar jugador2
  const buscarJugador = async () => {
    if (!busquedaQuery.trim()) return;
    
    setBuscando(true);
    try {
      const params = new URLSearchParams();
      if (busquedaTipo === 'nombre') {
        params.append('nombre', busquedaQuery);
      } else {
        params.append('documento', busquedaQuery);
      }
      
      const { data } = await api.get(`/inscripciones/public/buscar-pareja?${params.toString()}`);
      if (data.success) {
        setBusquedaResultados(data.jugadores);
        if (data.jugadores.length === 0) {
          setMostrarFormNuevo(true);
        }
      }
    } catch (error) {
      toast.error('Error buscando jugador');
    } finally {
      setBuscando(false);
    }
  };

  // Validar categoría
  const validarCategoria = async (categoriaId: string) => {
    if (!user?.categoriaActualId) return;
    
    setValidandoCategoria(true);
    try {
      const { data } = await api.post('/inscripciones/public/validar-categoria', {
        categoriaId,
        jugadorGenero: user.genero,
        jugadorCategoriaId: user.categoriaActualId,
      });
      
      setValidacionCategoria(data);
      if (data.permitido) {
        setCategoriaSeleccionada(categoriaId);
      }
    } catch (error) {
      toast.error('Error validando categoría');
    } finally {
      setValidandoCategoria(false);
    }
  };

  // Crear inscripción
  const crearInscripcion = async () => {
    if (!torneo || !categoriaSeleccionada) return;
    
    setSubmitting(true);
    try {
      const payload: any = {
        tournamentId: torneo.id,
        categoryId: categoriaSeleccionada,
        modoPago,
      };
      
      if (jugador2) {
        payload.jugador2Id = jugador2.id;
      } else {
        payload.jugador2NoRegistrado = jugador2NoRegistrado;
      }
      
      const { data } = await api.post('/inscripciones/public', payload);
      
      if (data.success) {
        toast.success(data.message);
        // Redirigir a la página de la inscripción o al panel
        if (data.inscripcion.requiereInvitacion) {
          navigate('/inscripciones/pendientes');
        } else {
          navigate(`/inscripciones/${data.inscripcion.id}`);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error creando inscripción');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0,
    }).format(precio);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground />
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!torneo) return null;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return isAuthenticated;
      case 2:
        return jugador2 || (mostrarFormNuevo && 
          jugador2NoRegistrado.nombre && 
          jugador2NoRegistrado.apellido && 
          jugador2NoRegistrado.documento && 
          jugador2NoRegistrado.email);
      case 3:
        return categoriaSeleccionada && validacionCategoria?.permitido;
      case 4:
        return consentimiento;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen">
      <AnimatedBackground />
      
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0d14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={`/t/${slug}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Volver al torneo</span>
            </Link>
            <span className="text-white/40 text-sm">Inscripción</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      currentStep >= step.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-white/40'
                    }`}
                    animate={{
                      scale: currentStep === step.id ? 1.1 : 1,
                    }}
                  >
                    <step.icon className="w-5 h-5" />
                  </motion.div>
                  <span className={`text-xs mt-2 ${
                    currentStep >= step.id ? 'text-white' : 'text-white/40'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-purple-500' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido del paso */}
        <AnimatePresence mode="wait">
          {/* PASO 1: Jugador 1 */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  ¿Con quién jugarás este increíble torneo?
                </h2>
                <p className="text-white/60">
                  Primero, confirmemos tu identidad como Jugador 1
                </p>
              </div>

              {isAuthenticated && user ? (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {user.nombre[0]}{user.apellido[0]}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg">
                        {user.nombre} {user.apellido}
                      </p>
                      <p className="text-white/60">{user.email}</p>
                      {user.categoriaActual && (
                        <span className="inline-block mt-1 px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full">
                          {user.categoriaActual.nombre}
                        </span>
                      )}
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400 ml-auto" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">
                    Necesitas iniciar sesión para continuar
                  </p>
                  <Link
                    to="/login"
                    state={{ redirectTo: `/t/${slug}/inscribirse` }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors"
                  >
                    Iniciar sesión
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </motion.div>
          )}

          {/* PASO 2: Jugador 2 */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Busca a tu compañero/a
                </h2>
                <p className="text-white/60">
                  Busca por nombre, apellido o documento
                </p>
              </div>

              {/* Búsqueda */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setBusquedaTipo('nombre')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      busquedaTipo === 'nombre'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Nombre/Apellido
                  </button>
                  <button
                    onClick={() => setBusquedaTipo('documento')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      busquedaTipo === 'documento'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Documento
                  </button>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="text"
                      placeholder={busquedaTipo === 'nombre' ? 'Nombre o apellido...' : 'Número de documento...'}
                      value={busquedaQuery}
                      onChange={(e) => setBusquedaQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && buscarJugador()}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <button
                    onClick={buscarJugador}
                    disabled={buscando || !busquedaQuery.trim()}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-white/10 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
                  >
                    {buscando ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                    Buscar
                  </button>
                </div>

                {/* Resultados */}
                {busquedaResultados.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-white/60">
                      {busquedaResultados.length} resultado(s) encontrado(s):
                    </p>
                    {busquedaResultados.map((jugador) => (
                      <button
                        key={jugador.id}
                        onClick={() => {
                          setJugador2(jugador);
                          setMostrarFormNuevo(false);
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          jugador2?.id === jugador.id
                            ? 'bg-purple-500/20 border-purple-500/50'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          jugador.genero === 'FEMENINO' ? 'bg-pink-500/30' : 'bg-blue-500/30'
                        }`}>
                          {jugador.nombre[0]}{jugador.apellido[0]}
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-white font-medium">
                            {jugador.nombre} {jugador.apellido}
                          </p>
                          <p className="text-white/60 text-sm">
                            {jugador.documento} • {jugador.categoria?.nombre || 'Sin categoría'}
                          </p>
                        </div>
                        {jugador2?.id === jugador.id && (
                          <Check className="w-5 h-5 text-purple-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No encontrado */}
                {mostrarFormNuevo && busquedaResultados.length === 0 && (
                  <div className="mt-6">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                      <p className="text-yellow-300 text-sm flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        No encontramos a tu pareja en el sistema. Completa sus datos para invitarlo/a.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={jugador2NoRegistrado.nombre}
                        onChange={(e) => setJugador2NoRegistrado(prev => ({ ...prev, nombre: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Apellido"
                        value={jugador2NoRegistrado.apellido}
                        onChange={(e) => setJugador2NoRegistrado(prev => ({ ...prev, apellido: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Documento"
                        value={jugador2NoRegistrado.documento}
                        onChange={(e) => setJugador2NoRegistrado(prev => ({ ...prev, documento: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                      />
                      <input
                        type="tel"
                        placeholder="Teléfono (opcional)"
                        value={jugador2NoRegistrado.telefono}
                        onChange={(e) => setJugador2NoRegistrado(prev => ({ ...prev, telefono: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={jugador2NoRegistrado.email}
                        onChange={(e) => setJugador2NoRegistrado(prev => ({ ...prev, email: e.target.value }))}
                        className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PASO 3: Categoría */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Selecciona la categoría
                </h2>
                <p className="text-white/60">
                  Elige en qué categoría competirán
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {torneo.categorias
                  .filter(c => c.inscripcionAbierta)
                  .map((categoria) => (
                  <button
                    key={categoria.id}
                    onClick={() => validarCategoria(categoria.id)}
                    disabled={validandoCategoria}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                      categoriaSeleccionada === categoria.id
                        ? categoria.tipo === 'FEMENINO'
                          ? 'bg-pink-500/20 border-pink-500/50'
                          : 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                          categoria.tipo === 'FEMENINO'
                            ? 'bg-pink-500/20 text-pink-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {categoria.tipo === 'FEMENINO' ? '♀ Damas' : '♂ Caballeros'}
                        </span>
                        <h3 className="text-lg font-bold text-white">{categoria.nombre}</h3>
                      </div>
                      {categoriaSeleccionada === categoria.id && (
                        <CheckCircle className={`w-6 h-6 ${
                          categoria.tipo === 'FEMENINO' ? 'text-pink-400' : 'text-blue-400'
                        }`} />
                      )}
                    </div>
                    
                    {validandoCategoria && categoriaSeleccionada === categoria.id && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Validación */}
              {validacionCategoria && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 p-4 rounded-xl border ${
                    validacionCategoria.permitido
                      ? validacionCategoria.esCategoriaInferior
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {validacionCategoria.permitido ? (
                      validacionCategoria.esCategoriaInferior ? (
                        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      )
                    ) : (
                      <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={validacionCategoria.permitido
                        ? validacionCategoria.esCategoriaInferior ? 'text-yellow-300' : 'text-green-300'
                        : 'text-red-300'
                      }>
                        {validacionCategoria.mensaje}
                      </p>
                      {validacionCategoria.advertencia && (
                        <p className="text-yellow-300/80 text-sm mt-1">
                          {validacionCategoria.advertencia}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PASO 4: Confirmación */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Confirma tu inscripción
                </h2>
                <p className="text-white/60">
                  Revisa los datos antes de confirmar
                </p>
              </div>

              {/* Resumen */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                {/* Torneo */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <img
                      src={torneo.flyerUrl}
                      alt={torneo.nombre}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-white">{torneo.nombre}</h3>
                      <p className="text-white/60">{torneo.ciudad}</p>
                    </div>
                  </div>
                </div>

                {/* Equipo */}
                <div className="p-6 border-b border-white/10">
                  <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wide">
                    Equipo
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-white/40 mb-1">Jugador 1</p>
                      <p className="text-white font-medium">{user?.nombre} {user?.apellido}</p>
                      <p className="text-white/60 text-sm">{user?.categoriaActual?.nombre}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-white/40 mb-1">Jugador 2</p>
                      {jugador2 ? (
                        <>
                          <p className="text-white font-medium">{jugador2.nombre} {jugador2.apellido}</p>
                          <p className="text-white/60 text-sm">{jugador2.categoria?.nombre}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-white font-medium">
                            {jugador2NoRegistrado.nombre} {jugador2NoRegistrado.apellido}
                          </p>
                          <p className="text-yellow-400 text-sm flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Pendiente de registro
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Categoría y Pago */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-white/40 mb-1">Categoría</p>
                      <p className="text-white font-medium">
                        {torneo.categorias.find(c => c.id === categoriaSeleccionada)?.nombre}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40 mb-1">Inversión</p>
                      <p className="text-2xl font-bold text-white">
                        {formatPrecio(Number(torneo.costoInscripcion))}
                      </p>
                    </div>
                  </div>

                  {/* Modo de pago */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setModoPago('COMPLETO')}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        modoPago === 'COMPLETO'
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Pago completo
                    </button>
                    <button
                      onClick={() => setModoPago('INDIVIDUAL')}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        modoPago === 'INDIVIDUAL'
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Cada uno paga su mitad
                    </button>
                  </div>
                </div>
              </div>

              {/* Consentimiento */}
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentimiento}
                    onChange={(e) => setConsentimiento(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/20 mt-0.5"
                  />
                  <p className="text-sm text-white/70">
                    Al realizar esta solicitud declaro que mi compañero/a me ha dado su{' '}
                    <strong className="text-white">consentimiento previo</strong> para inscribirlo/a 
                    a este evento. Ambos aceptamos y nos sometemos voluntariamente a las normativas 
                    de FairPadel y las normativas de los organizadores del evento.
                  </p>
                </label>
              </div>

              {/* Datos bancarios (placeholder) */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  <h4 className="font-medium text-white">Datos para el pago</h4>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-sm">
                  <p className="text-white/60 mb-2">
                    Los pagos son responsabilidad exclusiva del organizador.
                  </p>
                  <div className="space-y-1 text-white/80">
                    <p><span className="text-white/40">Banco:</span> Banco Continental</p>
                    <p><span className="text-white/40">Titular:</span> {torneo.organizador?.nombre} {torneo.organizador?.apellido}</p>
                    <p><span className="text-white/40">Cuenta:</span> 1234567890</p>
                    <p><span className="text-white/40">Alias:</span> TORNEO.PADEL</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navegación */}
        <div className="flex items-center justify-between mt-8 pt-8 border-t border-white/10">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-8 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-white/10 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={crearInscripcion}
              disabled={!canProceed() || submitting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar inscripción
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
