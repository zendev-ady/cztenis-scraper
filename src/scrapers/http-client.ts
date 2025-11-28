import axios, { AxiosInstance, AxiosError } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { config } from '../config';
import { logger } from '../utils/logger';
import { parsePlayerProfile, parseSeasonOptions } from './parsers/player-parser';
import { parseMatches } from './parsers/match-parser';

export interface SeasonData {
  matches: ReturnType<typeof parseMatches>;
  html: string;
}

export class HttpClient {
  private client: AxiosInstance;
  private jar: CookieJar;

  constructor() {
    this.jar = new CookieJar();

    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      // Explicitly set proxy to false to avoid issues in containerized environments
      proxy: false,
      withCredentials: false, // Changed from true to avoid CORS issues
    });

    this.client = wrapper(axiosInstance);
    (this.client.defaults as any).jar = this.jar;

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`HTTP ${error.response.status} error`, {
            url: error.config?.url,
            status: error.response.status,
            statusText: error.response.statusText,
          });
        } else if (error.request) {
          logger.error('No response received', { url: error.config?.url });
        } else {
          logger.error('Request setup error', { message: error.message });
        }
        throw error;
      }
    );
  }

  /**
   * Fetch initial player page and extract basic info + season options
   */
  async fetchPlayerPage(playerId: number): Promise<{
    html: string;
    playerInfo: ReturnType<typeof parsePlayerProfile>;
    seasons: ReturnType<typeof parseSeasonOptions>;
  }> {
    try {
      logger.debug(`Fetching player page for ID ${playerId}`);
      const response = await this.client.get(`/hrac/${playerId}`);

      const html = response.data;
      const playerInfo = parsePlayerProfile(html);
      const seasons = parseSeasonOptions(html);

      logger.debug(`Player ${playerId}: found ${seasons.length} seasons`);

      return { html, playerInfo, seasons };
    } catch (error) {
      logger.error(`Failed to fetch player page ${playerId}`, { error });
      throw error;
    }
  }

  /**
   * Fetch a specific season's data via POST request
   */
  async fetchSeasonData(playerId: number, seasonCode: string): Promise<SeasonData> {
    try {
      logger.debug(`Fetching season ${seasonCode} for player ${playerId}`);

      const response = await this.client.post(
        `/hrac/${playerId}`,
        new URLSearchParams({
          volba: '1',
          sezona: seasonCode,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${config.baseUrl}/hrac/${playerId}`,
          },
        }
      );

      const html = response.data;
      const matches = parseMatches(html, playerId);

      logger.debug(`Season ${seasonCode} for player ${playerId}: found ${matches.length} matches`);

      return { matches, html };
    } catch (error) {
      logger.error(`Failed to fetch season ${seasonCode} for player ${playerId}`, { error });
      throw error;
    }
  }

  /**
   * Delay helper for rate limiting
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the client (cleanup)
   */
  async close(): Promise<void> {
    // Nothing to explicitly close for axios, but keep for API consistency
    logger.debug('HTTP client closed');
  }
}
