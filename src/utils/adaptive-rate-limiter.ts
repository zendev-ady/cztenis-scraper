import { config } from '../config';
import { logger } from './logger';

export class AdaptiveRateLimiter {
  private lastRequestTime = 0;
  private currentDelay: number;
  private consecutiveErrors = 0;
  private consecutiveSuccesses = 0;

  constructor(
    private baseDelay = config.requestDelay,
    private minDelay = config.minDelay || 300,
    private maxDelay = config.maxDelay || 5000
  ) {
    this.currentDelay = baseDelay;
  }

  /**
   * Wait for the appropriate amount of time before the next request
   */
  async waitForNextRequest(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    const waitTime = Math.max(0, this.currentDelay - elapsed);

    if (waitTime > 0) {
      logger.debug(`Rate limiter: waiting ${waitTime}ms (current delay: ${this.currentDelay}ms)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Record a successful request - gradually reduce delay
   */
  onSuccess(): void {
    this.consecutiveErrors = 0;
    this.consecutiveSuccesses++;

    // After 3 consecutive successes, reduce delay by 10%
    if (this.consecutiveSuccesses >= 3) {
      const oldDelay = this.currentDelay;
      this.currentDelay = Math.max(this.minDelay, this.currentDelay * 0.9);

      if (oldDelay !== this.currentDelay) {
        logger.debug(`Rate limiter: reduced delay from ${oldDelay}ms to ${this.currentDelay}ms`);
      }

      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Record a failed request - exponentially increase delay
   */
  onError(): void {
    this.consecutiveSuccesses = 0;
    this.consecutiveErrors++;

    const oldDelay = this.currentDelay;

    // Exponential backoff: delay * 2^errors
    const backoffMultiplier = Math.pow(2, Math.min(this.consecutiveErrors, 4)); // Cap at 2^4 = 16x
    this.currentDelay = Math.min(this.maxDelay, this.baseDelay * backoffMultiplier);

    logger.warn(`Rate limiter: increased delay from ${oldDelay}ms to ${this.currentDelay}ms after ${this.consecutiveErrors} consecutive errors`);
  }

  /**
   * Reset to base delay (useful when starting a new batch)
   */
  reset(): void {
    this.currentDelay = this.baseDelay;
    this.consecutiveErrors = 0;
    this.consecutiveSuccesses = 0;
    logger.debug('Rate limiter: reset to base delay');
  }

  /**
   * Get current delay value
   */
  getCurrentDelay(): number {
    return this.currentDelay;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      currentDelay: this.currentDelay,
      baseDelay: this.baseDelay,
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      consecutiveErrors: this.consecutiveErrors,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }
}
