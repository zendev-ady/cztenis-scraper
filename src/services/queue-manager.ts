import PQueue from 'p-queue';
import { ScrapeQueueRepository } from '../database/repositories/scrape-queue.repo';
import { config } from '../config';
import { logger } from '../utils/logger';
import { setTimeout } from 'timers/promises';

export class QueueManager {
    private queue: PQueue;
    private repo: ScrapeQueueRepository;
    private isRunning: boolean = false;

    constructor() {
        this.repo = new ScrapeQueueRepository();
        this.queue = new PQueue({
            concurrency: 1,
            interval: config.requestDelay,
            intervalCap: 1,
        });
    }

    async addPlayer(playerId: number, priority: number = 0, force: boolean = false) {
        await this.repo.add(playerId, priority, force);
        if (force) {
            logger.info(`Force added player ${playerId} to queue with priority ${priority}`);
        } else {
            logger.info(`Added player ${playerId} to queue with priority ${priority}`);
        }
    }

    async processQueue(processor: (playerId: number) => Promise<void>) {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('Starting queue processing...');

        while (this.isRunning) {
            const nextItem = await this.repo.getNextPending();

            if (!nextItem) {
                logger.info('Queue is empty. Waiting...');
                await setTimeout(5000); // Wait 5s before checking again
                continue;
            }

            await this.queue.add(async () => {
                const { playerId } = nextItem;

                try {
                    await this.repo.markProcessing(playerId);
                    logger.info(`Processing player ${playerId}...`);

                    await processor(playerId);

                    await this.repo.markCompleted(playerId);
                    logger.info(`Completed player ${playerId}`);
                } catch (error: any) {
                    logger.error(`Failed to process player ${playerId}`, { error: error.message });
                    await this.repo.markFailed(playerId, error.message);
                }
            });
        }
    }

    stop() {
        this.isRunning = false;
        this.queue.pause();
    }
}
