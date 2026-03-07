import { useEffect, useState } from 'react';
import { rankingsService, Ranking } from '../../../services/rankingsService';
import { Trophy, TrendingUp } from 'lucide-react';

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const data = await rankingsService.getGlobal();
      setRankings(data);
    } catch (err) {
      console.error('Error loading rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Rankings</h1>

        <div className="bg-[#151921] rounded-lg border border-[#232838] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#232838]">
              <tr>
                <th className="px-6 py-4 text-left">Pos</th>
                <th className="px-6 py-4 text-left">Jugador</th>
                <th className="px-6 py-4 text-center">Torneos</th>
                <th className="px-6 py-4 text-center">Ganados</th>
                <th className="px-6 py-4 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((ranking, index) => (
                <tr key={ranking.id} className="border-t border-[#232838]">
                  <td className="px-6 py-4">
                    {index === 0 && <Trophy size={20} className="text-yellow-500" />}
                    {index === 1 && <Trophy size={20} className="text-gray-400" />}
                    {index === 2 && <Trophy size={20} className="text-amber-700" />}
                    {index > 2 && <span className="text-gray-400">{index + 1}</span>}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {ranking.jugador?.nombre} {ranking.jugador?.apellido}
                  </td>
                  <td className="px-6 py-4 text-center">{ranking.torneosJugados}</td>
                  <td className="px-6 py-4 text-center text-green-500">
                    {ranking.partidosGanados}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#df2531]">
                    <TrendingUp size={16} className="inline mr-1" />
                    {ranking.puntosTotales}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rankings.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No hay rankings disponibles
          </div>
        )}
      </div>
    </div>
  );
}
