import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { matches } from '../schema';

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
}
