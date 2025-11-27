import * as cheerio from 'cheerio';

export interface ParsedPlayerInfo {
    name: string;
    birthYear?: number;
    currentClub?: string;
    registrationValidUntil?: Date;
}

export function parsePlayerProfile(html: string): ParsedPlayerInfo {
    const $ = cheerio.load(html);

    // Name: div.row div.span12 h2
    const name = $('div.row div.span12 h2').text().trim();

    // Table info
    let birthYear: number | undefined;
    let currentClub: string | undefined;
    let registrationValidUntil: Date | undefined;

    $('table.table-bordered.table-striped tr').each((_, el) => {
        const label = $(el).find('td').first().text().trim();
        const value = $(el).find('td').last().find('strong').text().trim();

        if (label.includes('Rok narození')) {
            birthYear = parseInt(value, 10);
        } else if (label.includes('Klub')) {
            currentClub = value;
        } else if (label.includes('Platnost reg. do')) {
            // Format: DD.MM.YYYY
            const [day, month, year] = value.split('.').map(Number);
            if (day && month && year) {
                registrationValidUntil = new Date(year, month - 1, day);
            }
        }
    });

    return {
        name,
        birthYear,
        currentClub,
        registrationValidUntil,
    };
}

export function parseSeasonOptions(html: string): { value: string; label: string }[] {
    const $ = cheerio.load(html);
    const options: { value: string; label: string }[] = [];

    $('select[name="sezona"] option').each((_, el) => {
        const value = $(el).attr('value');
        const label = $(el).text().trim();
        if (value) {
            options.push({ value, label });
        }
    });

    return options;
}
