interface PlayerStatsData {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  recentForm: string[];
}

interface PlayerStatsProps {
  stats: PlayerStatsData;
  isLoading?: boolean;
}

export default function PlayerStats({ stats, isLoading = false }: PlayerStatsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Statistiky</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="text-center p-4 bg-gray-100 rounded-lg animate-pulse">
              <div className="h-8 bg-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Statistiky</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Matches */}
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalMatches}</div>
          <div className="text-sm text-gray-600">Celkem zápasů</div>
        </div>

        {/* Wins */}
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
          <div className="text-sm text-gray-600">Výhry</div>
        </div>

        {/* Losses */}
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
          <div className="text-sm text-gray-600">Prohry</div>
        </div>

        {/* Win Rate */}
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{stats.winRate}%</div>
          <div className="text-sm text-gray-600">Úspěšnost</div>
        </div>
      </div>

      {/* Recent Form */}
      {stats.recentForm.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-600">Poslední forma:</span>
            <div className="flex gap-1">
              {stats.recentForm.map((result, index) => (
                <span
                  key={index}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${
                    result === 'W'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {result}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
