import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Calendar, Trophy, Users, Filter,
  ChevronDown, ChevronUp, X, ArrowRight, Sparkles 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatedBackground } from './AnimatedBackground';
import { api } from '@/lib/api'; // Ajusta según tu estructura

interface Torneo {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin: string;
  fechaLimiteInscr: string;
  ciudad: string;
  flyerUrl: string;
  costoInscripcion: number;
  organizador: {
    id: string;
    nombre: string;
    apellido: string;
  };
  sede?: {
    id: string;
    nombre: string;
    ciudad: string;
  };
  categorias: Array<{
    id: string;
    nombre: string;
    tipo: string;
    orden: number;
    inscripcionAbierta: boolean;
  }>;
  totalInscritos: number;
}

interface Filtros {
  q: string;
  ciudad: string;
  categoria: string;
  estado: 'todos' | 'proximos' | 'en-curso' | 'finalizados';
}

export function TorneosListPage() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [filtros, setFiltros] = useState<Filtros>({
    q: '',
    ciudad: '',
    categoria: '',
    estado: 'proximos',
  });
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
  const [ciudadesDisponibles, setCiudadesDisponibles] = useState<string[]>([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<Array<{id: string, nombre: string, tipo: string}>>([]);

  // Cargar datos de filtros
  useEffect(() => {
    const cargarDatosFiltros = async () => {
      try {
        const { data } = await api.get('/t/datos/filtros');
        if (data.success) {
          setCiudadesDisponibles(data.ciudades);
          setCategoriasDisponibles(data.categorias);
        }
      } catch (error) {
        console.error('Error cargando filtros:', error);
      }
    };
    cargarDatosFiltros();
  }, []);

  // Cargar torneos
  const cargarTorneos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.q) params.append('q', filtros.q);
      if (filtros.ciudad) params.append('ciudad', filtros.ciudad);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.estado !== 'todos') params.append('estado', filtros.estado);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const { data } = await api.get(`/t/public?${params.toString()}`);
      if (data.success) {
        setTorneos(data.torneos);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error cargando torneos:', error);
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.page, pagination.limit]);

  useEffect(() => {
    cargarTorneos();
  }, [cargarTorneos]);

  const limpiarFiltros = () => {
    setFiltros({
      q: '',
      ciudad: '',
      categoria: '',
      estado: 'proximos',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hayFiltrosActivos = filtros.q || filtros.ciudad || filtros.categoria;

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-PY', {
      day: 'numeric',
      month: 'short',
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
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/torneos" className="text-white/80 hover:text-white transition-colors">
                Torneos
              </Link>
              <Link to="/ranking" className="text-white/60 hover:text-white transition-colors">
                Ranking
              </Link>
              <Link to="/login" className="text-white/60 hover:text-white transition-colors">
                Ingresar
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Descubre los mejores{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                torneos de pádel
              </span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Encuentra torneos en tu ciudad, inscríbete con tu pareja y demuestra tu talento en la cancha.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filtros */}
      <section className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Barra de búsqueda principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-4"
          >
            <div className="flex flex-col md:flex-row gap-4">
              {/* Búsqueda */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar torneos por nombre, ciudad o descripción..."
                  value={filtros.q}
                  onChange={(e) => setFiltros(prev => ({ ...prev, q: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Toggle filtros avanzados */}
              <button
                onClick={() => setFiltrosExpandidos(!filtrosExpandidos)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 transition-colors"
              >
                <Filter className="w-5 h-5" />
                <span>Filtros</span>
                {filtrosExpandidos ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Filtros expandibles */}
            <AnimatePresence>
              {filtrosExpandidos && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 mt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ciudad */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Ciudad
                      </label>
                      <select
                        value={filtros.ciudad}
                        onChange={(e) => setFiltros(prev => ({ ...prev, ciudad: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="" className="bg-[#1a1f2e]">Todas las ciudades</option>
                        {ciudadesDisponibles.map(ciudad => (
                          <option key={ciudad} value={ciudad} className="bg-[#1a1f2e]">
                            {ciudad}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">
                        <Trophy className="w-4 h-4 inline mr-1" />
                        Categoría
                      </label>
                      <select
                        value={filtros.categoria}
                        onChange={(e) => setFiltros(prev => ({ ...prev, categoria: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="" className="bg-[#1a1f2e]">Todas las categorías</option>
                        {categoriasDisponibles.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-[#1a1f2e]">
                            {cat.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Estado */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Período
                      </label>
                      <select
                        value={filtros.estado}
                        onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value as any }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="proximos" className="bg-[#1a1f2e]">Próximos</option>
                        <option value="en-curso" className="bg-[#1a1f2e]">En curso</option>
                        <option value="finalizados" className="bg-[#1a1f2e]">Finalizados</option>
                        <option value="todos" className="bg-[#1a1f2e]">Todos</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chips de filtros activos */}
            {hayFiltrosActivos && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/10">
                <span className="text-sm text-white/40">Filtros activos:</span>
                {filtros.q && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                    Búsqueda: {filtros.q}
                    <button onClick={() => setFiltros(prev => ({ ...prev, q: '' }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filtros.ciudad && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                    {filtros.ciudad}
                    <button onClick={() => setFiltros(prev => ({ ...prev, ciudad: '' }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filtros.categoria && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                    {categoriasDisponibles.find(c => c.id === filtros.categoria)?.nombre}
                    <button onClick={() => setFiltros(prev => ({ ...prev, categoria: '' }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={limpiarFiltros}
                  className="text-sm text-white/40 hover:text-white/60 ml-auto"
                >
                  Limpiar todo
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Grid de Torneos */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            // Skeleton loading
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-2xl h-[400px] animate-pulse"
                />
              ))}
            </div>
          ) : torneos.length === 0 ? (
            // Empty state
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-white/30" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No se encontraron torneos
              </h3>
              <p className="text-white/50 mb-6">
                Intenta ajustar tus filtros o busca en otra ciudad
              </p>
              <button
                onClick={limpiarFiltros}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors"
              >
                Limpiar filtros
              </button>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {torneos.map((torneo, index) => (
                    <motion.div
                      key={torneo.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 hover:bg-white/[0.05] transition-all duration-300"
                    >
                      {/* Flyer */}
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={torneo.flyerUrl || '/placeholder-torneo.jpg'}
                          alt={torneo.nombre}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-transparent to-transparent" />
                        
                        {/* Badge de inscripciones abiertas */}
                        {new Date(torneo.fechaLimiteInscr) > new Date() && (
                          <div className="absolute top-3 right-3 px-3 py-1 bg-green-500/90 text-white text-xs font-medium rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Inscripciones abiertas
                          </div>
                        )}

                        {/* Precio */}
                        <div className="absolute bottom-3 left-3">
                          <span className="px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-sm font-semibold rounded-lg">
                            {formatPrecio(Number(torneo.costoInscripcion))}
                          </span>
                        </div>
                      </div>

                      {/* Contenido */}
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-purple-400 transition-colors">
                          {torneo.nombre}
                        </h3>

                        {/* Info básica */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{formatFecha(torneo.fechaInicio)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <MapPin className="w-4 h-4" />
                            <span>{torneo.ciudad}</span>
                            {torneo.sede && (
                              <span className="text-white/40">• {torneo.sede.nombre}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Users className="w-4 h-4" />
                            <span>{torneo.totalInscritos} inscritos</span>
                          </div>
                        </div>

                        {/* Categorías */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {torneo.categorias.slice(0, 3).map(cat => (
                            <span
                              key={cat.id}
                              className={`px-2 py-0.5 text-xs rounded-md ${
                                cat.tipo === 'FEMENINO'
                                  ? 'bg-pink-500/20 text-pink-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {cat.nombre}
                            </span>
                          ))}
                          {torneo.categorias.length > 3 && (
                            <span className="px-2 py-0.5 text-xs bg-white/10 text-white/60 rounded-md">
                              +{torneo.categorias.length - 3}
                            </span>
                          )}
                        </div>

                        {/* Botón Ver Detalles */}
                        <Link
                          to={`/t/${torneo.slug}`}
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/50 rounded-xl text-white/80 hover:text-purple-300 transition-all group/btn"
                        >
                          <span>Ver detalles</span>
                          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Paginación */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-white/60">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
