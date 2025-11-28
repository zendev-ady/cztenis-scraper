import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { tournaments, seasons } from '../schema';

export class TournamentRepository {
    async upsert(data: typeof tournaments.$inferInsert) {
        return db.insert(tournaments)
            .values(data)
            .onConflictDoUpdate({
                target: tournaments.id,
                set: {
                    // Only update name if existing is null/empty AND new name is non-empty
                    name: sql`CASE 
                        WHEN tournaments.name IS NULL OR tournaments.name = '' 
                        THEN ${data.name} 
                        ELSE tournaments.name 
                    END`,
                    date: data.date,
                    // seasonCode is immutable - don't overwrite on re-scraping
                },
            })
            .run();
    }

    async ensureSeason(code: string, label: string) {
        return db.insert(seasons)
            .values({ code, label })
            .onConflictDoNothing()
            .run();
    }
}
