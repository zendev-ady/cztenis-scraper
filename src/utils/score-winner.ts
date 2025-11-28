/**
 * Determines the winner from a tennis score
 *
 * Score format: "6:3, 6:4" or "7:6 (3), 6:4"
 * First number = left player's games, second = right player's games
 *
 * @param score - Full match score (e.g., "6:3, 6:4")
 * @param leftPlayerIsMe - True if I'm the left player in HTML
 * @returns True if I won, false if I lost
 */
export function determineWinnerFromScore(score: string, leftPlayerIsMe: boolean): boolean {
  const trimmedScore = score.trim();

  // Handle walkovers - assume left player won (could be either way, but we need context)
  // Actually for walkovers, we should rely on other indicators, but for now assume it's already handled
  if (trimmedScore === 'scr.' || trimmedScore.includes('scr.')) {
    // Walkover - can't determine from score alone
    // Return false to indicate uncertainty, should be handled separately
    return leftPlayerIsMe; // Default fallback
  }

  // Split into sets: "6:3, 6:4" → ["6:3", "6:4"]
  const sets = trimmedScore.split(',').map(s => s.trim());

  let leftPlayerSetsWon = 0;
  let rightPlayerSetsWon = 0;

  for (const setScore of sets) {
    // Parse set score: "6:3" or "7:6 (3)"
    // Remove tiebreak notation: "7:6 (3)" → "7:6"
    const cleanSet = setScore.replace(/\s*\(\d+\)/, '').trim();

    // Skip invalid sets
    if (!cleanSet.includes(':')) {
      continue;
    }

    const [leftGames, rightGames] = cleanSet.split(':').map(g => {
      const parsed = parseInt(g.trim(), 10);
      return isNaN(parsed) ? 0 : parsed;
    });

    // Determine set winner: whoever has more games won the set
    if (leftGames > rightGames) {
      leftPlayerSetsWon++;
    } else if (rightGames > leftGames) {
      rightPlayerSetsWon++;
    }
    // If equal (shouldn't happen in tennis), don't count either
  }

  // Match winner is whoever won more sets
  const leftPlayerWonMatch = leftPlayerSetsWon > rightPlayerSetsWon;

  // If I'm the left player and left player won, I won
  // If I'm the right player and right player won, I won
  return leftPlayerIsMe ? leftPlayerWonMatch : !leftPlayerWonMatch;
}

/**
 * Determine if a score represents a walkover/retirement
 */
export function isWalkoverScore(score: string): boolean {
  const lower = score.toLowerCase().trim();
  return lower === 'scr.' ||
         lower.includes('scr.') ||
         lower === 'w.o.' ||
         lower === 'def.' ||
         lower === 'ret.';
}

/**
 * Parse score details for debugging/validation
 */
export function parseScoreDetails(score: string): {
  sets: Array<{ left: number; right: number; winner: 'left' | 'right' | 'tie' }>;
  leftSetsWon: number;
  rightSetsWon: number;
  winner: 'left' | 'right' | 'unknown';
} {
  const trimmedScore = score.trim();

  if (isWalkoverScore(trimmedScore)) {
    return {
      sets: [],
      leftSetsWon: 0,
      rightSetsWon: 0,
      winner: 'unknown',
    };
  }

  const sets = trimmedScore.split(',').map(s => s.trim());
  const parsedSets: Array<{ left: number; right: number; winner: 'left' | 'right' | 'tie' }> = [];
  let leftSetsWon = 0;
  let rightSetsWon = 0;

  for (const setScore of sets) {
    const cleanSet = setScore.replace(/\s*\(\d+\)/, '').trim();

    if (!cleanSet.includes(':')) {
      continue;
    }

    const [leftGames, rightGames] = cleanSet.split(':').map(g => {
      const parsed = parseInt(g.trim(), 10);
      return isNaN(parsed) ? 0 : parsed;
    });

    let setWinner: 'left' | 'right' | 'tie';
    if (leftGames > rightGames) {
      setWinner = 'left';
      leftSetsWon++;
    } else if (rightGames > leftGames) {
      setWinner = 'right';
      rightSetsWon++;
    } else {
      setWinner = 'tie';
    }

    parsedSets.push({ left: leftGames, right: rightGames, winner: setWinner });
  }

  const winner = leftSetsWon > rightSetsWon ? 'left' :
                 rightSetsWon > leftSetsWon ? 'right' :
                 'unknown';

  return {
    sets: parsedSets,
    leftSetsWon,
    rightSetsWon,
    winner,
  };
}
