import { useState } from 'react';
import { searchPlayers, getH2H, type Player, type H2HData } from '../lib/api';

export default function H2HPage() {
  const [player1Query, setPlayer1Query] = useState('');
  const [player2Query, setPlayer2Query] = useState('');
  const [player1Results, setPlayer1Results] = useState<Player[]>([]);
  const [player2Results, setPlayer2Results] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<Player | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
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
      const data = await getH2H(selectedPlayer1.id, selectedPlayer2.id);
      setH2hData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání H2H');
    } finally {
      setIsLoading(false);
    }
  };

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
          {/* Stats Summary */}
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
              <div className="text-center text-sm text-gray-500">
                Poslední zápas: {new Date(h2hData.stats.lastMatchDate).toLocaleDateString('cs-CZ')}
              </div>
            )}
          </div>

          {/* Match History */}
          {h2hData.matches.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Historie vzájemných zápasů</h3>
              <div className="space-y-3">
                {h2hData.matches.map((match) => {
                  const isPlayer1Winner = match.winnerId === h2hData.player1.id;

                  return (
                    <div
                      key={match.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        isPlayer1Winner ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-lg">
                            {isPlayer1Winner ? h2hData.player1.name : h2hData.player2.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            vs {isPlayer1Winner ? h2hData.player2.name : h2hData.player1.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            {new Date(match.matchDate).toLocaleDateString('cs-CZ')}
                          </div>
                          <div className="text-sm text-gray-500">{match.round}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Skóre: {match.score}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
