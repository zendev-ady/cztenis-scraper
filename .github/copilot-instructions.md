# CZTenis Scraper - AI Agent Instructions

## Project Overview
Tennis match and player data scraper for cztenis.cz with queue-based crawling, SQLite storage, Express API, and React frontend. Focus: Czech tennis tournaments, H2H statistics, and player rankings.

## Architecture

### Layered Design
```
CLI (src/cli/) → Services (src/services/) → Scrapers (src/scrapers/) → Repositories (src/database/repositories/) → Drizzle ORM → SQLite
                                                                      ↘ API (src/api/) → React Frontend (web/)
```

**Key Components:**
- **QueueManager** (`src/services/queue-manager.ts`): BFS-style player crawling with depth limits. Controls scraping via `maxDepth` (0=seed player, 1=+opponents, -1=unlimited) and `maxPlayers` limits
- **PlayerScraper** (`src/scrapers/player-scraper.ts`): HTTP client (Axios) scrapes player pages + POST requests for season data. Parses HTML with Cheerio. CRITICAL: Creates placeholder players for opponents/partners BEFORE creating matches to satisfy foreign key constraints
- **AdaptiveRateLimiter** (`src/utils/adaptive-rate-limiter.ts`): Dynamic delay (300ms-5s) based on success/error streaks. 3 successes → reduce by 10%, errors → exponential backoff
- **Repositories** (`src/database/repositories/`): All DB access. Match repo normalizes player order (player1Id < player2Id) to prevent duplicates from bidirectional scraping

### Database Schema (Drizzle ORM)
- **players**: cztenis.cz ID (primary key), parsed firstName/lastName, club, registration expiry
- **matches**: Unique constraint on (tournamentId, round, player1Id, player2Id, matchType). Stores player1/player2 + optional partners for doubles. Winner determined by score parsing
- **tournaments**: seasonCode FK to seasons table
- **scrapeQueue**: status ('pending'|'processing'|'completed'|'failed'), depth tracking, retry logic
- **h2hStats**: Aggregated head-to-head between player pairs

**Migration Pattern**: Use `npm run db:push` (Drizzle Kit) for schema changes. Migrations in `src/database/migrations/`. NEVER manually edit SQLite file.

## Critical Development Patterns

### 1. Foreign Key Safety
Always create/upsert referenced entities BEFORE creating matches:
```typescript
// CORRECT: Ensure opponent exists first
await playerRepo.upsert({ id: opponentId, name: opponentName });
await matchRepo.create({ player1Id, player2Id: opponentId, ... });
```
Violating this causes foreign key constraint errors. See `PlayerScraper.scrapePlayer()` for canonical pattern.

### 2. Match Validation Pipeline
Every match passes through `validateMatch()` (`src/validators/match-validator.ts`) checking:
- Tournament ID format, date sanity
- Player ID format (10XXXXX pattern)
- Score consistency with winner via `validateScore()` and `determineWinner()` (`src/utils/score-winner.ts`)
- Round format validation against VALID_ROUNDS array

**Quality Monitoring**: `QualityMonitor` (`src/services/quality-monitor.ts`) tracks validation errors/warnings per season. Print report via `qualityMonitor.printReport()` after scraping.

### 3. CLI Command Patterns
Use **Commander.js** with positional + option syntax:
```bash
npm run scrape start 1026900 1 10           # playerId, maxDepth, limit
npm run scrape start --player 1026900 --max-depth 1 --limit 10
```
**Queue operations**:
- `npm run scrape clear-queue` before new scrapes
- `npm run scrape reset-queue` to retry failed items
- `npm run queue-status` for diagnostics

**Database**:
- `npm run db:push` syncs schema changes (no migration files)
- `npm run db:generate` + `npm run db:migrate` for production migrations
- `npx tsx src/cli/verify-db.ts` shows DB contents

### 4. Data Integrity Tools (DEBUG.md)
- **validate-integrity**: Checks tournament logic rules (one match per round, winner continuity, no matches after loss). Use `--player` or `--tournament` flags for targeted validation
- **cleanup-duplicates**: Dry-run by default. Add `--execute` to actually delete. Analyzes duplicate detection via unique constraints

## Development Workflows

### Adding New Scraped Fields
1. Update parser in `src/scrapers/parsers/match-parser.ts` or `player-parser.ts`
2. Add to schema in `src/database/schema.ts` (e.g., new column in `matches` table)
3. Run `npm run db:push` to sync SQLite
4. Update repository insert/select in `src/database/repositories/`
5. Update API response types in `web/src/lib/api.ts` and `src/api/routes/`

### API + Frontend Integration
- **Backend**: Express server at `localhost:3001` (`npm run api`). Routes in `src/api/routes/` return JSON with joined data (matches + tournaments)
- **Frontend**: React + Vite at `localhost:5173` (`cd web && npm run dev`). API client in `web/src/lib/api.ts` defines TypeScript interfaces matching DB schema
- **CORS**: Enabled in `src/api/server.ts` for local development

### Testing
Run tests via `npm test` (Vitest). Fixtures in `tests/fixtures/html/` for parser testing. Pattern: Test parsers with real HTML samples from cztenis.cz to catch format changes.

## Common Pitfalls

1. **Queue Depth Logic**: Remember `depth=0` is seed player. Opponents are `depth=1`. Check `QueueManager.addPlayer()` before modifying depth behavior
2. **Match Duplicates**: The unique constraint prevents duplicate inserts BUT scraper must normalize player order. See `MatchRepository.create()` duplicate check
3. **Score Parsing Edge Cases**: Walkovers ("w.o."), retirements ("skreč"), super tiebreaks. Test against `score-parser.ts` and update `WALKOVER_PATTERNS`
4. **Season Codes**: Format is "YYYY" or "YYYY-L" (leto/summer). Ensure season exists via `TournamentRepository.ensureSeason()` before FK references
5. **Rate Limiting**: If hitting 429s or timeouts, reduce `config.requestDelay` incrementally. Adaptive limiter auto-adjusts but base delay matters

## Configuration (src/config.ts)
- `requestDelay`: Base delay (500ms). Lower = faster scraping, higher = safer
- `minDelay` / `maxDelay`: Adaptive limiter bounds
- `dbPath`: SQLite file location (`data/cztenis.db`)
- `logLevel`: Set via `LOG_LEVEL` env var for debug output

## Documentation Files
- **DOC.md**: Full architecture, schema details, repository patterns
- **DEBUG.md**: Validation tools, cleanup commands, data quality checks (in Czech)
- **README.md**: User-facing quickstart, CLI examples

## Style Conventions
- **Repositories**: Methods named `findById()`, `findBetweenPlayers()`, `upsert()`. Always return Drizzle-typed results
- **Logging**: Use Winston logger, never `console.log()`. Levels: `logger.debug()` for rate limiting, `logger.warn()` for validation issues, `logger.error()` for failures
- **Error Handling**: Scraper catches errors per-player, marks queue item as 'failed', continues processing. Never crash queue on single player failure
