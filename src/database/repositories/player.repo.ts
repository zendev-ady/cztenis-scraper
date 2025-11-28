import { eq, like, sql, or, inArray, and } from 'drizzle-orm';
import { db } from '../index';
import { players, matches, tournaments } from '../schema';

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

    async getSeasons(playerId: number, matchType?: 'all' | 'singles' | 'doubles') {
        // Get all seasons where player has matches
        const conditions = [
            or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            )
        ];

        if (matchType && matchType !== 'all') {
            conditions.push(eq(matches.matchType, matchType));
        }

        const result = await db.select({
            seasonCode: tournaments.seasonCode,
            matchCount: sql<number>`COUNT(*)`,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .groupBy(tournaments.seasonCode)
        .all();

        // Filter out null season codes and format response
        return result
            .filter(r => r.seasonCode !== null)
            .map(r => ({
                code: r.seasonCode!,
                matchCount: r.matchCount || 0,
            }));
    }

    async getFilteredStats(
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

        // Get statistics
        const stats = await db.select({
            totalMatches: sql<number>`COUNT(*)`,
            wins: sql<number>`SUM(CASE WHEN ${matches.winnerId} = ${playerId} THEN 1 ELSE 0 END)`,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .get();

        const totalMatches = stats?.totalMatches || 0;
        const wins = stats?.wins || 0;
        const losses = totalMatches - wins;
        const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(2)) : 0;

        // Get recent form (last 5 matches)
        const recentMatches = await db.select({
            winnerId: matches.winnerId,
            matchDate: matches.matchDate,
        })
        .from(matches)
        .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .where(and(...conditions))
        .orderBy(sql`${matches.matchDate} DESC`)
        .limit(5)
        .all();

        const recentForm = recentMatches.map(m =>
            m.winnerId === playerId ? 'W' : 'L'
        );

        return {
            totalMatches,
            wins,
            losses,
            winRate,
            recentForm,
        };
    }
}
