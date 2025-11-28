interface Season {
  code: string;
  matchCount: number;
}

interface SeasonFilterProps {
  seasons: Season[];
  selectedSeasons: string[];
  onSeasonsChange: (seasons: string[]) => void;
}

export default function SeasonFilter({ seasons, selectedSeasons, onSeasonsChange }: SeasonFilterProps) {
  const toggleSeason = (seasonCode: string) => {
    if (selectedSeasons.includes(seasonCode)) {
      // Remove season
      const newSeasons = selectedSeasons.filter(s => s !== seasonCode);
      onSeasonsChange(newSeasons.length > 0 ? newSeasons : seasons.map(s => s.code));
    } else {
      // Add season
      onSeasonsChange([...selectedSeasons, seasonCode]);
    }
  };

  const toggleAll = () => {
    if (selectedSeasons.length === seasons.length) {
      // If all selected, keep all selected (do nothing)
      return;
    } else {
      // Select all
      onSeasonsChange(seasons.map(s => s.code));
    }
  };

  const allSelected = selectedSeasons.length === seasons.length;

  // Format season label from code
  const formatSeasonLabel = (code: string): string => {
    // Handle formats like "2026", "2025-L", "2025-Z"
    if (code.includes('-')) {
      const [year, suffix] = code.split('-');
      const prevYear = (parseInt(year) - 1).toString();
      return `${prevYear}/${year} ${suffix}`;
    }
    const prevYear = (parseInt(code) - 1).toString();
    return `${prevYear}/${code}`;
  };

  if (seasons.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Sezóny:</h3>
      <div className="flex flex-wrap gap-2">
        {/* "Vše" button */}
        <button
          onClick={toggleAll}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            allSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Vše
        </button>

        {/* Season chips */}
        {seasons.map(season => {
          const isSelected = selectedSeasons.includes(season.code);
          return (
            <button
              key={season.code}
              onClick={() => toggleSeason(season.code)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatSeasonLabel(season.code)}
              <span className="ml-1.5 text-xs opacity-75">({season.matchCount})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
