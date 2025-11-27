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
    .action(async (playerId?: string, options?: { player?: string }) => {
        const queueManager = new QueueManager();
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

            await queueManager.addPlayer(playerIdNum);
            logger.info(`Added player ${playerIdToAdd} to queue.`);
        }

        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...');
            queueManager.stop();
            await scraper.close();
            process.exit(0);
        });

        try {
            await queueManager.processQueue(async (playerId) => {
                await scraper.scrapePlayer(playerId);
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

program.parse();
