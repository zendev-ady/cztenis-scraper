import { eq, like, sql, or, inArray, and, desc } from 'drizzle-orm';
import { db } from '../index';
import { players, matches, tournaments } from '../schema';
import { logger } from '../../utils/logger';

export class PlayerRepository {
    async upsert(data: typeof players.$inferInsert) {
        logger.debug(`Upserting player: id=${data.id}, name=${data.name}, firstName=${data.firstName}, lastName=${data.lastName}`);
        
        // Check if player exists first
        const existing = await this.findById(data.id);
        
        if (existing) {
            // Update: only update fields if new value is "better" or field is empty
            const hasNewFullName = data.name?.includes(' ');
            const hasExistingFullName = existing.name?.includes(' ');
            
            const updateData: Partial<typeof players.$inferInsert> = {
                updatedAt: new Date(),
            };
            
            // Only update name if new name has firstName (contains space) or existing doesn't
            if (hasNewFullName || !hasExistingFullName) {
                updateData.name = data.name;
            }
            
            // Only update firstName if provided and existing is empty
            if (data.firstName && !existing.firstName) {
                updateData.firstName = data.firstName;
            } else if (data.firstName) {
                updateData.firstName = data.firstName;
            }
            
            // Only update lastName if provided and existing is empty
            if (data.lastName && !existing.lastName) {
                updateData.lastName = data.lastName;
            } else if (data.lastName) {
                updateData.lastName = data.lastName;
            }
            
            // Only update other fields if provided
            if (data.birthYear !== undefined && data.birthYear !== null) {
                updateData.birthYear = data.birthYear;
            }
            if (data.currentClub !== undefined && data.currentClub !== null) {
                updateData.currentClub = data.currentClub;
            }
            if (data.registrationValidUntil !== undefined && data.registrationValidUntil !== null) {
                updateData.registrationValidUntil = data.registrationValidUntil;
            }
            
            return db.update(players)
                .set(updateData)
                .where(eq(players.id, data.id))
                .run();
        } else {
            // Insert new player
            return db.insert(players)
                .values(data)
                .run();
        }
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
        .orderBy(desc(tournaments.seasonCode))
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
