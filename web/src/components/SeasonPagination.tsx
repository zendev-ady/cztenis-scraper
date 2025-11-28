interface PaginationInfo {
  availableSeasons: string[];
  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface SeasonPaginationProps {
  pagination: PaginationInfo;
  displayedSeason: string;
  matchCount: number;
  onSeasonChange: (season: string) => void;
}

export default function SeasonPagination({
  pagination,
  displayedSeason,
  matchCount,
  onSeasonChange,
}: SeasonPaginationProps) {
  const { availableSeasons, currentIndex, hasPrev, hasNext } = pagination;

  // Format season label from code
  const formatSeasonLabel = (code: string): string => {
    if (code.includes('-')) {
      const [year, suffix] = code.split('-');
      const prevYear = (parseInt(year) - 1).toString();
      return `${prevYear}/${year} ${suffix}`;
    }
    const prevYear = (parseInt(code) - 1).toString();
    return `${prevYear}/${code}`;
  };

  const handlePrev = () => {
    if (hasPrev && currentIndex < availableSeasons.length - 1) {
      onSeasonChange(availableSeasons[currentIndex + 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && currentIndex > 0) {
      onSeasonChange(availableSeasons[currentIndex - 1]);
    }
  };

  // Hide pagination if only one season
  if (availableSeasons.length <= 1) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            hasPrev
              ? 'text-blue-600 hover:bg-blue-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
        >
          <span className="mr-2">←</span>
          Starší
        </button>

        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">
            Sezóna {formatSeasonLabel(displayedSeason)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {matchCount} {matchCount === 1 ? 'zápas' : matchCount < 5 ? 'zápasy' : 'zápasů'}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={!hasNext}
          className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            hasNext
              ? 'text-blue-600 hover:bg-blue-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
        >
          Novější
          <span className="ml-2">→</span>
        </button>
      </div>
    </div>
  );
}
