import { db } from './index';
import { players, seasons } from './schema';
import { logger } from '../utils/logger';

const SEED_PLAYERS = [
    { id: 1026900, name: 'Kumstát Jan' },
    { id: 1013801, name: 'Menšík Jakub' }, // Example of another player
];

const SEED_SEASONS = [
    { code: '2026', label: '2025/2026', seasonType: 'full' },
    { code: '2025-L', label: '2024/2025 L', seasonType: 'summer' },
    { code: '2025-Z', label: '2024/2025 Z', seasonType: 'winter' },
    { code: '2024-L', label: '2023/2024 L', seasonType: 'summer' },
    { code: '2024-Z', label: '2023/2024 Z', seasonType: 'winter' },
];

async function seed() {
    logger.info('Seeding database...');

    // Seed Seasons
    for (const season of SEED_SEASONS) {
        await db.insert(seasons).values(season).onConflictDoNothing().run();
    }

    // Seed Players
    for (const player of SEED_PLAYERS) {
        await db.insert(players).values(player).onConflictDoNothing().run();
    }

    logger.info('Seeding completed.');
}

seed().catch(console.error);
