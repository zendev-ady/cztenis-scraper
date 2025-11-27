export interface ParsedScore {
    fullScore: string;
    sets: string[];
    isWalkover: boolean;
    isRetirement: boolean;
}

export function parseScore(scoreText: string): ParsedScore {
    const cleanScore = scoreText.trim();

    if (cleanScore === 'scr.' || cleanScore.includes('scr.')) {
        return {
            fullScore: cleanScore,
            sets: [],
            isWalkover: true,
            isRetirement: false,
        };
    }

    // Handle retirement (e.g., "6:3, 2:0, scr.") - though cztenis usually just puts scr. or score
    // If there is a score but it ends with scr., it's a retirement/walkover
    const isWalkover = cleanScore.includes('scr.');

    // Split by comma or space (sometimes scores are "6:3 6:4")
    // But cztenis usually uses "6:3, 6:4"
    const sets = cleanScore.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'scr.');

    return {
        fullScore: cleanScore,
        sets,
        isWalkover,
        isRetirement: false, // We treat scr. as walkover for now, distinction might be subtle in text
    };
}
