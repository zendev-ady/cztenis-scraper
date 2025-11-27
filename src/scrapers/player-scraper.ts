import { config } from '../config';
import { logger } from '../utils/logger';
import { HttpClient } from './http-client';
import { PlayerRepository } from '../database/repositories/player.repo';
import { MatchRepository } from '../database/repositories/match.repo';
import { TournamentRepository } from '../database/repositories/tournament.repo';
import { QueueManager } from '../services/queue-manager';
import { AdaptiveRateLimiter } from '../utils/adaptive-rate-limiter';
import { QualityMonitor } from '../services/quality-monitor';
import { validateMatch } from '../validators/match-validator';

export class PlayerScraper {
    private httpClient: HttpClient;
    private playerRepo: PlayerRepository;
    private matchRepo: MatchRepository;
    private tournamentRepo: TournamentRepository;
    private queueManager: QueueManager;
    private rateLimiter: AdaptiveRateLimiter;
    private qualityMonitor: QualityMonitor;

    constructor(queueManager: QueueManager, qualityMonitor?: QualityMonitor) {
        this.httpClient = new HttpClient();
        this.playerRepo = new PlayerRepository();
        this.matchRepo = new MatchRepository();
        this.tournamentRepo = new TournamentRepository();
        this.queueManager = queueManager;
        this.rateLimiter = new AdaptiveRateLimiter();
        this.qualityMonitor = qualityMonitor || new QualityMonitor();
    }

    async init() {
        logger.info('HTTP-based scraper initialized');
    }

    async close() {
        await this.httpClient.close();
        logger.info('HTTP client closed');
    }

    async scrapePlayer(playerId: number, currentDepth: number = 0) {
        try {
            logger.info(`Scraping player ${playerId}`);

            // 1. Fetch initial player page
            await this.rateLimiter.waitForNextRequest();

            const { playerInfo, seasons } = await this.httpClient.fetchPlayerPage(playerId);
            this.rateLimiter.onSuccess();

            // 2. Save player info
            await this.playerRepo.upsert({
                id: playerId,
                ...playerInfo,
            });

            logger.info(`Player ${playerId} (${playerInfo.name}): found ${seasons.length} seasons`);

            let totalMatches = 0;

            // 3. Iterate through each season
            for (const season of seasons) {
                try {
                    logger.info(`Scraping season ${season.label} (${season.value}) for player ${playerId}`);

                    // Ensure season exists in DB
                    await this.tournamentRepo.ensureSeason(season.value, season.label);

                    // Fetch season data via POST
                    await this.rateLimiter.waitForNextRequest();

                    const { matches } = await this.httpClient.fetchSeasonData(playerId, season.value);
                    this.rateLimiter.onSuccess();

                    logger.info(`Season ${season.label}: found ${matches.length} matches`);
                    totalMatches += matches.length;

                    this.qualityMonitor.recordSeason(season.value, matches.length);

                    // 4. Process each match
                    for (const match of matches) {
                        try {
                            // Validate match
                            const validation = validateMatch(match);
                            this.qualityMonitor.recordMatch(match, validation);

                            // Skip invalid matches (unless it's just warnings)
                            if (!validation.isValid) {
                                logger.warn(`Skipping invalid match for player ${playerId} in tournament ${match.tournamentId}`, {
                                    errors: validation.errors,
                                });
                                continue;
                            }

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
                } catch (error) {
                    logger.error(`Failed to scrape season ${season.value} for player ${playerId}`, { error });
                    this.rateLimiter.onError();
                    // Continue with next season instead of failing the entire player
                }
            }

            // Update last scraped
            await this.playerRepo.updateLastScraped(playerId);
            this.qualityMonitor.recordPlayer(playerId, totalMatches);

            logger.info(`Completed scraping player ${playerId}: ${totalMatches} total matches`);

        } catch (error) {
            logger.error(`Error scraping player ${playerId}`, { error });
            this.rateLimiter.onError();
            throw error;
        }
    }

    /**
     * Get the quality monitor for reporting
     */
    getQualityMonitor(): QualityMonitor {
        return this.qualityMonitor;
    }
}
