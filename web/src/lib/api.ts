const API_BASE = 'http://localhost:3001/api';

export interface Player {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  birthYear?: number | null;
  currentClub?: string | null;
  registrationValidUntil?: string | null;
  lastScrapedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PlayerStats {
  totalMatches: number;
  wins: number;
  losses: number;
}

export interface PlayerWithStats {
  player: Player;
  stats: PlayerStats;
}

export interface Tournament {
  id: number;
  name: string;
  venue?: string | null;
  date?: string | null;
  category?: string | null;
  categoryPoints?: number | null;
  ageCategory?: string | null;
  seasonCode?: string | null;
  singlesCapacity?: number | null;
  doublesCapacity?: number | null;
  createdAt?: string | null;
}

export interface Match {
  id: number;
  tournamentId: number;
  matchType: 'singles' | 'doubles';
  competitionType?: string | null;
  round: string;
  roundOrder?: number | null;
  player1Id: number;
  player2Id: number;
  player1PartnerId?: number | null;
  player2PartnerId?: number | null;
  score: string;
  scoreSet1?: string | null;
  scoreSet2?: string | null;
  scoreSet3?: string | null;
  isWalkover: boolean;
  winnerId: number;
  pointsEarned: number;
  matchDate: string;
  createdAt?: string | null;
}

export interface MatchWithTournament {
  match: Match;
  tournament: Tournament | null;
}

export interface H2HStats {
  totalMatches: number;
  player1Wins: number;
  player2Wins: number;
  lastMatchDate: string | null;
  firstMatchDate: string | null;
}

export interface H2HData {
  player1: Player;
  player2: Player;
  stats: H2HStats;
  matches: MatchWithTournament[];
}

export interface Season {
  code: string;
  matchCount: number;
}

export interface FilteredPlayerStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  recentForm: string[];
}

export interface PaginationInfo {
  availableSeasons: string[];
  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PlayerMatchesResponse {
  matches: MatchWithTournament[];
  displayedSeason: string | null;
  pagination: PaginationInfo;
  stats: FilteredPlayerStats;
}

export async function searchPlayers(query: string, limit: number = 10): Promise<{ players: Player[] }> {
  const res = await fetch(`${API_BASE}/players/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to search players: ${res.statusText}`);
  }
  return res.json();
}

export async function getPlayer(id: number): Promise<PlayerWithStats> {
  const res = await fetch(`${API_BASE}/players/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to get player: ${res.statusText}`);
  }
  return res.json();
}

export async function getMatches(
  playerId: number,
  options: {
    limit?: number;
    offset?: number;
    matchType?: 'singles' | 'doubles';
    year?: number;
  } = {}
): Promise<{ matches: MatchWithTournament[]; total: number }> {
  const params = new URLSearchParams({ playerId: String(playerId) });

  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.offset !== undefined) params.append('offset', String(options.offset));
  if (options.matchType) params.append('matchType', options.matchType);
  if (options.year) params.append('year', String(options.year));

  const res = await fetch(`${API_BASE}/matches?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get matches: ${res.statusText}`);
  }
  return res.json();
}

export async function getH2H(
  player1Id: number,
  player2Id: number,
  matchType: 'all' | 'singles' | 'doubles' = 'all'
): Promise<H2HData> {
  const params = new URLSearchParams({
    player1Id: String(player1Id),
    player2Id: String(player2Id),
    matchType: matchType,
  });
  const res = await fetch(`${API_BASE}/h2h?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get H2H: ${res.statusText}`);
  }
  return res.json();
}

export async function getPlayerSeasons(
  playerId: number,
  matchType: 'all' | 'singles' | 'doubles' = 'all'
): Promise<{ seasons: Season[] }> {
  const res = await fetch(`${API_BASE}/players/${playerId}/seasons?type=${matchType}`);
  if (!res.ok) {
    throw new Error(`Failed to get player seasons: ${res.statusText}`);
  }
  return res.json();
}

export async function getPlayerMatches(
  playerId: number,
  options: {
    seasons?: string[];
    type?: 'all' | 'singles' | 'doubles';
    season?: string;
  } = {}
): Promise<PlayerMatchesResponse> {
  const params = new URLSearchParams();

  if (options.seasons && options.seasons.length > 0) {
    params.append('seasons', options.seasons.join(','));
  }
  if (options.type) {
    params.append('type', options.type);
  }
  if (options.season) {
    params.append('season', options.season);
  }

  const url = `${API_BASE}/players/${playerId}/matches${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to get player matches: ${res.statusText}`);
  }
  return res.json();
}
