import PQueue from 'p-queue';
import { ScrapeQueueRepository } from '../database/repositories/scrape-queue.repo';
import { config } from '../config';
import { logger } from '../utils/logger';
import { setTimeout } from 'timers/promises';

export class QueueManager {
    private queue: PQueue;
    private repo: ScrapeQueueRepository;
    private isRunning: boolean = false;
    private maxDepth: number = -1; // -1 = unlimited
    private maxPlayers: number = -1; // -1 = unlimited
    private processedCount: number = 0;

    constructor(maxDepth: number = -1, maxPlayers: number = -1) {
        this.repo = new ScrapeQueueRepository();
        this.queue = new PQueue({
            concurrency: 1,
            interval: config.requestDelay,
            intervalCap: 1,
        });
        this.maxDepth = maxDepth;
        this.maxPlayers = maxPlayers;
    }

    async addPlayer(
        playerId: number,
        priority: number = 0,
        force: boolean = false,
        depth: number = 0,
        sourcePlayerId?: number
    ) {
        // Check if depth exceeds max depth
        if (this.maxDepth >= 0 && depth > this.maxDepth) {
            logger.debug(`Skipping player ${playerId} - depth ${depth} exceeds max depth ${this.maxDepth}`);
            return;
        }

        await this.repo.add(playerId, priority, force, depth, sourcePlayerId);
        if (force) {
            logger.info(`Force added player ${playerId} to queue with priority ${priority}, depth ${depth}`);
        } else {
            logger.info(`Added player ${playerId} to queue with priority ${priority}, depth ${depth}`);
        }
    }

    async processQueue(processor: (playerId: number, depth: number) => Promise<void>) {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('Starting queue processing...');

        while (this.isRunning) {
            // Check if we've reached the player limit
            if (this.maxPlayers >= 0 && this.processedCount >= this.maxPlayers) {
                logger.info(`Reached player limit of ${this.maxPlayers}. Stopping queue processing.`);
                this.stop();
                break;
            }

            const nextItem = await this.repo.getNextPending();

            if (!nextItem) {
                logger.info('Queue is empty. Waiting...');
                await setTimeout(5000); // Wait 5s before checking again
                continue;
            }

            await this.queue.add(async () => {
                const { playerId, depth } = nextItem;

                try {
                    await this.repo.markProcessing(playerId);
                    logger.info(`Processing player ${playerId} (depth ${depth})... [${this.processedCount + 1}${this.maxPlayers >= 0 ? `/${this.maxPlayers}` : ''}]`);

                    await processor(playerId, depth || 0);

                    await this.repo.markCompleted(playerId);
                    this.processedCount++;
                    logger.info(`Completed player ${playerId} [${this.processedCount}${this.maxPlayers >= 0 ? `/${this.maxPlayers}` : ''} processed]`);
                } catch (error: any) {
                    logger.error(`Failed to process player ${playerId}`, { error: error.message });
                    await this.repo.markFailed(playerId, error.message);
                    this.processedCount++; // Count failed players too
                }
            });
        }
    }

    stop() {
        this.isRunning = false;
        this.queue.pause();
    }
}
