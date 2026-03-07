import { useEffect, useState } from 'react';
import { alquileresService, Reserva } from '../../../services/alquileresService';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, Clock3 } from 'lucide-react';

const estadoConfig = {
  PENDIENTE: { icon: Clock3, color: 'text-yellow-500', label: 'Pendiente' },
  CONFIRMADA: { icon: CheckCircle, color: 'text-green-500', label: 'Confirmada' },
  CANCELADA: { icon: XCircle, color: 'text-red-500', label: 'Cancelada' },
};

export default function MisReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservas();
  }, []);

  const loadReservas = async () => {
    try {
      setLoading(true);
      const data = await alquileresService.getMisReservas();
      setReservas(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = async (id: string) => {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    
    try {
      await alquileresService.cancelarReserva(id, {});
      loadReservas();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cancelar');
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mis Reservas</h1>

        <div className="space-y-4">
          {reservas.map((reserva) => {
            const config = estadoConfig[reserva.estado];
            const Icon = config.icon;

            return (
              <div
                key={reserva.id}
                className="bg-[#151921] rounded-lg border border-[#232838] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-[#df2531]" />
                      <span className="font-medium">
                        {reserva.sedeCancha?.sede.nombre} - {reserva.sedeCancha?.nombre}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar size={16} />
                      <span>{new Date(reserva.fecha).toLocaleDateString('es-PY')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock size={16} />
                      <span>{reserva.horaInicio} - {reserva.horaFin}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Icon size={16} className={config.color} />
                      <span className={config.color}>{config.label}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold">Gs. {reserva.precio.toLocaleString()}</p>
                    
                    {reserva.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => handleCancelar(reserva.id)}
                        className="mt-2 text-sm text-red-400 hover:text-red-300"
                      >
                        Cancelar reserva
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {reservas.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No tienes reservas de canchas
          </div>
        )}
      </div>
    </div>
  );
}
