import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  getPlayer,
  getPlayerSeasons,
  getPlayerMatches,
  type PlayerWithStats,
  type Season,
  type PlayerMatchesResponse,
  type MatchWithTournament,
} from '../lib/api';
import SeasonFilter from '../components/SeasonFilter';
import MatchTypeFilter from '../components/MatchTypeFilter';
import PlayerStats from '../components/PlayerStats';
import SeasonPagination from '../components/SeasonPagination';

interface MatchGroup {
  tournamentId: number;
  tournamentName: string;
  tournamentDate: string | null;
  matchType: 'singles' | 'doubles';
  matches: MatchWithTournament[];
}

interface PlayerCache {
  [key: number]: { id: number; name: string } | null;
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Player data
  const [playerData, setPlayerData] = useState<PlayerWithStats | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);

  // Filters
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<'all' | 'singles' | 'doubles'>('all');
  const [pageSeason, setPageSeason] = useState<string | null>(null);

  // Matches data
  const [matchesData, setMatchesData] = useState<PlayerMatchesResponse | null>(null);
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);
  const [playerCache, setPlayerCache] = useState<PlayerCache>({});

  // Loading states
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from URL on mount
  useEffect(() => {
    const seasonsParam = searchParams.get('seasons');
    const typeParam = searchParams.get('type');
    const seasonParam = searchParams.get('season');

    if (typeParam && ['all', 'singles', 'doubles'].includes(typeParam)) {
      setMatchType(typeParam as 'all' | 'singles' | 'doubles');
    }
    if (seasonParam) {
      setPageSeason(seasonParam);
    }
    if (seasonsParam) {
      setSelectedSeasons(seasonsParam.split(',').filter(s => s.trim()));
    }
  }, []);

  // Helper function to sort seasons from newest to oldest
  const sortSeasons = (seasons: Season[]): Season[] => {
    return [...seasons].sort((a, b) => {
      // Parse season codes (e.g., "2026", "2025-L", "2025-Z")
      const parseSeasonCode = (code: string): { year: number; suffix: string } => {
        const parts = code.split('-');
        return {
          year: parseInt(parts[0]),
          suffix: parts[1] || '', // empty string if no suffix
        };
      };

      const aParsed = parseSeasonCode(a.code);
      const bParsed = parseSeasonCode(b.code);

      // Sort by year descending
      if (aParsed.year !== bParsed.year) {
        return bParsed.year - aParsed.year;
      }

      // If same year, sort by suffix descending (Z > L)
      return bParsed.suffix.localeCompare(aParsed.suffix);
    });
  };

  // Fetch player data and seasons
  useEffect(() => {
    if (!id) return;

    const fetchPlayerData = async () => {
      setIsLoadingPlayer(true);
      setError(null);

      try {
        const [playerResult, seasonsResult] = await Promise.all([
          getPlayer(parseInt(id)),
          getPlayerSeasons(parseInt(id), matchType),
        ]);

        setPlayerData(playerResult);

        // Sort seasons from newest to oldest
        const sortedSeasons = sortSeasons(seasonsResult.seasons);
        setSeasons(sortedSeasons);

        // Initialize selected seasons if not set from URL
        if (selectedSeasons.length === 0) {
          setSelectedSeasons(sortedSeasons.map(s => s.code));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chyba při načítání dat hráče');
      } finally {
        setIsLoadingPlayer(false);
      }
    };

    fetchPlayerData();
  }, [id, matchType]);

  // Fetch matches when filters change
  useEffect(() => {
    if (!id || selectedSeasons.length === 0) return;

    const fetchMatches = async () => {
      setIsLoadingMatches(true);

      try {
        const result = await getPlayerMatches(parseInt(id), {
          seasons: selectedSeasons,
          type: matchType,
          season: pageSeason || undefined,
        });

        setMatchesData(result);

        // Group matches by tournament AND match type
        const groups = new Map<string, MatchGroup>();

        for (const matchData of result.matches) {
          const { match, tournament } = matchData;
          const tournamentId = match.tournamentId;
          const matchTypeKey = match.matchType as 'singles' | 'doubles';

          // Use composite key: tournamentId + matchType
          const groupKey = `${tournamentId}-${matchTypeKey}`;

          if (!groups.has(groupKey)) {
            groups.set(groupKey, {
              tournamentId,
              tournamentName: tournament?.name || 'Neznámý turnaj',
              tournamentDate: tournament?.date || null,
              matchType: matchTypeKey,
              matches: [],
            });
          }

          groups.get(groupKey)!.matches.push(matchData);
        }

        // Convert to array and sort by tournament date (newest first)
        const groupedMatches = Array.from(groups.values()).sort((a, b) => {
          if (!a.tournamentDate) return 1;
          if (!b.tournamentDate) return -1;
          return new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime();
        });

        setMatchGroups(groupedMatches);

        // Fetch opponent and partner names
        const playerIdsToFetch = new Set<number>();
        result.matches.forEach(({ match }) => {
          const currentPlayerId = parseInt(id);

          // Add opponent
          const opponentId = match.player1Id === currentPlayerId ? match.player2Id : match.player1Id;
          playerIdsToFetch.add(opponentId);

          // Add partners for doubles matches
          if (match.matchType === 'doubles') {
            if (match.player1PartnerId) playerIdsToFetch.add(match.player1PartnerId);
            if (match.player2PartnerId) playerIdsToFetch.add(match.player2PartnerId);
          }
        });

        // Fetch all player data (opponents and partners)
        const cache: PlayerCache = {};
        await Promise.all(
          Array.from(playerIdsToFetch).map(async (playerId) => {
            try {
              const player = await getPlayer(playerId);
              cache[playerId] = {
                id: player.player.id,
                name: player.player.name,
              };
            } catch {
              cache[playerId] = null;
            }
          })
        );

        setPlayerCache(cache);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chyba při načítání zápasů');
      } finally {
        setIsLoadingMatches(false);
      }
    };

    fetchMatches();
  }, [id, selectedSeasons, matchType, pageSeason]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedSeasons.length > 0 && selectedSeasons.length !== seasons.length) {
      params.set('seasons', selectedSeasons.join(','));
    }
    if (matchType !== 'all') {
      params.set('type', matchType);
    }
    if (pageSeason) {
      params.set('season', pageSeason);
    }

    setSearchParams(params, { replace: true });
  }, [selectedSeasons, matchType, pageSeason, seasons.length]);

  // Handlers
  const handleSeasonsChange = (newSeasons: string[]) => {
    setSelectedSeasons(newSeasons);
    setPageSeason(null); // Reset page season when filter changes
  };

  const handleMatchTypeChange = (newType: 'all' | 'singles' | 'doubles') => {
    setMatchType(newType);
    setPageSeason(null); // Reset page season when filter changes
  };

  const handlePageSeasonChange = (season: string) => {
    setPageSeason(season);
  };

  if (isLoadingPlayer) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Načítání...</div>
      </div>
    );
  }

  if (error && !playerData) {
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

  const { player } = playerData;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Zpět na vyhledávání
      </Link>

      {/* Player Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{player.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Stats Card */}
      {matchesData && (
        <PlayerStats stats={matchesData.stats} isLoading={isLoadingMatches} />
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Filtry</h2>

        <MatchTypeFilter
          selectedType={matchType}
          onTypeChange={handleMatchTypeChange}
        />

        <SeasonFilter
          seasons={seasons}
          selectedSeasons={selectedSeasons}
          onSeasonsChange={handleSeasonsChange}
        />
      </div>

      {/* Match History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Historie zápasů</h2>

        {isLoadingMatches ? (
          <div className="text-center py-8 text-gray-500">
            Načítání zápasů...
          </div>
        ) : matchGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Žádné zápasy nenalezeny
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {matchGroups.map((group) => {
                const wins = group.matches.filter(
                  ({ match }) => match.winnerId === parseInt(id!)
                ).length;
                const total = group.matches.length;

                return (
                  <div key={`${group.tournamentId}-${group.matchType}`} className="border border-gray-200 rounded-lg p-4">
                    {/* Tournament Header */}
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{group.tournamentName}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${group.matchType === 'doubles'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                          }`}>
                          {group.matchType === 'doubles' ? 'Čtyřhra' : 'Dvouhra'}
                        </span>
                      </div>
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
                      {group.matches
                        .sort((a, b) => {
                          const getRoundOrder = (round: string) => {
                            const match = round.match(/^(\d+)>/);
                            return match ? parseInt(match[1], 10) : 999;
                          };
                          return getRoundOrder(b.match.round) - getRoundOrder(a.match.round);
                        })
                        .map(({ match }) => {
                          const isWinner = match.winnerId === parseInt(id!);
                          const currentPlayerId = parseInt(id!);

                          let opponentId: number;
                          let partnerId: number | null = null;
                          let opponentPartnerId: number | null = null;

                          if (match.player1Id === currentPlayerId) {
                            opponentId = match.player2Id;
                            partnerId = match.player1PartnerId || null;
                            opponentPartnerId = match.player2PartnerId || null;
                          } else {
                            opponentId = match.player1Id;
                            partnerId = match.player2PartnerId || null;
                            opponentPartnerId = match.player1PartnerId || null;
                          }

                          const opponent = playerCache[opponentId];
                          const partner = partnerId ? playerCache[partnerId] : null;
                          const opponentPartner = opponentPartnerId ? playerCache[opponentPartnerId] : null;

                          return (
                            <div
                              key={match.id}
                              className={`p-3 rounded-md border-l-4 ${isWinner
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
                                  {match.matchType === 'doubles' && partner && (
                                    <div className="mt-1 text-sm text-gray-600">
                                      s {partner.name}
                                    </div>
                                  )}
                                  <div className="mt-1">
                                    <span className="text-sm text-gray-600">vs </span>
                                    <Link
                                      to={`/player/${opponentId}`}
                                      className="text-blue-600 hover:underline font-medium"
                                    >
                                      {opponent ? opponent.name : `Hráč ${opponentId}`}
                                    </Link>
                                    {match.matchType === 'doubles' && opponentPartner && (
                                      <>
                                        <span className="text-sm text-gray-600">, </span>
                                        <Link
                                          to={`/player/${opponentPartnerId}`}
                                          className="text-blue-600 hover:underline font-medium"
                                        >
                                          {opponentPartner.name}
                                        </Link>
                                      </>
                                    )}
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

            {/* Pagination */}
            {matchesData && matchesData.displayedSeason && (
              <SeasonPagination
                pagination={matchesData.pagination}
                displayedSeason={matchesData.displayedSeason}
                matchCount={matchesData.matches.length}
                onSeasonChange={handlePageSeasonChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
