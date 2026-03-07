import { useEffect, useState } from 'react';
import { sedesService, Sede } from '../../../services/sedesService';
import { MapPin, Phone, ChevronRight } from 'lucide-react';

export default function SedesListPage() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSedes();
  }, []);

  const loadSedes = async () => {
    try {
      setLoading(true);
      const data = await sedesService.getAll();
      setSedes(data);
    } catch (err) {
      setError('Error al cargar sedes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Sedes</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sedes.map((sede) => (
            <div
              key={sede.id}
              className="bg-[#151921] rounded-lg border border-[#232838] overflow-hidden hover:border-[#df2531] transition-colors"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">{sede.nombre}</h2>
                
                <div className="space-y-2 text-gray-400 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{sede.ciudad}</span>
                    {sede.direccion && <span>- {sede.direccion}</span>}
                  </div>
                  
                  {sede.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      <span>{sede.telefono}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[#232838]">
                  <span className="text-sm text-gray-400">
                    {sede.canchas?.length || 0} canchas disponibles
                  </span>
                </div>
              </div>
              
              <a
                href={`/sedes/${sede.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#232838] hover:bg-[#df2531] transition-colors text-sm font-medium"
              >
                Ver detalle
                <ChevronRight size={16} />
              </a>
            </div>
          ))}
        </div>

        {sedes.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No hay sedes disponibles
          </div>
        )}
      </div>
    </div>
  );
}
