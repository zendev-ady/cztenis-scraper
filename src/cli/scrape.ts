import { program } from 'commander';
import { QueueManager } from '../services/queue-manager';
import { PlayerScraper } from '../scrapers/player-scraper';
import { PlayerRepository } from '../database/repositories/player.repo';
import { logger } from '../utils/logger';
import { db } from '../database';
import { scrapeQueue } from '../database/schema';
import { eq } from 'drizzle-orm';

program
    .command('start')
    .description('Start scraping from queue or add a player to scrape')
    .argument('[playerId]', 'Optional player ID to add to queue')
    .option('--player <id>', 'Player ID to add to queue (alternative syntax)')
    .option('--max-depth <depth>', 'Maximum crawl depth (-1 = unlimited, 0 = only specified player, 1 = player + opponents, etc.)', '-1')
    .action(async (playerId?: string, options?: { player?: string; maxDepth?: string }) => {
        const maxDepth = parseInt(options?.maxDepth || '-1', 10);
        logger.info(`Starting scraper with max depth: ${maxDepth === -1 ? 'unlimited' : maxDepth}`);

        const queueManager = new QueueManager(maxDepth);
        const scraper = new PlayerScraper(queueManager);
        await scraper.init();

        const playerIdToAdd = playerId || options?.player;
        if (playerIdToAdd) {
            const playerIdNum = parseInt(playerIdToAdd, 10);

            // Ensure player exists in database before adding to queue
            const playerRepo = new PlayerRepository();
            await playerRepo.upsert({
                id: playerIdNum,
                name: `Player ${playerIdNum}`, // Placeholder name, will be updated when scraped
            });

            // Manually added players start at depth 0
            await queueManager.addPlayer(playerIdNum, 0, false, 0);
            logger.info(`Added player ${playerIdToAdd} to queue with depth 0.`);
        }

        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...');
            queueManager.stop();
            await scraper.close();
            process.exit(0);
        });

        try {
            await queueManager.processQueue(async (playerId, depth) => {
                await scraper.scrapePlayer(playerId, depth);
            });
        } catch (error) {
            logger.error('Fatal error in scraper', { error });
            await scraper.close();
            process.exit(1);
        }
    });

program
    .command('reset-queue')
    .description('Reset failed items in queue to pending')
    .action(async () => {
        await db.update(scrapeQueue)
            .set({ status: 'pending', errorMessage: null })
            .where(eq(scrapeQueue.status, 'failed'))
            .run();
        logger.info('Reset failed queue items.');
    });

program
    .command('clear-queue')
    .description('Clear entire scrape queue (use with caution!)')
    .action(async () => {
        const result = await db.delete(scrapeQueue).run();
        logger.info(`Cleared entire scrape queue. Deleted ${result.changes} items.`);
    });

program.parse();
