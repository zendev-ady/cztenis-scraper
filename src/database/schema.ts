import { sqliteTable, integer, text, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Players table
export const players = sqliteTable('players', {
    id: integer('id').primaryKey(), // ID from cztenis.cz
    name: text('name').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    birthYear: integer('birth_year'),
    currentClub: text('current_club'),
    registrationValidUntil: integer('registration_valid_until', { mode: 'timestamp' }), // Stored as timestamp

    // Metadata
    lastScrapedAt: integer('last_scraped_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    nameIdx: index('idx_players_name').on(table.name),
    birthYearIdx: index('idx_players_birth_year').on(table.birthYear),
}));

// Seasons table
export const seasons = sqliteTable('seasons', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // e.g., "2026", "2025-L"
    label: text('label').notNull(), // e.g., "2025/2026"
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    seasonType: text('season_type'), // "full" | "winter" | "summer"

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Tournaments table
export const tournaments = sqliteTable('tournaments', {
    id: integer('id').primaryKey(), // ID from URL
    name: text('name'),
    venue: text('venue'),
    date: integer('date', { mode: 'timestamp' }),
    category: text('category'),
    categoryPoints: integer('category_points'),
    ageCategory: text('age_category'),
    seasonCode: text('season_code').references(() => seasons.code),
    singlesCapacity: integer('singles_capacity'),
    doublesCapacity: integer('doubles_capacity'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    dateIdx: index('idx_tournaments_date').on(table.date),
    seasonIdx: index('idx_tournaments_season').on(table.seasonCode),
}));

// Matches table
export const matches = sqliteTable('matches', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),

    matchType: text('match_type').notNull(), // "singles" | "doubles"
    competitionType: text('competition_type').notNull(), // "individual" | "team"

    round: text('round').notNull(),
    roundOrder: integer('round_order'),

    // Players (Singles)
    player1Id: integer('player1_id').references(() => players.id), // Winner (left in HTML)
    player2Id: integer('player2_id').references(() => players.id), // Loser (right in HTML)

    // Players (Doubles)
    player1PartnerId: integer('player1_partner_id').references(() => players.id),
    player2PartnerId: integer('player2_partner_id').references(() => players.id),

    // Result
    score: text('score'),
    scoreSet1: text('score_set1'),
    scoreSet2: text('score_set2'),
    scoreSet3: text('score_set3'),
    isWalkover: integer('is_walkover', { mode: 'boolean' }).default(false),

    winnerId: integer('winner_id').references(() => players.id),
    pointsEarned: integer('points_earned'),

    matchDate: integer('match_date', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    tournamentIdx: index('idx_matches_tournament').on(table.tournamentId),
    player1Idx: index('idx_matches_player1').on(table.player1Id),
    player2Idx: index('idx_matches_player2').on(table.player2Id),
    winnerIdx: index('idx_matches_winner').on(table.winnerId),
    dateIdx: index('idx_matches_date').on(table.matchDate),
    typeIdx: index('idx_matches_type').on(table.matchType, table.competitionType),
}));

// H2H Stats table
export const h2hStats = sqliteTable('h2h_stats', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    player1Id: integer('player1_id').notNull().references(() => players.id),
    player2Id: integer('player2_id').notNull().references(() => players.id),

    totalMatches: integer('total_matches').default(0),
    player1Wins: integer('player1_wins').default(0),
    player2Wins: integer('player2_wins').default(0),

    lastMatchDate: integer('last_match_date', { mode: 'timestamp' }),
    firstMatchDate: integer('first_match_date', { mode: 'timestamp' }),

    lastWinnerId: integer('last_winner_id').references(() => players.id),
    lastScore: text('last_score'),

    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    player1Idx: index('idx_h2h_player1').on(table.player1Id),
    player2Idx: index('idx_h2h_player2').on(table.player2Id),
    uniquePair: unique().on(table.player1Id, table.player2Id),
}));

// Player Rankings table
export const playerRankings = sqliteTable('player_rankings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playerId: integer('player_id').notNull().references(() => players.id),
    seasonCode: text('season_code').notNull().references(() => seasons.code),

    youthJuniorRank: integer('youth_junior_rank'),
    youthJuniorBh: integer('youth_junior_bh'),
    youthSeniorRank: integer('youth_senior_rank'),
    youthSeniorBh: integer('youth_senior_bh'),
    juniorRank: integer('junior_rank'),
    juniorBh: integer('junior_bh'),
    adultRank: integer('adult_rank'),
    adultBh: integer('adult_bh'),

    club: text('club'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    playerIdx: index('idx_rankings_player').on(table.playerId),
    seasonIdx: index('idx_rankings_season').on(table.seasonCode),
    uniqueRanking: unique().on(table.playerId, table.seasonCode),
}));

// Scrape Queue table
export const scrapeQueue = sqliteTable('scrape_queue', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playerId: integer('player_id').notNull().references(() => players.id),
    priority: integer('priority').default(0),
    status: text('status').default('pending'), // "pending" | "processing" | "completed" | "failed"
    attempts: integer('attempts').default(0),
    lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
    errorMessage: text('error_message'),

    // Depth tracking for crawl limiting
    depth: integer('depth').default(0).notNull(), // 0 = manually added, 1 = opponent of manual, 2 = opponent of opponent, etc.
    sourcePlayerId: integer('source_player_id').references(() => players.id), // Which player added this to queue (null if manually added)

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    statusIdx: index('idx_queue_status').on(table.status, table.priority),
    uniquePlayer: unique().on(table.playerId),
}));
