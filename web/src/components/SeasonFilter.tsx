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
  const allSelected = selectedSeasons.length === seasons.length;

  const handleAllClick = () => {
    // Select all seasons
    onSeasonsChange(seasons.map(s => s.code));
  };

  const handleSeasonClick = (seasonCode: string) => {
    if (allSelected) {
      // If "Vše" is active, clicking a season selects only that season
      onSeasonsChange([seasonCode]);
    } else {
      // Multi-select logic
      if (selectedSeasons.includes(seasonCode)) {
        // Remove season (but keep at least one selected)
        const newSeasons = selectedSeasons.filter(s => s !== seasonCode);
        if (newSeasons.length === 0) {
          // Don't allow deselecting the last season
          return;
        }
        onSeasonsChange(newSeasons);
      } else {
        // Add season
        onSeasonsChange([...selectedSeasons, seasonCode]);
      }
    }
  };

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
          onClick={handleAllClick}
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
          const isSelected = !allSelected && selectedSeasons.includes(season.code);
          const isDisabled = allSelected;

          return (
            <button
              key={season.code}
              onClick={() => handleSeasonClick(season.code)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isDisabled
                  ? 'bg-gray-50 text-gray-400 cursor-default'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatSeasonLabel(season.code)}
              <span className={`ml-1.5 text-xs ${isSelected ? 'opacity-75' : isDisabled ? 'opacity-50' : 'opacity-75'}`}>
                ({season.matchCount})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
