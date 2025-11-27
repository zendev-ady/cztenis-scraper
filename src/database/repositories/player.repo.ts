import { eq } from 'drizzle-orm';
import { db } from '../index';
import { players } from '../schema';

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
}
