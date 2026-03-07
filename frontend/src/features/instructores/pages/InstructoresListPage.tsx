import { useEffect, useState } from 'react';
import { instructoresService, Instructor } from '../../../services/instructoresService';
import { MapPin, Award, ChevronRight } from 'lucide-react';

export default function InstructoresListPage() {
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInstructores();
  }, []);

  const loadInstructores = async () => {
    try {
      setLoading(true);
      const data = await instructoresService.getAll();
      setInstructores(data);
    } catch (err) {
      setError('Error al cargar instructores');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Instructores</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instructores.map((instructor) => (
            <div
              key={instructor.id}
              className="bg-[#151921] rounded-lg border border-[#232838] overflow-hidden hover:border-[#df2531] transition-colors"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#232838] flex items-center justify-center text-2xl font-bold">
                    {instructor.user.nombre[0]}{instructor.user.apellido[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {instructor.user.nombre} {instructor.user.apellido}
                    </h2>
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Award size={14} />
                      <span>{instructor.experienciaAnios} años de experiencia</span>
                    </div>
                  </div>
                </div>

                {instructor.especialidades && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                    {instructor.especialidades}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {instructor.precioIndividual && (
                    <p>Individual: <span className="font-semibold">Gs. {instructor.precioIndividual.toLocaleString()}</span></p>
                  )}
                  {instructor.precioGrupal && (
                    <p>Grupal: <span className="font-semibold">Gs. {instructor.precioGrupal.toLocaleString()}</span></p>
                  )}
                </div>

                {instructor.ubicaciones.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                    <MapPin size={14} />
                    <span>{instructor.ubicaciones.map(u => u.ciudad).join(', ')}</span>
                  </div>
                )}
              </div>

              <a
                href={`/instructores/${instructor.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#232838] hover:bg-[#df2531] transition-colors text-sm font-medium"
              >
                Ver perfil
                <ChevronRight size={16} />
              </a>
            </div>
          ))}
        </div>

        {instructores.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No hay instructores disponibles
          </div>
        )}
      </div>
    </div>
  );
}
