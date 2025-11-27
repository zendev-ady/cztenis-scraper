import { Browser, chromium } from 'playwright';
import { config } from '../config';
import { logger } from '../utils/logger';
import { parsePlayerProfile, parseSeasonOptions } from './parsers/player-parser';
import { parseMatches } from './parsers/match-parser';
import { PlayerRepository } from '../database/repositories/player.repo';
import { MatchRepository } from '../database/repositories/match.repo';
import { TournamentRepository } from '../database/repositories/tournament.repo';
import { QueueManager } from '../services/queue-manager';
import { setTimeout } from 'timers/promises';

export class PlayerScraper {
    private browser: Browser | null = null;
    private playerRepo: PlayerRepository;
    private matchRepo: MatchRepository;
    private tournamentRepo: TournamentRepository;
    private queueManager: QueueManager;
    private pagesProcessed: number = 0;
    private readonly MAX_PAGES_PER_BROWSER = 50; // Recreate browser after 50 pages to prevent memory issues

    constructor(queueManager: QueueManager) {
        this.playerRepo = new PlayerRepository();
        this.matchRepo = new MatchRepository();
        this.tournamentRepo = new TournamentRepository();
        this.queueManager = queueManager;
    }

    async init() {
        this.browser = await chromium.launch({ headless: true });
        this.pagesProcessed = 0;
        logger.info('Browser initialized');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser closed');
        }
    }

    async ensureBrowserHealthy() {
        // Check if browser needs to be recreated
        if (this.pagesProcessed >= this.MAX_PAGES_PER_BROWSER) {
            logger.info(`Recycling browser after ${this.pagesProcessed} pages`);
            await this.close();
            await this.init();
        }

        // Check if browser is still connected
        if (this.browser && !this.browser.isConnected()) {
            logger.warn('Browser disconnected, recreating...');
            await this.close();
            await this.init();
        }
    }

    async scrapePlayer(playerId: number, currentDepth: number = 0) {
        if (!this.browser) {
            await this.init();
        }

        await this.ensureBrowserHealthy();

        let context;
        let page;

        try {
            context = await this.browser!.newContext({ userAgent: config.userAgent });
            page = await context.newPage();

            const url = `${config.baseUrl}/hrac/${playerId}`;
            logger.info(`Navigating to ${url}`);

            await page.goto(url, { timeout: config.timeout });

            this.pagesProcessed++;

            // 1. Parse Basic Info
            const html = await page.content();
            const playerInfo = parsePlayerProfile(html);

            await this.playerRepo.upsert({
                id: playerId,
                ...playerInfo,
            });

            // 2. Get Seasons
            const seasons = parseSeasonOptions(html);
            logger.info(`Found ${seasons.length} seasons for player ${playerId}`);

            // 3. Iterate Seasons
            for (const season of seasons) {
                logger.info(`Scraping season ${season.label} (${season.value}) for player ${playerId}`);

                // Ensure season exists in DB
                await this.tournamentRepo.ensureSeason(season.value, season.label);

                // Switch season via POST
                try {
                    // Check if season select element exists
                    const seasonSelect = await page.$('select[name="sezona"]');
                    if (!seasonSelect) {
                        logger.warn(`Season select not found for player ${playerId}, skipping season ${season.value}`);
                        continue;
                    }

                    // If the option is already selected, we might not need to do anything, but let's be robust.
                    const isSelected = await page.$eval(`select[name="sezona"] option[value="${season.value}"]`, (el: any) => el.selected);

                    if (!isSelected) {
                        await page.selectOption('select[name="sezona"]', season.value);
                        
                        // Check if submit button exists before clicking
                        const submitButton = await page.$('button[type="submit"]');
                        if (submitButton) {
                            await Promise.all([
                                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.timeout }),
                                page.click('button[type="submit"]'),
                            ]);
                        } else {
                            logger.warn(`Submit button not found for season ${season.value}, waiting for page reload`);
                            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.timeout });
                        }
                    }
                    
                    logger.debug(`Successfully switched to season ${season.value} for player ${playerId}`);
                } catch (e) {
                    logger.error(`Failed to switch season ${season.value} for player ${playerId}`, { error: e });
                    // Continue to try parsing anyway, sometimes the page loads without explicit season switching
                }

                // 4. Parse Matches
                const seasonHtml = await page.content();
                const matches = parseMatches(seasonHtml, playerId);
                logger.info(`Found ${matches.length} matches in season ${season.label}`);

                for (const match of matches) {
                    try {
                        // Skip matches without valid opponent (can happen with walkovers or parsing issues)
                        if (!match.opponentId) {
                            logger.warn(`Skipping match without opponent ID for player ${playerId} in tournament ${match.tournamentId}`);
                            continue;
                        }

                        // Save Tournament
                        await this.tournamentRepo.upsert({
                            id: match.tournamentId,
                            name: match.tournamentName,
                            date: match.tournamentDate,
                            seasonCode: season.value,
                        });

                        // Ensure players exist before creating match
                        const nextDepth = currentDepth + 1;

                        // Upsert opponent player
                        await this.playerRepo.upsert({
                            id: match.opponentId,
                            name: match.opponentName || 'Unknown',
                        });
                        await this.queueManager.addPlayer(match.opponentId, 0, false, nextDepth, playerId);

                        // Upsert partner if it's doubles
                        if (match.partnerId) {
                            await this.playerRepo.upsert({
                                id: match.partnerId,
                                name: match.partnerName || 'Unknown'
                            });
                            await this.queueManager.addPlayer(match.partnerId, 0, false, nextDepth, playerId);
                        }

                        // Upsert opponent partner if it's doubles
                        if (match.opponentPartnerId) {
                            await this.playerRepo.upsert({
                                id: match.opponentPartnerId,
                                name: match.opponentPartnerName || 'Unknown'
                            });
                            await this.queueManager.addPlayer(match.opponentPartnerId, 0, false, nextDepth, playerId);
                        }

                        // Verify that the main opponent player was successfully created/updated
                        const opponentExists = await this.playerRepo.findById(match.opponentId);
                        if (!opponentExists) {
                            logger.error(`Failed to ensure opponent player ${match.opponentId} exists, skipping match`);
                            continue;
                        }

                        // Save Match
                        await this.matchRepo.create({
                            tournamentId: match.tournamentId,
                            matchType: match.matchType,
                            competitionType: match.competitionType,
                            round: match.round,
                            player1Id: match.isWinner ? playerId : match.opponentId,
                            player2Id: match.isWinner ? match.opponentId : playerId,
                            player1PartnerId: match.isWinner ? match.partnerId : match.opponentPartnerId,
                            player2PartnerId: match.isWinner ? match.opponentPartnerId : match.partnerId,

                            score: match.score,
                            isWalkover: match.isWalkover,
                            winnerId: match.isWinner ? playerId : match.opponentId,
                            pointsEarned: match.pointsEarned,
                            matchDate: match.tournamentDate,
                        });
                        
                        logger.debug(`Successfully saved match: ${playerId} vs ${match.opponentId} in tournament ${match.tournamentId}`);
                    } catch (error) {
                        logger.error(`Failed to save match for player ${playerId}: ${JSON.stringify(match)}`, { error });
                        // Continue with next match instead of failing the entire season
                    }
                }

                // Delay between seasons to be nice
                await setTimeout(config.requestDelay);
            }

            // Update last scraped
            await this.playerRepo.updateLastScraped(playerId);

        } catch (error) {
            logger.error(`Error scraping player ${playerId}`, { error });
            throw error;
        } finally {
            if (page) {
                await page.close().catch(err => logger.warn(`Failed to close page: ${err.message}`));
            }
            if (context) {
                await context.close().catch(err => logger.warn(`Failed to close context: ${err.message}`));
            }
        }
    }
}
