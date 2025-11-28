import { WALKOVER_PATTERNS } from './score-constants';
export interface ParsedScore {
    fullScore: string;
    sets: string[];
    isWalkover: boolean;
    isRetirement: boolean;
}

export function parseScore(scoreText: string): ParsedScore {
    const cleanScore = scoreText.trim();
    const lower = cleanScore.toLowerCase();

    // Shared walkover detection
    if (WALKOVER_PATTERNS.some(p => lower.includes(p))) {
        return {
            fullScore: cleanScore,
            sets: [],
            isWalkover: true,
            isRetirement: false,
        };
    }

    // Handle retirement (e.g., "6:3, 2:0, scr.") - though cztenis usually just puts scr. or score
    // If there is a score but it ends with scr., it's a retirement/walkover
    const isWalkover = WALKOVER_PATTERNS.some(p => lower.includes(p));

    // Split by comma or space (sometimes scores are "6:3 6:4")
    // But cztenis usually uses "6:3, 6:4"
    const sets = cleanScore
        .split(',')
        .map(s => s.trim())
        .filter(s => {
            const sl = s.toLowerCase();
            return s.length > 0 && !WALKOVER_PATTERNS.includes(sl);
        });

    return {
        fullScore: cleanScore,
        sets,
        isWalkover,
        isRetirement: false, // We treat scr. as walkover for now, distinction might be subtle in text
    };
}
