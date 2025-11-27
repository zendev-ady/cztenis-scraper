import { eq, sql, and } from 'drizzle-orm';
import { db } from '../index';
import { scrapeQueue } from '../schema';

export class ScrapeQueueRepository {
    async add(playerId: number, priority: number = 0, force: boolean = false) {
        if (force) {
            return db.insert(scrapeQueue)
                .values({ playerId, priority, status: 'pending' })
                .onConflictDoUpdate({
                    target: scrapeQueue.playerId,
                    set: { status: 'pending', priority, errorMessage: null }
                })
                .run();
        }
        return db.insert(scrapeQueue)
            .values({
                playerId,
                priority,
                status: 'pending',
            })
            .onConflictDoNothing()
            .run();
    }

    async markProcessing(playerId: number) {
        return db.update(scrapeQueue)
            .set({
                status: 'processing',
                lastAttemptAt: new Date(),
                attempts: sql`attempts + 1`,
            })
            .where(eq(scrapeQueue.playerId, playerId))
            .run();
    }

    async markCompleted(playerId: number) {
        return db.update(scrapeQueue)
            .set({
                status: 'completed',
                errorMessage: null,
            })
            .where(eq(scrapeQueue.playerId, playerId))
            .run();
    }

    async markFailed(playerId: number, errorMessage: string) {
        return db.update(scrapeQueue)
            .set({
                status: 'failed',
                errorMessage,
            })
            .where(eq(scrapeQueue.playerId, playerId))
            .run();
    }

    async getNextPending() {
        // Get pending items ordered by priority (desc) and creation time (asc)
        const result = await db.select()
            .from(scrapeQueue)
            .where(eq(scrapeQueue.status, 'pending'))
            .orderBy(sql`${scrapeQueue.priority} DESC`, scrapeQueue.createdAt)
            .limit(1);

        return result[0] || null;
    }

    async countPending() {
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(scrapeQueue)
            .where(eq(scrapeQueue.status, 'pending'));

        return result[0].count;
    }
}
