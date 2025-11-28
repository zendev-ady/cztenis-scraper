import { eq, and, or, sql, desc, gte, inArray } from 'drizzle-orm';
import { db } from '../index';
import { matches, tournaments } from '../schema';
import { logger } from '../../utils/logger';

export class MatchRepository {
    async create(data: typeof matches.$inferInsert) {
        // Validation: Ensure we have valid player IDs for both players
        if (!data.player1Id || !data.player2Id) {
            throw new Error(`Cannot create match: missing player IDs (player1Id: ${data.player1Id}, player2Id: ${data.player2Id})`);
        }

        // Validation: Ensure tournament ID is valid
        if (!data.tournamentId) {
            throw new Error('Cannot create match: missing tournamentId');
        }

        // Check for duplicate: match is unique by (tournamentId, round, player1Id, player2Id, matchType)
        // Since we now normalize player order (player1Id < player2Id), this should prevent
        // duplicate entries when scraping from both players' perspectives
        const existing = await db.select()
            .from(matches)
            .where(and(
                eq(matches.tournamentId, data.tournamentId),
                eq(matches.round, data.round),
                eq(matches.player1Id, data.player1Id),
                eq(matches.player2Id, data.player2Id),
                eq(matches.matchType, data.matchType)
            ))
            .get();

        if (existing) {
            // Match already exists, return it instead of creating duplicate
            logger.debug(`Match already exists: ${data.player1Id} vs ${data.player2Id} in tournament ${data.tournamentId}, round ${data.round}`);
            return existing;
        }

        return db.insert(matches).values(data).run();
    }

    async findByPlayerId(playerId: number, options?: {
        limit?: number,
        offset?: number,
        matchType?: 'singles' | 'doubles',
        year?: number
    }) {
        const { limit = 50, offset = 0, matchType, year } = options || {};

        // Build where conditions
        const conditions = [
            or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            )
        ];

        if (matchType) {
            conditions.push(eq(matches.matchType, matchType));
        }

        if (year) {
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year + 1, 0, 1);
            conditions.push(
                gte(matches.matchDate, yearStart),
                sql`${matches.matchDate} < ${yearEnd}`
            );
        }

        return db.select({
            match: matches,
            tournament: tournaments,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .orderBy(desc(matches.matchDate))
        .limit(limit)
        .offset(offset)
        .all();
    }

    async countByPlayerId(playerId: number) {
        const result = await db.select({
            count: sql<number>`COUNT(*)`
        })
        .from(matches)
        .where(
            or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            )
        )
        .get();

        return result?.count || 0;
    }

    async findBetweenPlayers(player1Id: number, player2Id: number) {
        // Find all matches where both players participated
        return db.select()
            .from(matches)
            .where(
                or(
                    and(
                        eq(matches.player1Id, player1Id),
                        eq(matches.player2Id, player2Id)
                    ),
                    and(
                        eq(matches.player1Id, player2Id),
                        eq(matches.player2Id, player1Id)
                    )
                )
            )
            .orderBy(desc(matches.matchDate))
            .all();
    }

    async findByPlayerIdWithSeasonFilters(
        playerId: number,
        options: {
            seasons?: string[],
            matchType?: 'all' | 'singles' | 'doubles',
            pageSeason?: string
        } = {}
    ) {
        const { seasons, matchType, pageSeason } = options;

        // Build where conditions
        const conditions = [
            or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            )
        ];

        if (matchType && matchType !== 'all') {
            conditions.push(eq(matches.matchType, matchType));
        }

        if (pageSeason) {
            // Only return matches from the specified season
            conditions.push(eq(tournaments.seasonCode, pageSeason));
        } else if (seasons && seasons.length > 0) {
            // If no pageSeason but seasons filter exists, use first season
            conditions.push(eq(tournaments.seasonCode, seasons[0]));
        }

        return db.select({
            match: matches,
            tournament: tournaments,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .orderBy(desc(matches.matchDate))
        .all();
    }

    async getAvailableSeasons(
        playerId: number,
        options: {
            seasons?: string[],
            matchType?: 'all' | 'singles' | 'doubles'
        } = {}
    ) {
        const { seasons, matchType } = options;

        // Build where conditions
        const conditions = [
            or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            )
        ];

        if (matchType && matchType !== 'all') {
            conditions.push(eq(matches.matchType, matchType));
        }

        if (seasons && seasons.length > 0) {
            conditions.push(inArray(tournaments.seasonCode, seasons));
        }

        const result = await db.select({
            seasonCode: tournaments.seasonCode,
            matchCount: sql<number>`COUNT(*)`,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .groupBy(tournaments.seasonCode)
        .orderBy(desc(tournaments.seasonCode))
        .all();

        return result
            .filter(r => r.seasonCode !== null)
            .map(r => r.seasonCode!);
    }
}
