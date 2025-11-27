import * as cheerio from 'cheerio';
import { parseScore } from '../../utils/score-parser';
import { determineWinnerFromScore, isWalkoverScore } from '../../utils/score-winner';
import { logger } from '../../utils/logger';

export interface ParsedMatch {
    tournamentId: number;
    tournamentName: string;
    tournamentDate: Date;
    tournamentCategory?: string;

    matchType: 'singles' | 'doubles';
    competitionType: 'individual' | 'team';

    round: string;

    // Opponent info (relative to the scraped player)
    opponentId?: number;
    opponentName?: string;

    // Partner info (for doubles)
    partnerId?: number;
    partnerName?: string;
    opponentPartnerId?: number;
    opponentPartnerName?: string;

    score: string;
    isWalkover: boolean;

    // Did the scraped player win?
    isWinner: boolean;
    pointsEarned: number;
}

export function parseMatches(html: string, scrapedPlayerId: number): ParsedMatch[] {
    const $ = cheerio.load(html);
    const matches: ParsedMatch[] = [];

    // Iterate over all tables (each table is a list of matches, usually grouped by category)
    // Structure: H3 (Category) -> Table (Summary) -> Table (Matches)
    $('table.table-striped.table-bordered.table-condensed').each((_, table) => {
        const headerLink = $(table).find('thead tr th a').first();
        if (!headerLink.length) return;

        const tournamentUrl = headerLink.attr('href') || '';
        const tournamentIdMatch = tournamentUrl.match(/\/turnaj\/(\d+)/);
        const tournamentId = tournamentIdMatch ? parseInt(tournamentIdMatch[1], 10) : 0;
        if (!tournamentId) return;

        const headerHtml = headerLink.html() || '';
        const dateMatch = headerHtml.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        let tournamentDate = new Date();
        if (dateMatch && dateMatch[1]) {
            try {
                const [d, m, y] = dateMatch[1].split('.').map(Number);
                if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
                    tournamentDate = new Date(y, m - 1, d);
                } else {
                    logger.warn(`Invalid date components from header: ${dateMatch[1]}, using current date`);
                }
            } catch (error) {
                logger.warn(`Failed to parse date from header: ${dateMatch[1]}, using current date`, { error });
            }
        } else {
            logger.warn(`No date found in tournament header, using current date`);
        }
        
        const nameMatch = headerHtml.match(/<h4>(.*?)<\/h4>/);
        let tournamentName = nameMatch ? nameMatch[1].trim() : '';

        const sectionHeader = $(table).prevAll('h3').first().text().toLowerCase();
        const competitionType = sectionHeader.includes('družstva') ? 'team' : 'individual';
        const matchType = sectionHeader.includes('čtyřhra') ? 'doubles' : 'singles';

        $(table).find('tbody tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length === 1 && cols.text().includes('získané body')) return;
            if (cols.length < 5) return;

            const round = cols.eq(0).text().trim();
            const scoreText = cols.eq(4).text().trim();
            const { fullScore, isWalkover } = parseScore(scoreText);

            const leftCell = cols.eq(1);
            const rightCell = cols.eq(3);

            const extractPlayers = (cell: cheerio.Cheerio<any>) => {
                const links = cell.find('a');
                const players: { id: number; name: string; isMe: boolean }[] = [];
                links.each((_: any, link: any) => {
                    const href = $(link).attr('href') || '';
                    const idMatch = href.match(/\/hrac\/(\d+)/);
                    const id = idMatch ? parseInt(idMatch[1], 10) : 0;
                    const name = $(link).text().trim();
                    const isMe = id === scrapedPlayerId;
                    players.push({ id, name, isMe });
                });
                return players;
            };

            const leftPlayers = extractPlayers(leftCell);
            const rightPlayers = extractPlayers(rightCell);

            const meInLeft = leftPlayers.some(p => p.isMe);
            const meInRight = rightPlayers.some(p => p.isMe);
            if (!meInLeft && !meInRight) return;

            // Determine winner from score, not from position!
            // Score format: "6:3, 6:4" where first number is left player's games
            const isWinner = determineWinnerFromScore(fullScore, meInLeft);

            let opponentId: number | undefined;
            let opponentName: string | undefined;
            let partnerId: number | undefined;
            let partnerName: string | undefined;
            let opponentPartnerId: number | undefined;
            let opponentPartnerName: string | undefined;

            if (matchType === 'singles') {
                const opponent = meInLeft ? rightPlayers[0] : leftPlayers[0];
                if (opponent) {
                    opponentId = opponent.id;
                    opponentName = opponent.name;
                }
            } else {
                const myCellPlayers = meInLeft ? leftPlayers : rightPlayers;
                const opponentCellPlayers = meInLeft ? rightPlayers : leftPlayers;
                const partner = myCellPlayers.find(p => !p.isMe);
                if (partner) {
                    partnerId = partner.id;
                    partnerName = partner.name;
                }
                if (opponentCellPlayers.length > 0) {
                    opponentId = opponentCellPlayers[0].id;
                    opponentName = opponentCellPlayers[0].name;
                }
                if (opponentCellPlayers.length > 1) {
                    opponentPartnerId = opponentCellPlayers[1].id;
                    opponentPartnerName = opponentCellPlayers[1].name;
                }
            }

            let pointsEarned = 0;
            const nextRow = $(row).next();
            if (nextRow.length > 0) {
                const nextRowText = nextRow.text().trim();
                if (nextRowText.includes('získané body')) {
                    const pointsMatch = nextRowText.match(/získané body:\s*(\d+)/);
                    if (pointsMatch) pointsEarned = parseInt(pointsMatch[1], 10);
                }
            }

            matches.push({
                tournamentId,
                tournamentName,
                tournamentDate,
                matchType,
                competitionType,
                round,
                opponentId,
                opponentName,
                partnerId,
                partnerName,
                opponentPartnerId,
                opponentPartnerName,
                score: fullScore,
                isWalkover,
                isWinner,
                pointsEarned,
            });
        });
    });

    return matches;
}
