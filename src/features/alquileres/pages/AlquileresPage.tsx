import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { alquileresService } from '../../../services/alquileresService';
import { sedesService } from '../../../services/sedesService';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface Slot {
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
}

interface CanchaDisponibilidad {
  cancha: { id: string; nombre: string; tipo: string; tieneLuz: boolean };
  slots: Slot[];
}

export default function AlquileresPage() {
  const [searchParams] = useSearchParams();
  const sedeIdParam = searchParams.get('sedeId');

  const [sedes, setSedes] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState(sedeIdParam || '');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [disponibilidad, setDisponibilidad] = useState<CanchaDisponibilidad[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSedes();
  }, []);

  useEffect(() => {
    if (sedeId && fecha) {
      loadDisponibilidad();
    }
  }, [sedeId, fecha]);

  const loadSedes = async () => {
    const data = await sedesService.getAll();
    setSedes(data);
    if (!sedeId && data.length > 0) {
      setSedeId(data[0].id);
    }
  };

  const loadDisponibilidad = async () => {
    try {
      setLoading(true);
      const data = await alquileresService.getDisponibilidad(sedeId, fecha);
      setDisponibilidad(data.disponibilidad);
    } finally {
      setLoading(false);
    }
  };

  const handleReservar = async (canchaId: string, horaInicio: string, horaFin: string) => {
    try {
      await alquileresService.crearReserva({
        sedeCanchaId: canchaId,
        fecha,
        horaInicio,
        horaFin,
        precio: 50000, // TODO: obtener precio real
      });
      alert('Reserva creada exitosamente');
      loadDisponibilidad();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear reserva');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Reservar Cancha</h1>

        {/* Filtros */}
        <div className="bg-[#151921] rounded-lg border border-[#232838] p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Sede</label>
              <select
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
                className="w-full px-4 py-2 bg-[#0B0E14] border border-[#232838] rounded-lg focus:border-[#df2531] outline-none"
              >
                {sedes.map((sede) => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nombre} - {sede.ciudad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 bg-[#0B0E14] border border-[#232838] rounded-lg focus:border-[#df2531] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Disponibilidad */}
        {loading ? (
          <div className="text-center py-12">Cargando disponibilidad...</div>
        ) : (
          <div className="space-y-8">
            {disponibilidad.map((item) => (
              <div
                key={item.cancha.id}
                className="bg-[#151921] rounded-lg border border-[#232838] p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <MapPin size={20} className="text-[#df2531]" />
                  <h2 className="text-xl font-semibold">{item.cancha.nombre}</h2>
                  <span className="text-sm text-gray-400">({item.cancha.tipo})</span>
                </div>

                {item.slots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {item.slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleReservar(item.cancha.id, slot.horaInicio, slot.horaFin)}
                        className="flex flex-col items-center gap-1 p-3 bg-[#0B0E14] border border-[#232838] rounded-lg hover:border-[#df2531] transition-colors"
                      >
                        <Clock size={16} className="text-[#df2531]" />
                        <span className="text-sm font-medium">
                          {slot.horaInicio} - {slot.horaFin}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No hay horarios disponibles</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
