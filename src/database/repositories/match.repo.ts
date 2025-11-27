import { eq, and, or, sql, desc, gte } from 'drizzle-orm';
import { db } from '../index';
import { matches, tournaments } from '../schema';

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

        // We don't have a unique constraint on matches because it's hard to define uniqueness
        // (same players can play multiple times, even in same tournament if round robin?)
        // But usually (tournamentId, round, player1Id, player2Id) should be unique.
        // For now, we'll just insert. To avoid duplicates on re-scrape, we might need to delete old matches for the tournament/player?
        // Or we can try to find if it exists.

        // Simple check: if match exists with same tournament, round, and players, skip.
        const existing = await db.select()
            .from(matches)
            .where(and(
                eq(matches.tournamentId, data.tournamentId),
                eq(matches.round, data.round),
                eq(matches.player1Id, data.player1Id),
                eq(matches.player2Id, data.player2Id)
            ))
            .get();

        if (existing) {
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
}
