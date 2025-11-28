import { useState } from 'react';
import { searchPlayers, getH2H, type Player, type H2HData, type MatchWithTournament } from '../lib/api';
import MatchTypeFilter from '../components/MatchTypeFilter';

interface MatchGroup {
  tournamentId: number;
  tournamentName: string;
  tournamentDate: string | null;
  matchType: 'singles' | 'doubles';
  matches: MatchWithTournament[];
  effectiveDate: Date | null;
}

export default function H2HPage() {
  const [player1Query, setPlayer1Query] = useState('');
  const [player2Query, setPlayer2Query] = useState('');
  const [player1Results, setPlayer1Results] = useState<Player[]>([]);
  const [player2Results, setPlayer2Results] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<Player | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [matchType, setMatchType] = useState<'all' | 'singles' | 'doubles'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlayer1Search = async (query: string) => {
    setPlayer1Query(query);
    if (query.length < 2) {
      setPlayer1Results([]);
      return;
    }

    try {
      const { players } = await searchPlayers(query, 10);
      setPlayer1Results(players);
    } catch (err) {
      console.error('Error searching player 1:', err);
    }
  };

  const handlePlayer2Search = async (query: string) => {
    setPlayer2Query(query);
    if (query.length < 2) {
      setPlayer2Results([]);
      return;
    }

    try {
      const { players } = await searchPlayers(query, 10);
      setPlayer2Results(players);
    } catch (err) {
      console.error('Error searching player 2:', err);
    }
  };

  const selectPlayer1 = (player: Player) => {
    setSelectedPlayer1(player);
    setPlayer1Query(player.name);
    setPlayer1Results([]);
  };

  const selectPlayer2 = (player: Player) => {
    setSelectedPlayer2(player);
    setPlayer2Query(player.name);
    setPlayer2Results([]);
  };

  const handleCompare = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getH2H(selectedPlayer1.id, selectedPlayer2.id, matchType);
      setH2hData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání H2H');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchTypeChange = async (newType: 'all' | 'singles' | 'doubles') => {
    setMatchType(newType);
    
    // Refetch data if we already have results
    if (selectedPlayer1 && selectedPlayer2 && h2hData) {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getH2H(selectedPlayer1.id, selectedPlayer2.id, newType);
        setH2hData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chyba při načítání H2H');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Group matches by tournament and match type
  const getMatchGroups = (): MatchGroup[] => {
    if (!h2hData || !h2hData.matches) return [];

    const groups = new Map<string, MatchGroup>();

    for (const matchData of h2hData.matches) {
      // Handle both formats: { match, tournament } or flat match object
      const match = 'match' in matchData ? matchData.match : matchData;
      const tournament = 'tournament' in matchData ? matchData.tournament : null;
      
      if (!match || !match.tournamentId) continue;
      
      const tournamentId = match.tournamentId;
      const matchTypeKey = match.matchType as 'singles' | 'doubles';

      // Use composite key: tournamentId + matchType
      const groupKey = `${tournamentId}-${matchTypeKey}`;

      if (!groups.has(groupKey)) {
        const matchDate = match.matchDate ? new Date(match.matchDate) : null;
        const isValidDate = matchDate && !isNaN(matchDate.getTime());

        groups.set(groupKey, {
          tournamentId,
          tournamentName: tournament?.name || 'Neznámý turnaj',
          tournamentDate: tournament?.date || null,
          matchType: matchTypeKey,
          matches: [],
          effectiveDate: isValidDate ? matchDate : null,
        });
      }

      // Ensure we push the correct structure
      const normalizedMatchData: MatchWithTournament = 'match' in matchData 
        ? matchData as MatchWithTournament
        : { match: matchData as any, tournament: null };
      groups.get(groupKey)!.matches.push(normalizedMatchData);
    }

    // Sort groups by effective date (newest first)
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.effectiveDate) return 1;
      if (!b.effectiveDate) return -1;
      return b.effectiveDate.getTime() - a.effectiveDate.getTime();
    });
  };

  const matchGroups = getMatchGroups();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Head-to-Head</h1>
        <p className="text-gray-600">Porovnejte dva hráče a zobrazte jejich vzájemné statistiky</p>
      </div>

      {/* Player Selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Player 1 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hráč 1
          </label>
          <input
            type="text"
            value={player1Query}
            onChange={(e) => handlePlayer1Search(e.target.value)}
            placeholder="Zadejte jméno hráče..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {player1Results.length > 0 && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {player1Results.map((player) => (
                <button
                  key={player.id}
                  onClick={() => selectPlayer1(player)}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md text-sm"
                >
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-gray-500">
                    {player.birthYear && `${player.birthYear}`}
                    {player.currentClub && ` • ${player.currentClub}`}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedPlayer1 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <div className="font-medium text-blue-900">{selectedPlayer1.name}</div>
              <div className="text-sm text-blue-700">
                {selectedPlayer1.birthYear && `Ročník: ${selectedPlayer1.birthYear}`}
              </div>
            </div>
          )}
        </div>

        {/* Player 2 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hráč 2
          </label>
          <input
            type="text"
            value={player2Query}
            onChange={(e) => handlePlayer2Search(e.target.value)}
            placeholder="Zadejte jméno hráče..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {player2Results.length > 0 && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {player2Results.map((player) => (
                <button
                  key={player.id}
                  onClick={() => selectPlayer2(player)}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md text-sm"
                >
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-gray-500">
                    {player.birthYear && `${player.birthYear}`}
                    {player.currentClub && ` • ${player.currentClub}`}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedPlayer2 && (
            <div className="mt-3 p-3 bg-green-50 rounded-md">
              <div className="font-medium text-green-900">{selectedPlayer2.name}</div>
              <div className="text-sm text-green-700">
                {selectedPlayer2.birthYear && `Ročník: ${selectedPlayer2.birthYear}`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compare Button */}
      {selectedPlayer1 && selectedPlayer2 && (
        <div className="text-center mb-8">
          <button
            onClick={handleCompare}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Načítání...' : 'Porovnat hráče'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* H2H Results */}
      {h2hData && (
        <div className="space-y-6">
          {/* Stats Summary with Filter */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Vzájemná bilance
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{h2hData.stats.player1Wins}</div>
                <div className="text-sm text-gray-600 mt-1">{h2hData.player1.name}</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-2xl font-bold text-gray-600">
                  {h2hData.stats.totalMatches} zápasů
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{h2hData.stats.player2Wins}</div>
                <div className="text-sm text-gray-600 mt-1">{h2hData.player2.name}</div>
              </div>
            </div>
            {h2hData.stats.lastMatchDate && (
              <div className="text-center text-sm text-gray-500 mb-6">
                Poslední zápas: {new Date(h2hData.stats.lastMatchDate).toLocaleDateString('cs-CZ')}
              </div>
            )}
            
            {/* Match Type Filter */}
            <div className="border-t border-gray-200 pt-4">
              <MatchTypeFilter
                selectedType={matchType}
                onTypeChange={handleMatchTypeChange}
              />
            </div>
          </div>

          {/* Match History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Historie vzájemných zápasů</h3>
            
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Načítání zápasů...
              </div>
            ) : matchGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Žádné zápasy v této kategorii
              </div>
            ) : (
              <div className="space-y-6">
                {matchGroups.map((group) => {
                  const player1Wins = group.matches.filter(
                    ({ match }) => match.winnerId === h2hData.player1.id
                  ).length;
                  const player2Wins = group.matches.length - player1Wins;

                  return (
                    <div key={`${group.tournamentId}-${group.matchType}`} className="border border-gray-200 rounded-lg p-4">
                      {/* Tournament Header */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{group.tournamentName}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${group.matchType === 'doubles'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                            }`}>
                            {group.matchType === 'doubles' ? 'Čtyřhra' : 'Dvouhra'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-sm text-gray-500">
                            {group.effectiveDate
                              ? group.effectiveDate.toLocaleDateString('cs-CZ')
                              : group.tournamentDate
                                ? new Date(group.tournamentDate).toLocaleDateString('cs-CZ')
                                : 'Datum neznámé'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Bilance: {player1Wins}W - {player2Wins}L
                          </div>
                        </div>
                      </div>

                      {/* Tournament Matches */}
                      <div className="space-y-2">
                        {group.matches
                          .sort((a, b) => {
                            const getRoundOrder = (round: string) => {
                              const match = round.match(/^(\d+)>/);
                              return match ? parseInt(match[1], 10) : 999;
                            };
                            return getRoundOrder(b.match.round) - getRoundOrder(a.match.round);
                          })
                          .map(({ match }) => {
                            const isPlayer1Winner = match.winnerId === h2hData.player1.id;

                            return (
                              <div
                                key={match.id}
                                className={`p-3 rounded-md border-l-4 ${
                                  isPlayer1Winner ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {isPlayer1Winner ? '✓' : '✗'}
                                      </span>
                                      <span className="font-medium">
                                        {isPlayer1Winner ? h2hData.player1.name : h2hData.player2.name}
                                      </span>
                                    </div>
                                    {match.matchType === 'doubles' && (
                                      <div className="mt-1 text-sm text-gray-600">
                                        {isPlayer1Winner 
                                          ? (match.player1Id === h2hData.player1.id 
                                              ? `s partnerem` 
                                              : `s partnerem`)
                                          : (match.player1Id === h2hData.player2.id 
                                              ? `s partnerem` 
                                              : `s partnerem`)}
                                      </div>
                                    )}
                                    <div className="mt-1">
                                      <span className="text-sm text-gray-600">vs </span>
                                      <span className="font-medium">
                                        {isPlayer1Winner ? h2hData.player2.name : h2hData.player1.name}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500">{match.round}</div>
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
      )}
    </div>
  );
}
