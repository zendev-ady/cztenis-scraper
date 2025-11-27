import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayer, getMatches, type PlayerWithStats, type MatchWithTournament } from '../lib/api';

interface MatchGroup {
  tournamentId: number;
  tournamentName: string;
  tournamentDate: string | null;
  matches: MatchWithTournament[];
}

interface PlayerCache {
  [key: number]: { id: number; name: string } | null;
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [playerData, setPlayerData] = useState<PlayerWithStats | null>(null);
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);
  const [playerCache, setPlayerCache] = useState<PlayerCache>({});
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
          getMatches(parseInt(id), { limit: 100 }),
        ]);

        setPlayerData(playerResult);

        // Group matches by tournament
        const groups = new Map<number, MatchGroup>();

        for (const matchData of matchesResult.matches) {
          const { match, tournament } = matchData;
          const tournamentId = match.tournamentId;

          if (!groups.has(tournamentId)) {
            groups.set(tournamentId, {
              tournamentId,
              tournamentName: tournament?.name || 'Neznámý turnaj',
              tournamentDate: tournament?.date || null,
              matches: [],
            });
          }

          groups.get(tournamentId)!.matches.push(matchData);
        }

        // Convert to array and sort by tournament date (newest first)
        const groupedMatches = Array.from(groups.values()).sort((a, b) => {
          if (!a.tournamentDate) return 1;
          if (!b.tournamentDate) return -1;
          return new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime();
        });

        setMatchGroups(groupedMatches);

        // Fetch opponent names
        const opponentIds = new Set<number>();
        matchesResult.matches.forEach(({ match }) => {
          const opponentId = match.player1Id === parseInt(id) ? match.player2Id : match.player1Id;
          opponentIds.add(opponentId);
        });

        // Fetch all opponent data
        const cache: PlayerCache = {};
        await Promise.all(
          Array.from(opponentIds).map(async (opponentId) => {
            try {
              const opponent = await getPlayer(opponentId);
              cache[opponentId] = {
                id: opponent.player.id,
                name: opponent.player.name
              };
            } catch {
              cache[opponentId] = null;
            }
          })
        );

        setPlayerCache(cache);
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

      {/* Match History grouped by tournament */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Historie zápasů</h2>
        {matchGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Žádné zápasy nenalezeny
          </div>
        ) : (
          <div className="space-y-6">
            {matchGroups.map((group) => {
              const wins = group.matches.filter(
                ({ match }) => match.winnerId === parseInt(id!)
              ).length;
              const total = group.matches.length;

              return (
                <div key={group.tournamentId} className="border border-gray-200 rounded-lg p-4">
                  {/* Tournament Header */}
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900">{group.tournamentName}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-sm text-gray-500">
                        {group.tournamentDate &&
                          new Date(group.tournamentDate).toLocaleDateString('cs-CZ')}
                      </div>
                      <div className="text-sm text-gray-600">
                        Bilance: {wins}W - {total - wins}L
                      </div>
                    </div>
                  </div>

                  {/* Tournament Matches */}
                  <div className="space-y-2">
                    {group.matches.map(({ match }) => {
                      const isWinner = match.winnerId === parseInt(id!);
                      const opponentId =
                        match.player1Id === parseInt(id!) ? match.player2Id : match.player1Id;
                      const opponent = playerCache[opponentId];

                      return (
                        <div
                          key={match.id}
                          className={`p-3 rounded-md border-l-4 ${
                            isWinner
                              ? 'border-green-500 bg-green-50'
                              : 'border-red-500 bg-red-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {isWinner ? '✓' : '✗'}
                                </span>
                                <span className="text-sm text-gray-600">{match.round}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-sm text-gray-600">vs </span>
                                <Link
                                  to={`/player/${opponentId}`}
                                  className="text-blue-600 hover:underline font-medium"
                                >
                                  {opponent ? opponent.name : `Hráč ${opponentId}`}
                                </Link>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900">{match.score}</div>
                              {match.isWalkover && (
                                <div className="text-xs text-gray-500 mt-1">Kontumace</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
