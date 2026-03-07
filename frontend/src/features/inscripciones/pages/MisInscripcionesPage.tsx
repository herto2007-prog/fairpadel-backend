import { useEffect, useState } from 'react';
import { inscripcionService, Inscripcion } from '../../../services/inscripcionService';
import { Calendar, Trophy, Clock } from 'lucide-react';

const estadoConfig = {
  PENDIENTE_PAGO: { color: 'text-yellow-500', label: 'Pendiente de pago' },
  PENDIENTE_CONFIRMACION: { color: 'text-blue-500', label: 'Pendiente de confirmación' },
  CONFIRMADA: { color: 'text-green-500', label: 'Confirmada' },
  CANCELADA: { color: 'text-red-500', label: 'Cancelada' },
};

export default function MisInscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInscripciones();
  }, []);

  const loadInscripciones = async () => {
    try {
      setLoading(true);
      const data = await inscripcionService.getMyInscripciones();
      setInscripciones(data);
    } catch (err) {
      console.error('Error loading inscripciones:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mis Inscripciones</h1>

        <div className="space-y-4">
          {inscripciones.map((inscripcion) => {
            const config = estadoConfig[inscripcion.estado];

            return (
              <div
                key={inscripcion.id}
                className="bg-[#151921] rounded-lg border border-[#232838] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Trophy size={18} className="text-[#df2531]" />
                      <span className="font-medium">Torneo #{inscripcion.tournamentId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calendar size={16} />
                      <span>Categoría: {inscripcion.categoryId}</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${config.color}`}>
                      <Clock size={16} />
                      <span>{config.label}</span>
                    </div>
                  </div>

                  {inscripcion.estado === 'PENDIENTE_PAGO' && (
                    <button className="px-4 py-2 bg-[#df2531] rounded text-sm font-medium hover:bg-red-700 transition-colors">
                      Pagar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {inscripciones.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No tienes inscripciones activas
          </div>
        )}
      </div>
    </div>
  );
}
