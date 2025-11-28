/**
 * Score validation utilities for tennis match scores
 *
 * Handles various score formats:
 * - Standard: "6:3, 6:4"
 * - Tiebreak: "7:6 (3), 6:4" or "6:7 (5), 6:3"
 * - Super tiebreak: "6:4, 6:7 (5), 1:0 (7)"
 * - Walkovers: "scr.", "w.o.", "def.", "ret."
 */

export interface ScoreValidation {
  valid: boolean;
  sets: number;
  errors: string[];
  warnings: string[];
}

const WALKOVER_PATTERNS = ['scr.', 'w.o.', 'def.', 'ret.', 'skreč'];

export function validateScore(score: string): ScoreValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!score || score.trim() === '') {
    return {
      valid: false,
      sets: 0,
      errors: ['Score is empty'],
      warnings: [],
    };
  }

  const trimmedScore = score.trim();

  // Check for walkover
  if (WALKOVER_PATTERNS.some(pattern => trimmedScore.toLowerCase().includes(pattern))) {
    return {
      valid: true,
      sets: 0,
      errors: [],
      warnings: ['Score indicates walkover/retirement'],
    };
  }

  // Parse set-by-set scores
  const sets = trimmedScore.split(',').map(s => s.trim());

  if (sets.length === 0) {
    return {
      valid: false,
      sets: 0,
      errors: ['No sets found in score'],
      warnings: [],
    };
  }

  // Validate each set
  for (let i = 0; i < sets.length; i++) {
    const setScore = sets[i];
    const setValidation = validateSet(setScore, i + 1);

    errors.push(...setValidation.errors);
    warnings.push(...setValidation.warnings);
  }

  // Check total number of sets
  if (sets.length > 5) {
    warnings.push(`Unusual number of sets: ${sets.length}`);
  }

  return {
    valid: errors.length === 0,
    sets: sets.length,
    errors,
    warnings,
  };
}

function validateSet(setScore: string, setNumber: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Pattern for set score: "6:3" or "7:6 (3)" or "1:0 (7)"
  const setPattern = /^(\d+):(\d+)(?:\s*\((\d+)\))?$/;
  const match = setScore.match(setPattern);

  if (!match) {
    errors.push(`Set ${setNumber}: Invalid format "${setScore}"`);
    return { errors, warnings };
  }

  const games1 = parseInt(match[1], 10);
  const games2 = parseInt(match[2], 10);
  const tiebreak = match[3] ? parseInt(match[3], 10) : undefined;

  // Validate game counts
  if (games1 < 0 || games2 < 0) {
    errors.push(`Set ${setNumber}: Negative game count`);
  }

  if (games1 > 20 || games2 > 20) {
    warnings.push(`Set ${setNumber}: Unusually high game count (${games1}:${games2})`);
  }

  // Check for tiebreak scenarios
  if (tiebreak !== undefined) {
    // Standard tiebreak at 6-6 or 7-6
    if ((games1 === 7 && games2 === 6) || (games1 === 6 && games2 === 7)) {
      // Valid standard tiebreak
      if (tiebreak > 20) {
        warnings.push(`Set ${setNumber}: Unusually long tiebreak (${tiebreak})`);
      }
    }
    // Super tiebreak (usually 1:0 (10) or similar)
    else if ((games1 === 1 && games2 === 0) || (games1 === 0 && games2 === 1)) {
      // Valid super tiebreak
      if (tiebreak < 7) {
        warnings.push(`Set ${setNumber}: Super tiebreak ended early (${tiebreak})`);
      }
    }
    // Long sets (e.g., 13:11 in final set without tiebreak)
    else if (games1 >= 6 && games2 >= 6) {
      warnings.push(`Set ${setNumber}: Tiebreak notation in long set (${games1}:${games2})`);
    }
    else {
      warnings.push(`Set ${setNumber}: Unexpected tiebreak notation (${games1}:${games2} (${tiebreak}))`);
    }
  } else {
    // No tiebreak - validate normal set scores
    const diff = Math.abs(games1 - games2);
    const winner = Math.max(games1, games2);
    const loser = Math.min(games1, games2);

    // Standard sets: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5
    if (winner === 6) {
      if (loser > 4) {
        warnings.push(`Set ${setNumber}: 6-${loser} is unusual (expected 7-5)`);
      }
    }
    // 7-5 sets
    else if (winner === 7 && loser === 5) {
      // Valid
    }
    // Long sets without tiebreak (e.g., 12-10, 13-11)
    else if (winner >= 6 && diff === 2) {
      // Valid long set
    }
    // Other cases
    else if (winner < 6) {
      warnings.push(`Set ${setNumber}: Set ended before 6 games (${games1}:${games2})`);
    } else if (winner > 7 && diff < 2) {
      errors.push(`Set ${setNumber}: Invalid score (${games1}:${games2}) - must win by 2`);
    }
  }

  return { errors, warnings };
}

/**
 * Check if a score represents a walkover
 */
export function isWalkover(score: string): boolean {
  if (!score) return false;
  const normalized = score.toLowerCase().trim();
  return WALKOVER_PATTERNS.some(pattern => normalized.includes(pattern.toLowerCase()));
}

/**
 * Normalize score format (e.g., remove extra spaces)
 */
export function normalizeScore(score: string): string {
  return score
    .split(',')
    .map(s => s.trim())
    .join(', ');
}
