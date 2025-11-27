import { ParsedMatch } from '../scrapers/parsers/match-parser';
import { validateMatch, ValidationResult } from '../validators/match-validator';
import { logger } from '../utils/logger';

export interface QualityStats {
  // Overall metrics
  totalMatches: number;
  validMatches: number;
  invalidMatches: number;
  totalWarnings: number;

  // Specific issue counts
  missingOpponents: number;
  invalidScores: number;
  unusualRounds: number;
  duplicates: number;
  walkovers: number;

  // Player metrics
  playersProcessed: number;
  seasonsProcessed: number;

  // Time metrics
  startTime: Date;
  lastUpdate: Date;
}

export interface QualityReport extends QualityStats {
  // Calculated metrics
  accuracy: number; // Percentage of valid matches
  averageMatchesPerPlayer: number;
  averageSeasonsPerPlayer: number;
  runtime: number; // Milliseconds
}

export class QualityMonitor {
  private stats: QualityStats = {
    totalMatches: 0,
    validMatches: 0,
    invalidMatches: 0,
    totalWarnings: 0,
    missingOpponents: 0,
    invalidScores: 0,
    unusualRounds: 0,
    duplicates: 0,
    walkovers: 0,
    playersProcessed: 0,
    seasonsProcessed: 0,
    startTime: new Date(),
    lastUpdate: new Date(),
  };

  private invalidMatchSamples: Array<{ match: ParsedMatch; validation: ValidationResult }> = [];
  private readonly MAX_SAMPLES = 50; // Keep up to 50 invalid match samples for review

  /**
   * Record a match validation result
   */
  recordMatch(match: ParsedMatch, validation: ValidationResult): void {
    this.stats.totalMatches++;
    this.stats.lastUpdate = new Date();

    if (validation.isValid) {
      this.stats.validMatches++;
    } else {
      this.stats.invalidMatches++;

      // Keep sample of invalid matches for debugging
      if (this.invalidMatchSamples.length < this.MAX_SAMPLES) {
        this.invalidMatchSamples.push({ match, validation });
      }

      // Log invalid matches
      logger.warn('Invalid match detected', {
        tournamentId: match.tournamentId,
        tournamentName: match.tournamentName,
        opponentId: match.opponentId,
        errors: validation.errors,
      });
    }

    this.stats.totalWarnings += validation.warnings.length;

    // Count specific issues
    if (!match.opponentId && !match.isWalkover) {
      this.stats.missingOpponents++;
    }

    if (validation.errors.some(e => e.includes('Score'))) {
      this.stats.invalidScores++;
    }

    if (validation.warnings.some(w => w.includes('round'))) {
      this.stats.unusualRounds++;
    }

    if (match.isWalkover) {
      this.stats.walkovers++;
    }
  }

  /**
   * Record that a player has been processed
   */
  recordPlayer(playerId: number, matchCount: number): void {
    this.stats.playersProcessed++;
    this.stats.lastUpdate = new Date();
    logger.info(`Player ${playerId} processed: ${matchCount} matches scraped`);
  }

  /**
   * Record that a season has been processed
   */
  recordSeason(seasonCode: string, matchCount: number): void {
    this.stats.seasonsProcessed++;
    this.stats.lastUpdate = new Date();
    logger.debug(`Season ${seasonCode} processed: ${matchCount} matches found`);
  }

  /**
   * Increment duplicate counter
   */
  recordDuplicate(): void {
    this.stats.duplicates++;
  }

  /**
   * Get current statistics
   */
  getStats(): QualityStats {
    return { ...this.stats };
  }

  /**
   * Get a full quality report with calculated metrics
   */
  getReport(): QualityReport {
    const runtime = Date.now() - this.stats.startTime.getTime();
    const accuracy = this.stats.totalMatches > 0
      ? (this.stats.validMatches / this.stats.totalMatches) * 100
      : 0;

    const averageMatchesPerPlayer = this.stats.playersProcessed > 0
      ? this.stats.totalMatches / this.stats.playersProcessed
      : 0;

    const averageSeasonsPerPlayer = this.stats.playersProcessed > 0
      ? this.stats.seasonsProcessed / this.stats.playersProcessed
      : 0;

    return {
      ...this.stats,
      accuracy,
      averageMatchesPerPlayer,
      averageSeasonsPerPlayer,
      runtime,
    };
  }

  /**
   * Print a formatted report to console
   */
  printReport(): void {
    const report = this.getReport();
    const runtimeMinutes = Math.floor(report.runtime / 60000);
    const runtimeSeconds = Math.floor((report.runtime % 60000) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('  DATA QUALITY REPORT');
    console.log('='.repeat(60));

    console.log('\n📊 Overall Metrics:');
    console.log(`  Total Matches:        ${report.totalMatches.toLocaleString()}`);
    console.log(`  Valid Matches:        ${report.validMatches.toLocaleString()} (${report.accuracy.toFixed(2)}%)`);
    console.log(`  Invalid Matches:      ${report.invalidMatches.toLocaleString()}`);
    console.log(`  Total Warnings:       ${report.totalWarnings.toLocaleString()}`);

    console.log('\n🎾 Player Metrics:');
    console.log(`  Players Processed:    ${report.playersProcessed.toLocaleString()}`);
    console.log(`  Seasons Processed:    ${report.seasonsProcessed.toLocaleString()}`);
    console.log(`  Avg Matches/Player:   ${report.averageMatchesPerPlayer.toFixed(1)}`);
    console.log(`  Avg Seasons/Player:   ${report.averageSeasonsPerPlayer.toFixed(1)}`);

    console.log('\n⚠️  Specific Issues:');
    console.log(`  Missing Opponents:    ${report.missingOpponents.toLocaleString()}`);
    console.log(`  Invalid Scores:       ${report.invalidScores.toLocaleString()}`);
    console.log(`  Unusual Rounds:       ${report.unusualRounds.toLocaleString()}`);
    console.log(`  Duplicates:           ${report.duplicates.toLocaleString()}`);
    console.log(`  Walkovers:            ${report.walkovers.toLocaleString()}`);

    console.log('\n⏱️  Time Metrics:');
    console.log(`  Runtime:              ${runtimeMinutes}m ${runtimeSeconds}s`);
    console.log(`  Started:              ${report.startTime.toLocaleString()}`);
    console.log(`  Last Update:          ${report.lastUpdate.toLocaleString()}`);

    if (this.invalidMatchSamples.length > 0) {
      console.log('\n❌ Sample Invalid Matches (first 5):');
      this.invalidMatchSamples.slice(0, 5).forEach((sample, idx) => {
        console.log(`  ${idx + 1}. Tournament ${sample.match.tournamentId} - ${sample.match.tournamentName}`);
        console.log(`     Errors: ${sample.validation.errors.join(', ')}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Get invalid match samples for debugging
   */
  getInvalidSamples(): Array<{ match: ParsedMatch; validation: ValidationResult }> {
    return [...this.invalidMatchSamples];
  }

  /**
   * Reset all statistics (useful for testing)
   */
  reset(): void {
    this.stats = {
      totalMatches: 0,
      validMatches: 0,
      invalidMatches: 0,
      totalWarnings: 0,
      missingOpponents: 0,
      invalidScores: 0,
      unusualRounds: 0,
      duplicates: 0,
      walkovers: 0,
      playersProcessed: 0,
      seasonsProcessed: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
    };
    this.invalidMatchSamples = [];
    logger.info('Quality monitor reset');
  }
}
