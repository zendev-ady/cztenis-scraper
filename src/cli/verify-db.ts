import { db } from '../database';
import { players, matches, tournaments } from '../database/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

async function verify() {
    const playerCount = await db.select({ count: sql<number>`count(*)` }).from(players).get();
    const matchCount = await db.select({ count: sql<number>`count(*)` }).from(matches).get();
    const tournamentCount = await db.select({ count: sql<number>`count(*)` }).from(tournaments).get();

    console.log('Verification Results:');
    console.log(`Players: ${playerCount?.count}`);
    console.log(`Matches: ${matchCount?.count}`);
    console.log(`Tournaments: ${tournamentCount?.count}`);

    if (matchCount?.count && matchCount.count > 0) {
        console.log('SUCCESS: Matches were scraped.');
    } else {
        console.log('FAILURE: No matches found.');
    }
}

verify().catch(console.error);
