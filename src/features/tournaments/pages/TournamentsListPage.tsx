import { useEffect, useState } from 'react';
import { tournamentService, Tournament } from '../../../services/tournamentService';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';

export default function TournamentsListPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const data = await tournamentService.getAll();
      setTournaments(data);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Torneos</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <a
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="bg-[#151921] rounded-lg border border-[#232838] p-6 hover:border-[#df2531] transition-colors"
            >
              <h2 className="text-xl font-semibold mb-2">{tournament.nombre}</h2>
              
              <div className="space-y-2 text-gray-400 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>{new Date(tournament.fechaInicio).toLocaleDateString('es-PY')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>{tournament.ciudad}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#df2531] font-semibold">
                  Gs. {tournament.costoInscripcion?.toLocaleString() || 0}
                </span>
                <ChevronRight size={20} className="text-gray-500" />
              </div>
            </a>
          ))}
        </div>

        {tournaments.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No hay torneos disponibles
          </div>
        )}
      </div>
    </div>
  );
}
