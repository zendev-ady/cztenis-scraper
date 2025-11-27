import { ParsedMatch } from '../scrapers/parsers/match-parser';
import { validateScore, isWalkover } from './score-validator';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_ROUNDS = [
  '64>32', '32>16', '16>8', '8>4', '4>2', '2>1', // Standard knockout rounds
  'team', 'skupina', 'final', 'semifinal', 'quarterfinal', // Other formats
  '1.k', '2.k', '3.k', '4.k', // Czech round notation
  'F', 'SF', 'QF', // Short notation
];

const VALID_MATCH_TYPES = ['singles', 'doubles'];
const VALID_COMPETITION_TYPES = ['individual', 'team'];

/**
 * Validate a parsed match object
 */
export function validateMatch(match: ParsedMatch): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Required fields validation
  if (!match.tournamentId || match.tournamentId === 0) {
    errors.push('Missing or invalid tournament ID');
  }

  if (!match.tournamentName || match.tournamentName.trim() === '') {
    warnings.push('Missing tournament name');
  }

  if (!match.tournamentDate) {
    errors.push('Missing tournament date');
  } else {
    const year = match.tournamentDate.getFullYear();
    if (year < 2000 || year > new Date().getFullYear() + 1) {
      warnings.push(`Unusual tournament year: ${year}`);
    }
  }

  // 2. Player validation
  if (!match.opponentId && !match.isWalkover) {
    errors.push('Missing opponent ID (not a walkover)');
  }

  if (match.opponentId && !/^10\d{5}$/.test(String(match.opponentId))) {
    warnings.push(`Unusual opponent ID format: ${match.opponentId}`);
  }

  // 3. Doubles validation
  if (match.matchType === 'doubles') {
    if (!match.partnerId) {
      warnings.push('Doubles match missing partner ID');
    }
    if (!match.opponentPartnerId && !match.isWalkover) {
      warnings.push('Doubles match missing opponent partner ID');
    }
  }

  // 4. Match type validation
  if (!VALID_MATCH_TYPES.includes(match.matchType)) {
    errors.push(`Invalid match type: ${match.matchType}`);
  }

  if (!VALID_COMPETITION_TYPES.includes(match.competitionType)) {
    errors.push(`Invalid competition type: ${match.competitionType}`);
  }

  // 5. Round validation
  if (!match.round || match.round.trim() === '') {
    errors.push('Missing round information');
  } else {
    const roundNormalized = match.round.toLowerCase().trim();
    const isValidRound = VALID_ROUNDS.some(r => roundNormalized.includes(r.toLowerCase()));

    if (!isValidRound) {
      warnings.push(`Unusual round format: ${match.round}`);
    }
  }

  // 6. Score validation
  if (!match.score || match.score.trim() === '') {
    errors.push('Missing score');
  } else {
    const scoreValidation = validateScore(match.score);

    if (!scoreValidation.valid) {
      errors.push(...scoreValidation.errors.map(e => `Score validation: ${e}`));
    }

    warnings.push(...scoreValidation.warnings.map(w => `Score validation: ${w}`));

    // Cross-check walkover flag
    const scoreIsWalkover = isWalkover(match.score);
    if (scoreIsWalkover !== match.isWalkover) {
      warnings.push(`Walkover flag mismatch: isWalkover=${match.isWalkover} but score="${match.score}"`);
    }
  }

  // 7. Points validation
  if (match.pointsEarned < 0) {
    errors.push(`Negative points earned: ${match.pointsEarned}`);
  }

  if (match.pointsEarned > 10000) {
    warnings.push(`Unusually high points earned: ${match.pointsEarned}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a batch of matches and return summary statistics
 */
export function validateMatches(matches: ParsedMatch[]): {
  validCount: number;
  invalidCount: number;
  warningCount: number;
  invalidMatches: Array<{ match: ParsedMatch; validation: ValidationResult }>;
} {
  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;
  const invalidMatches: Array<{ match: ParsedMatch; validation: ValidationResult }> = [];

  for (const match of matches) {
    const validation = validateMatch(match);

    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      invalidMatches.push({ match, validation });
    }

    warningCount += validation.warnings.length;
  }

  return {
    validCount,
    invalidCount,
    warningCount,
    invalidMatches,
  };
}

/**
 * Check for potential duplicate matches
 */
export function findDuplicates(matches: ParsedMatch[]): Array<[ParsedMatch, ParsedMatch]> {
  const duplicates: Array<[ParsedMatch, ParsedMatch]> = [];

  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const m1 = matches[i];
      const m2 = matches[j];

      // Same tournament, same opponent, same round = likely duplicate
      if (
        m1.tournamentId === m2.tournamentId &&
        m1.opponentId === m2.opponentId &&
        m1.round === m2.round &&
        m1.matchType === m2.matchType
      ) {
        duplicates.push([m1, m2]);
      }
    }
  }

  return duplicates;
}
