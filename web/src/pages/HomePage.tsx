import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchPlayers, type Player } from '../lib/api';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { players } = await searchPlayers(searchQuery, 10);
      setResults(players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při hledání');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  const handlePlayerClick = (playerId: number) => {
    navigate(`/player/${playerId}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          CZTenis H2H
        </h1>
        <p className="text-gray-600">
          Vyhledejte hráče a zobrazte jejich statistiky a historii zápasů
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
          Hledat hráče
        </label>
        <input
          id="search"
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Zadejte jméno hráče..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {isLoading && (
          <div className="mt-4 text-center text-gray-500">
            Načítání...
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((player) => (
              <button
                key={player.id}
                onClick={() => handlePlayerClick(player.id)}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-sm text-gray-500">
                  {player.birthYear && `Ročník: ${player.birthYear}`}
                  {player.currentClub && ` • ${player.currentClub}`}
                </div>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && !isLoading && results.length === 0 && !error && (
          <div className="mt-4 text-center text-gray-500">
            Žádní hráči nenalezeni
          </div>
        )}
      </div>
    </div>
  );
}
