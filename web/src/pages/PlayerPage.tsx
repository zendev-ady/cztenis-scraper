import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayer, getMatches, PlayerWithStats, MatchWithTournament } from '../lib/api';

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [playerData, setPlayerData] = useState<PlayerWithStats | null>(null);
  const [matches, setMatches] = useState<MatchWithTournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [playerResult, matchesResult] = await Promise.all([
          getPlayer(parseInt(id)),
          getMatches(parseInt(id), { limit: 50 }),
        ]);

        setPlayerData(playerResult);
        setMatches(matchesResult.matches);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chyba při načítání dat');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Načítání...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error}
        </div>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Zpět na vyhledávání
        </Link>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12 text-gray-500">
          Hráč nenalezen
        </div>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Zpět na vyhledávání
        </Link>
      </div>
    );
  }

  const { player, stats } = playerData;
  const winRate = stats.totalMatches > 0 ? (stats.wins / stats.totalMatches * 100).toFixed(1) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Zpět na vyhledávání
      </Link>

      {/* Player Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{player.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {player.birthYear && (
            <div>
              <div className="text-sm text-gray-500">Ročník</div>
              <div className="font-medium">{player.birthYear}</div>
            </div>
          )}
          {player.currentClub && (
            <div>
              <div className="text-sm text-gray-500">Klub</div>
              <div className="font-medium">{player.currentClub}</div>
            </div>
          )}
          <div>
            <div className="text-sm text-gray-500">Celkem zápasů</div>
            <div className="font-medium">{stats.totalMatches}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Úspěšnost</div>
            <div className="font-medium">{winRate}%</div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Statistiky</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
            <div className="text-sm text-gray-600">Výhry</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
            <div className="text-sm text-gray-600">Prohry</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{winRate}%</div>
            <div className="text-sm text-gray-600">Úspěšnost</div>
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Historie zápasů</h2>
        {matches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Žádné zápasy nenalezeny
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map(({ match, tournament }) => {
              const isWinner = match.winnerId === parseInt(id!);
              const opponentId = match.player1Id === parseInt(id!) ? match.player2Id : match.player1Id;

              return (
                <div
                  key={match.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    isWinner ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">
                        {isWinner ? '✓ Výhra' : '✗ Prohra'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {tournament?.name || 'Neznámý turnaj'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {new Date(match.matchDate).toLocaleDateString('cs-CZ')}
                      </div>
                      <div className="text-sm text-gray-500">{match.round}</div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Soupeř: </span>
                    <Link
                      to={`/player/${opponentId}`}
                      className="text-blue-600 hover:underline"
                    >
                      ID {opponentId}
                    </Link>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Skóre: {match.score}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
