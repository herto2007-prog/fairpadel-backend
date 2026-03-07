import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { instructoresService, Instructor } from '../../../services/instructoresService';
import { MapPin, Award, Calendar, Phone } from 'lucide-react';

export default function InstructorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) loadInstructor();
  }, [id]);

  const loadInstructor = async () => {
    try {
      setLoading(true);
      const data = await instructoresService.getById(id!);
      setInstructor(data);
    } catch (err) {
      setError('Error al cargar el instructor');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!instructor) return <div className="p-8 text-center">Instructor no encontrado</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#151921] rounded-lg border border-[#232838] p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-[#232838] flex items-center justify-center text-3xl font-bold">
              {instructor.user.nombre[0]}{instructor.user.apellido[0]}
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                {instructor.user.nombre} {instructor.user.apellido}
              </h1>
              
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <Award size={18} className="text-[#df2531]" />
                <span>{instructor.experienciaAnios} años de experiencia</span>
              </div>

              {instructor.descripcion && (
                <p className="text-gray-300 mb-4">{instructor.descripcion}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Precios */}
          <div className="bg-[#151921] rounded-lg border border-[#232838] p-6">
            <h2 className="text-xl font-bold mb-4">Precios</h2>
            <div className="space-y-3">
              {instructor.precioIndividual && (
                <div className="flex justify-between items-center">
                  <span>Clase individual</span>
                  <span className="text-xl font-bold">Gs. {instructor.precioIndividual.toLocaleString()}</span>
                </div>
              )}
              {instructor.precioGrupal && (
                <div className="flex justify-between items-center">
                  <span>Clase grupal</span>
                  <span className="text-xl font-bold">Gs. {instructor.precioGrupal.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ubicaciones */}
          <div className="bg-[#151921] rounded-lg border border-[#232838] p-6">
            <h2 className="text-xl font-bold mb-4">Ubicaciones</h2>
            <div className="space-y-3">
              {instructor.ubicaciones.map((ubicacion) => (
                <div key={ubicacion.id} className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#df2531]" />
                  <span>{ubicacion.ciudad}</span>
                  {ubicacion.sede && <span className="text-gray-400">- {ubicacion.sede.nombre}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Especialidades */}
          {instructor.especialidades && (
            <div className="bg-[#151921] rounded-lg border border-[#232838] p-6 md:col-span-2">
              <h2 className="text-xl font-bold mb-4">Especialidades</h2>
              <p className="text-gray-300">{instructor.especialidades}</p>
            </div>
          )}

          {/* Certificaciones */}
          {instructor.certificaciones && (
            <div className="bg-[#151921] rounded-lg border border-[#232838] p-6 md:col-span-2">
              <h2 className="text-xl font-bold mb-4">Certificaciones</h2>
              <p className="text-gray-300">{instructor.certificaciones}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={`/clases/reservar/${instructor.id}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#df2531] rounded-lg font-bold hover:bg-red-700 transition-colors"
          >
            <Calendar size={20} />
            Reservar clase
          </a>
        </div>
      </div>
    </div>
  );
}
