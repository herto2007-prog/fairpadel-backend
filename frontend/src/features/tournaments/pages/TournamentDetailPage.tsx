import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { tournamentService, Tournament } from '../../../services/tournamentService';
import { Calendar, MapPin, User, Trophy } from 'lucide-react';

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadTournament();
  }, [id]);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const data = await tournamentService.getById(id!);
      setTournament(data);
    } catch (err) {
      console.error('Error loading tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!tournament) return <div className="p-8 text-center">Torneo no encontrado</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#151921] rounded-lg border border-[#232838] p-8">
          <h1 className="text-3xl font-bold mb-4">{tournament.nombre}</h1>
          
          {tournament.descripcion && (
            <p className="text-gray-300 mb-6">{tournament.descripcion}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <Calendar size={20} className="text-[#df2531]" />
                <span>Inicio: {new Date(tournament.fechaInicio).toLocaleDateString('es-PY')}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Calendar size={20} className="text-[#df2531]" />
                <span>Fin: {new Date(tournament.fechaFin).toLocaleDateString('es-PY')}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <MapPin size={20} className="text-[#df2531]" />
                <span>{tournament.ciudad}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <User size={20} className="text-[#df2531]" />
                <span>Organizador: {tournament.organizador?.nombre} {tournament.organizador?.apellido}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Trophy size={20} className="text-[#df2531]" />
                <span>Costo: Gs. {tournament.costoInscripcion?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Categorías</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {tournament.categorias?.map((cat) => (
              <a
                key={cat.id}
                href={`/fixture/${tournament.id}/${cat.category.id}`}
                className="p-4 bg-[#232838] rounded-lg text-center hover:bg-[#df2531] transition-colors"
              >
                <span className="font-medium">{cat.category.nombre}</span>
              </a>
            ))}
          </div>

          <div className="flex gap-4">
            <a
              href={`/inscripciones/tournament/${tournament.id}`}
              className="px-6 py-3 bg-[#df2531] rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Inscribirse
            </a>
            <a
              href={`/tournaments/${tournament.id}/manage`}
              className="px-6 py-3 bg-[#232838] rounded-lg font-medium hover:bg-[#2d3548] transition-colors"
            >
              Gestionar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
