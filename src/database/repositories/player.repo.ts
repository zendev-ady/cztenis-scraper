import { eq, like, sql, or } from 'drizzle-orm';
import { db } from '../index';
import { players, matches } from '../schema';

export class PlayerRepository {
    async upsert(data: typeof players.$inferInsert) {
        return db.insert(players)
            .values(data)
            .onConflictDoUpdate({
                target: players.id,
                set: {
                    name: data.name,
                    birthYear: data.birthYear,
                    currentClub: data.currentClub,
                    registrationValidUntil: data.registrationValidUntil,
                    updatedAt: new Date(),
                },
            })
            .run();
    }

    async updateLastScraped(id: number) {
        return db.update(players)
            .set({ lastScrapedAt: new Date() })
            .where(eq(players.id, id))
            .run();
    }

    async findById(id: number) {
        return db.select().from(players).where(eq(players.id, id)).get();
    }

    async search(query: string, limit: number = 10) {
        return db.select()
            .from(players)
            .where(
                or(
                    like(players.name, `%${query}%`),
                    like(players.firstName, `%${query}%`),
                    like(players.lastName, `%${query}%`)
                )
            )
            .limit(limit)
            .all();
    }

    async getWithStats(id: number) {
        const player = await this.findById(id);
        if (!player) return null;

        // Count total matches where player participated
        const matchStats = await db.select({
            totalMatches: sql<number>`COUNT(*)`,
            wins: sql<number>`SUM(CASE WHEN ${matches.winnerId} = ${id} THEN 1 ELSE 0 END)`,
        })
        .from(matches)
        .where(
            or(
                eq(matches.player1Id, id),
                eq(matches.player2Id, id)
            )
        )
        .get();

        return {
            player,
            stats: {
                totalMatches: matchStats?.totalMatches || 0,
                wins: matchStats?.wins || 0,
                losses: (matchStats?.totalMatches || 0) - (matchStats?.wins || 0),
            }
        };
    }
}
