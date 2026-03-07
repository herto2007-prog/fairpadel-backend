import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sedesService, Sede } from '../../../services/sedesService';
import { MapPin, Phone, Calendar } from 'lucide-react';

export default function SedeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sede, setSede] = useState<Sede | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) loadSede();
  }, [id]);

  const loadSede = async () => {
    try {
      setLoading(true);
      const data = await sedesService.getById(id!);
      setSede(data);
    } catch (err) {
      setError('Error al cargar la sede');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!sede) return <div className="p-8 text-center">Sede no encontrada</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#151921] rounded-lg border border-[#232838] p-8 mb-8">
          <h1 className="text-3xl font-bold mb-4">{sede.nombre}</h1>
          
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center gap-3">
              <MapPin size={20} className="text-[#df2531]" />
              <span>{sede.ciudad}</span>
              {sede.direccion && <span>- {sede.direccion}</span>}
            </div>
            
            {sede.telefono && (
              <div className="flex items-center gap-3">
                <Phone size={20} className="text-[#df2531]" />
                <span>{sede.telefono}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-4">
            <a
              href={`/alquileres?sedeId=${sede.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#df2531] rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              <Calendar size={20} />
              Reservar cancha
            </a>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Canchas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sede.canchas?.filter(c => c.activa).map((cancha) => (
            <div
              key={cancha.id}
              className="bg-[#151921] rounded-lg border border-[#232838] p-6"
            >
              <h3 className="text-lg font-semibold mb-2">{cancha.nombre}</h3>
              
              <div className="space-y-2 text-sm text-gray-400">
                <p>Tipo: {cancha.tipo}</p>
                {cancha.tieneLuz && <p>✓ Con iluminación</p>}
                {cancha.cubierta && <p>✓ Cancha cubierta</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
