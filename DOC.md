# CZTenis Scraper - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Documentation](#database-schema-documentation)
3. [Scraper Implementation Details](#scraper-implementation-details)
4. [Repository Pattern Implementation](#repository-pattern-implementation)
5. [Queue Management System](#queue-management-system)
6. [CLI Commands Documentation](#cli-commands-documentation)
7. [Configuration and Environment Setup](#configuration-and-environment-setup)
8. [Logging System Implementation](#logging-system-implementation)
9. [Current Implementation Status](#current-implementation-status)
10. [Future Development Roadmap](#future-development-roadmap)

## Architecture Overview

The cztenis-scraper project follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   scrape.ts     │  │   verify-db.ts  │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐                                      │
│  │  QueueManager   │                                      │
│  └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Scraper Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ PlayerScraper   │  │   Parsers       │                  │
│  │                 │  │ - match-parser  │                  │
│  │                 │  │ - player-parser │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Repository Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ PlayerRepo      │  │ MatchRepo       │                  │
│  │ TournamentRepo  │  │ ScrapeQueueRepo │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Drizzle ORM   │  │    SQLite       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Repository Pattern**: Data access is abstracted through repository classes
2. **Queue-Based Processing**: Asynchronous scraping with retry mechanisms
3. **Parser Separation**: HTML parsing logic is separated from scraping logic
4. **Dependency Injection**: Services receive their dependencies through constructors

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Database**: SQLite with Drizzle ORM
- **Web Scraping**: Playwright for browser automation, Cheerio for HTML parsing
- **Queue Management**: p-queue for concurrency control
- **CLI**: Commander.js for command-line interface
- **Logging**: Winston for structured logging

## Database Schema Documentation

### Core Tables

#### Players Table (`players`)
```sql
CREATE TABLE players (
    id INTEGER PRIMARY KEY,           -- ID from cztenis.cz
    name TEXT NOT NULL,               -- Full player name
    first_name TEXT,                  -- First name (parsed)
    last_name TEXT,                   -- Last name (parsed)
    birth_year INTEGER,               -- Birth year
    current_club TEXT,                -- Current tennis club
    registration_valid_until INTEGER, -- Registration expiry (timestamp)
    last_scraped_at INTEGER,          -- Last scrape timestamp
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_players_name` on name column
- `idx_players_birth_year` on birth_year column

#### Matches Table (`matches`)
```sql
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,   -- Foreign key to tournaments
    match_type TEXT NOT NULL,          -- "singles" | "doubles"
    competition_type TEXT NOT NULL,    -- "individual" | "team"
    round TEXT NOT NULL,               -- Round name (e.g., "Semifinale")
    round_order INTEGER,               -- Round ordering
    
    -- Singles players
    player1_id INTEGER,                -- Winner (left in HTML)
    player2_id INTEGER,                -- Loser (right in HTML)
    
    -- Doubles partners
    player1_partner_id INTEGER,        -- Winner's partner
    player2_partner_id INTEGER,        -- Loser's partner
    
    -- Match results
    score TEXT,                        -- Full score string
    score_set1 TEXT,                   -- Set 1 score
    score_set2 TEXT,                   -- Set 2 score
    score_set3 TEXT,                   -- Set 3 score
    is_walkover INTEGER DEFAULT 0,     -- Boolean flag
    
    winner_id INTEGER,                 -- Winner player ID
    points_earned INTEGER,             -- Tournament points earned
    match_date INTEGER,                -- Match date (timestamp)
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_matches_tournament` on tournament_id
- `idx_matches_player1` on player1_id
- `idx_matches_player2` on player2_id
- `idx_matches_winner` on winner_id
- `idx_matches_date` on match_date
- `idx_matches_type` on match_type, competition_type

#### Tournaments Table (`tournaments`)
```sql
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY,           -- ID from URL
    name TEXT,                        -- Tournament name
    venue TEXT,                       -- Tournament venue
    date INTEGER,                     -- Tournament date (timestamp)
    category TEXT,                    -- Tournament category
    category_points INTEGER,          -- Points awarded
    age_category TEXT,                -- Age category
    season_code TEXT,                 -- Foreign key to seasons
    singles_capacity INTEGER,         -- Singles draw size
    doubles_capacity INTEGER,         -- Doubles draw size
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
```

#### Seasons Table (`seasons`)
```sql
CREATE TABLE seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,        -- e.g., "2026", "2025-L"
    label TEXT NOT NULL,              -- e.g., "2025/2026"
    start_date INTEGER,               -- Season start (timestamp)
    end_date INTEGER,                 -- Season end (timestamp)
    season_type TEXT,                 -- "full" | "winter" | "summer"
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
```

### Supporting Tables

#### Head-to-Head Statistics (`h2h_stats`)
```sql
CREATE TABLE h2h_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL,     -- First player ID
    player2_id INTEGER NOT NULL,     -- Second player ID
    total_matches INTEGER DEFAULT 0,  -- Total matches played
    player1_wins INTEGER DEFAULT 0,   -- Player 1 victories
    player2_wins INTEGER DEFAULT 0,   -- Player 2 victories
    last_match_date INTEGER,          -- Most recent match (timestamp)
    first_match_date INTEGER,         -- First match (timestamp)
    last_winner_id INTEGER,           -- Winner of last match
    last_score TEXT,                  -- Score of last match
    updated_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player1_id, player2_id)
);
```

#### Player Rankings (`player_rankings`)
```sql
CREATE TABLE player_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,       -- Foreign key to players
    season_code TEXT NOT NULL,        -- Foreign key to seasons
    youth_junior_rank INTEGER,        -- Youth junior ranking
    youth_junior_bh INTEGER,          -- Youth junior BH value
    youth_senior_rank INTEGER,        -- Youth senior ranking
    youth_senior_bh INTEGER,          -- Youth senior BH value
    junior_rank INTEGER,              -- Junior ranking
    junior_bh INTEGER,                -- Junior BH value
    adult_rank INTEGER,               -- Adult ranking
    adult_bh INTEGER,                 -- Adult BH value
    club TEXT,                        -- Club at time of ranking
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, season_code)
);
```

#### Scrape Queue (`scrape_queue`)
```sql
CREATE TABLE scrape_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,       -- Foreign key to players
    priority INTEGER DEFAULT 0,        -- Processing priority
    status TEXT DEFAULT 'pending',     -- "pending" | "processing" | "completed" | "failed"
    attempts INTEGER DEFAULT 0,        -- Number of retry attempts
    last_attempt_at INTEGER,           -- Last attempt timestamp
    error_message TEXT,                -- Error details if failed
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id)
);
```

### Database Relationships

```
players (1) ←→ (N) matches
players (1) ←→ (N) h2h_stats (as player1)
players (1) ←→ (N) h2h_stats (as player2)
players (1) ←→ (N) player_rankings
players (1) ←→ (1) scrape_queue

tournaments (1) ←→ (N) matches
seasons (1) ←→ (N) tournaments
seasons (1) ←→ (N) player_rankings
```

## Scraper Implementation Details

### PlayerScraper Class

The [`PlayerScraper`](src/scrapers/player-scraper.ts:12) class is the core component responsible for scraping player data from cztenis.cz.

#### Key Features

1. **Browser Management**: 
   - Uses Playwright for browser automation
   - Implements browser recycling after 50 pages to prevent memory leaks
   - Automatic browser recovery on disconnection

2. **Multi-Season Scraping**:
   - Automatically detects available seasons for each player
   - Iterates through all seasons to collect complete match history
   - Handles season switching via form submission

3. **Data Extraction Pipeline**:
   ```typescript
   // 1. Parse basic player information
   const playerInfo = parsePlayerProfile(html);
   await this.playerRepo.upsert({ id: playerId, ...playerInfo });
   
   // 2. Get available seasons
   const seasons = parseSeasonOptions(html);
   
   // 3. Process each season
   for (const season of seasons) {
       // Switch season context
       await page.selectOption('select[name="sezona"]', season.value);
       
       // Parse matches for the season
       const matches = parseMatches(seasonHtml, playerId);
       
       // Save matches and related data
       for (const match of matches) {
           await this.saveMatch(match, season);
       }
   }
   ```

#### Error Handling

The scraper implements comprehensive error handling at multiple levels:

1. **Page-level errors**: Caught and logged without stopping the entire scraping process
2. **Match-level errors**: Individual match failures don't stop season processing
3. **Season-level errors**: Failed season switching is logged but doesn't prevent other seasons
4. **Browser-level errors**: Automatic recovery and reconnection

### HTML Parsers

#### Player Parser ([`player-parser.ts`](src/scrapers/parsers/player-parser.ts:1))

**Functions:**
- [`parsePlayerProfile()`](src/scrapers/parsers/player-parser.ts:10): Extracts basic player information
- [`parseSeasonOptions()`](src/scrapers/parsers/player-parser.ts:46): Gets available seasons from dropdown

**Data Extraction Strategy:**
```typescript
// Player name from h2 element
const name = $('div.row div.span12 h2').text().trim();

// Table data extraction
$('table.table-bordered.table-striped tr').each((_, el) => {
    const label = $(el).find('td').first().text().trim();
    const value = $(el).find('td').last().find('strong').text().trim();
    
    if (label.includes('Rok narození')) {
        birthYear = parseInt(value, 10);
    }
    // ... other fields
});
```

#### Match Parser ([`match-parser.ts`](src/scrapers/parsers/match-parser.ts:1))

**Key Features:**
- Handles both singles and doubles matches
- Extracts tournament information from table headers
- Parses scores with walkover detection
- Identifies player positions (left/right in HTML)

**Match Detection Logic:**
```typescript
// Find tournament tables
$('table.table-striped.table-bordered.table-condensed').each((_, table) => {
    // Extract tournament info from header
    const tournamentUrl = headerLink.attr('href') || '';
    const tournamentId = tournamentUrl.match(/\/turnaj\/(\d+)/);
    
    // Determine match type from section header
    const sectionHeader = $(table).prevAll('h3').first().text().toLowerCase();
    const competitionType = sectionHeader.includes('družstva') ? 'team' : 'individual';
    const matchType = sectionHeader.includes('čtyřhra') ? 'doubles' : 'singles';
    
    // Process match rows
    $(table).find('tbody tr').each((_, row) => {
        // Extract player information and match details
    });
});
```

#### Score Parser ([`score-parser.ts`](src/utils/score-parser.ts:1))

**Score Parsing Logic:**
```typescript
export function parseScore(scoreText: string): ParsedScore {
    const cleanScore = scoreText.trim();
    
    // Handle walkovers
    if (cleanScore === 'scr.' || cleanScore.includes('scr.')) {
        return {
            fullScore: cleanScore,
            sets: [],
            isWalkover: true,
            isRetirement: false,
        };
    }
    
    // Split sets by comma
    const sets = cleanScore.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'scr.');
    
    return {
        fullScore: cleanScore,
        sets,
        isWalkover: cleanScore.includes('scr.'),
        isRetirement: false,
    };
}
```

## Repository Pattern Implementation

The project uses the repository pattern to abstract data access operations. Each repository class handles CRUD operations for its corresponding entity.

### PlayerRepository ([`player.repo.ts`](src/database/repositories/player.repo.ts:5))

**Key Methods:**
- [`upsert()`](src/database/repositories/player.repo.ts:6): Insert or update player data
- [`updateLastScraped()`](src/database/repositories/player.repo.ts:22): Update scrape timestamp
- [`findById()`](src/database/repositories/player.repo.ts:29): Find player by ID

**Upsert Implementation:**
```typescript
async upsert(data: typeof players.$inferInsert) {
    return db.insert(players)
        .values(data)
        .onConflictDoUpdate({
            target: players.id,
            set: {
                name: data.name,
                birthYear: data.birthYear,
                currentClub: data.currentClub,
                registrationValidUntil: data.registrationValidUntil,
                updatedAt: new Date(),
            },
        })
        .run();
}
```

### MatchRepository ([`match.repo.ts`](src/database/repositories/match.repo.ts:5))

**Key Features:**
- Duplicate detection based on tournament, round, and players
- Validation for required player and tournament IDs
- Comprehensive error handling for invalid data

**Duplicate Prevention:**
```typescript
// Check for existing matches
const existing = await db.select()
    .from(matches)
    .where(and(
        eq(matches.tournamentId, data.tournamentId),
        eq(matches.round, data.round),
        eq(matches.player1Id, data.player1Id),
        eq(matches.player2Id, data.player2Id)
    ))
    .get();

if (existing) {
    return existing; // Return existing match instead of creating duplicate
}
```

### ScrapeQueueRepository ([`scrape-queue.repo.ts`](src/database/repositories/scrape-queue.repo.ts:5))

**Queue Operations:**
- [`add()`](src/database/repositories/scrape-queue.repo.ts:6): Add player to queue with optional priority
- [`markProcessing()`](src/database/repositories/scrape-queue.repo.ts:26): Mark item as being processed
- [`markCompleted()`](src/database/repositories/scrape-queue.repo.ts:37): Mark item as successfully completed
- [`markFailed()`](src/database/repositories/scrape-queue.repo.ts:47): Mark item as failed with error message
- [`getNextPending()`](src/database/repositories/scrape-queue.repo.ts:57): Get next item ordered by priority

**Priority-Based Retrieval:**
```typescript
async getNextPending() {
    const result = await db.select()
        .from(scrapeQueue)
        .where(eq(scrapeQueue.status, 'pending'))
        .orderBy(sql`${scrapeQueue.priority} DESC`, scrapeQueue.createdAt)
        .limit(1);
    
    return result[0] || null;
}
```

### TournamentRepository ([`tournament.repo.ts`](src/database/repositories/tournament.repo.ts:5))

**Key Methods:**
- [`upsert()`](src/database/repositories/tournament.repo.ts:6): Insert or update tournament data
- [`ensureSeason()`](src/database/repositories/tournament.repo.ts:20): Ensure season exists in database

## Queue Management System

The queue management system is built around the [`QueueManager`](src/services/queue-manager.ts:7) class, which provides controlled, asynchronous processing of scraping tasks.

### Core Features

1. **Concurrency Control**: Uses p-queue with configurable concurrency and rate limiting
2. **Priority-Based Processing**: Higher priority items are processed first
3. **Retry Logic**: Failed items can be retried with attempt tracking
4. **Status Tracking**: Items move through states: pending → processing → completed/failed

### Queue Configuration

```typescript
this.queue = new PQueue({
    concurrency: 1,                    // Only one scraper at a time
    interval: config.requestDelay,     // Delay between tasks
    intervalCap: 1,                    // One task per interval
});
```

### Processing Loop

The queue processing follows this pattern:

```typescript
async processQueue(processor: (playerId: number) => Promise<void>) {
    while (this.isRunning) {
        const nextItem = await this.repo.getNextPending();
        
        if (!nextItem) {
            await setTimeout(5000); // Wait 5s before checking again
            continue;
        }
        
        await this.queue.add(async () => {
            try {
                await this.repo.markProcessing(playerId);
                await processor(playerId);
                await this.repo.markCompleted(playerId);
            } catch (error) {
                await this.repo.markFailed(playerId, error.message);
            }
        });
    }
}
```

### Queue States

1. **pending**: Item is queued and waiting for processing
2. **processing**: Item is currently being scraped
3. **completed**: Item was successfully processed
4. **failed**: Item failed processing and may be retried

## CLI Commands Documentation

### Scrape Command ([`scrape.ts`](src/cli/scrape.ts:1))

The CLI provides two main commands for scraping operations:

#### `start` Command

**Usage:**
```bash
npm run scrape start [playerId]
npm run scrape start --player <playerId>
```

**Functionality:**
- Starts queue processing if no player ID is provided
- Adds a specific player to the queue and starts processing if ID is provided
- Handles graceful shutdown on SIGINT (Ctrl+C)

**Implementation:**
```typescript
program
    .command('start')
    .description('Start scraping from queue or add a player to scrape')
    .argument('[playerId]', 'Optional player ID to add to queue')
    .option('--player <id>', 'Player ID to add to queue (alternative syntax)')
    .action(async (playerId?: string, options?: { player?: string }) => {
        const queueManager = new QueueManager();
        const scraper = new PlayerScraper(queueManager);
        await scraper.init();
        
        // Add player to queue if specified
        if (playerIdToAdd) {
            await playerRepo.upsert({ id: playerIdNum, name: `Player ${playerIdNum}` });
            await queueManager.addPlayer(playerIdNum);
        }
        
        // Start processing
        await queueManager.processQueue(async (playerId) => {
            await scraper.scrapePlayer(playerId);
        });
    });
```

#### `reset-queue` Command

**Usage:**
```bash
npm run scrape reset-queue
```

**Functionality:**
- Resets all failed items in the queue back to pending status
- Clears error messages
- Useful for retrying failed scraping operations

**Implementation:**
```typescript
program
    .command('reset-queue')
    .description('Reset failed items in queue to pending')
    .action(async () => {
        await db.update(scrapeQueue)
            .set({ status: 'pending', errorMessage: null })
            .where(eq(scrapeQueue.status, 'failed'))
            .run();
        logger.info('Reset failed queue items.');
    });
```

### Database Verification Command ([`verify-db.ts`](src/cli/verify-db.ts:1))

**Usage:**
```bash
npm run verify-db
```

**Functionality:**
- Counts records in main tables (players, matches, tournaments)
- Provides basic verification of scraping success
- Outputs summary statistics

## Configuration and Environment Setup

### Configuration File ([`config.ts`](src/config.ts:6))

The application uses a centralized configuration system:

```typescript
export const config = {
    // Scraping settings
    baseUrl: 'https://cztenis.cz',
    requestDelay: 2000,        // 2 seconds between requests
    maxRetries: 3,
    timeout: 30000,
    
    // Database
    dbPath: path.resolve(process.cwd(), 'data', 'cztenis.db'),
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // User Agent
    userAgent: 'CzTenisH2H-Bot/1.0 (personal project; contact@example.com)',
};
```

### Environment Variables

- `LOG_LEVEL`: Controls logging verbosity (error, warn, info, debug)
- Database path and other settings are configured in the config file

### Database Configuration ([`drizzle.config.ts`](drizzle.config.ts:1))

```typescript
export default defineConfig({
    schema: './src/database/schema.ts',
    out: './src/database/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: './data/cztenis.db',
    },
});
```

### Database Setup Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Apply migrations to create/update tables
npm run db:migrate

# Push schema changes directly (development only)
npm run db:push
```

## Logging System Implementation

The logging system uses Winston for structured, multi-level logging ([`logger.ts`](src/utils/logger.ts:12)).

### Logger Configuration

```typescript
export const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Error-only log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error'
        }),
        // General application log
        new winston.transports.File({
            filename: path.join(logsDir, 'scraper.log')
        }),
        // Console output with colors
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});
```

### Log Levels and Usage

1. **error**: Critical errors that prevent operation
2. **warn**: Warning messages for potential issues
3. **info**: General information about scraping progress
4. **debug**: Detailed debugging information

**Example Usage:**
```typescript
logger.info(`Scraping player ${playerId}`);
logger.warn(`Season select not found for player ${playerId}`);
logger.error(`Failed to scrape player ${playerId}`, { error });
logger.debug(`Successfully saved match: ${playerId} vs ${opponentId}`);
```

### Log Files

- `logs/error.log`: Error-level messages only
- `logs/scraper.log`: All log messages
- Console: Colored output for immediate feedback

## Current Implementation Status

### Completed Features

✅ **Database Schema**: Complete schema with all necessary tables and relationships
✅ **Player Scraping**: Full player profile and match history extraction
✅ **Match Parsing**: Comprehensive match data extraction including scores and participants
✅ **Queue System**: Robust queue management with priority and retry logic
✅ **Repository Layer**: Full CRUD operations for all entities
✅ **CLI Interface**: Complete command-line tools for scraping and management
✅ **Logging System**: Multi-level logging with file and console output
✅ **Browser Management**: Robust browser automation with error recovery
✅ **Season Handling**: Multi-season data collection with automatic season switching

### Known Limitations

⚠️ **H2H Statistics**: The `h2h_stats` table exists but is not automatically populated
⚠️ **Player Rankings**: The `player_rankings` table exists but ranking data is not scraped
⚠️ **Error Recovery**: Some edge cases in HTML parsing may cause data loss
⚠️ **Rate Limiting**: Fixed delay between requests may not be optimal for all scenarios
⚠️ **Memory Usage**: Large scraping operations may consume significant memory
⚠️ **Duplicate Detection**: Match duplicate detection could be more sophisticated

### Performance Considerations

1. **Browser Recycling**: Browser is recreated every 50 pages to prevent memory leaks
2. **Sequential Processing**: Only one player is processed at a time to avoid overwhelming the target server
3. **Request Delays**: 2-second delay between requests to be respectful to the target server
4. **Database Indexes**: Strategic indexes on frequently queried columns

### Data Quality Issues

1. **Player Name Parsing**: First/last name separation is basic and may not handle all cases
2. **Score Parsing**: Complex score formats (retirements, defaults) may not be fully handled
3. **Tournament Categories**: Category parsing is limited and may miss some variations
4. **Date Parsing**: Date formats are assumed to be consistent but may vary

## Future Development Roadmap

### High Priority Items

1. **H2H Statistics Calculation**
   - Implement automatic H2H stats calculation after match imports
   - Add triggers or scheduled jobs to keep stats current
   - Include H2H trends and recent form analysis

2. **Player Rankings Scraping**
   - Extract ranking data from player profiles
   - Track ranking changes over time
   - Add ranking history and progression analysis

3. **Enhanced Error Handling**
   - Implement more robust HTML parsing for edge cases
   - Add data validation and quality checks
   - Improve error recovery and retry mechanisms

4. **Performance Optimizations**
   - Implement concurrent scraping with rate limiting
   - Add database connection pooling
   - Optimize queries and add missing indexes

### Medium Priority Items

1. **Advanced CLI Features**
   - Add bulk player import from files
   - Implement data export functionality (JSON, CSV)
   - Add scraping statistics and progress reporting

2. **Web Interface**
   - Create a simple web UI for data visualization
   - Add player search and H2H lookup features
   - Implement tournament browsing and statistics

3. **Data Analysis Features**
   - Add tournament difficulty ratings
   - Implement player performance trends
   - Create head-to-head prediction models

4. **Scraping Enhancements**
   - Add tournament bracket scraping
   - Implement team competition results
   - Add club and venue information extraction

### Low Priority Items

1. **API Development**
   - REST API for data access
   - GraphQL endpoint for complex queries
   - Authentication and rate limiting

2. **Mobile Application**
   - React Native app for on-the-go access
   - Offline data synchronization
   - Push notifications for favorite players

3. **Machine Learning Integration**
   - Match outcome prediction models
   - Player performance analysis
   - Anomaly detection in results

4. **Integration Features**
   - Integration with other tennis databases
   - Social media sharing of results
   - Email notifications for tournament updates

### Technical Debt Items

1. **Code Quality**
   - Add comprehensive unit and integration tests
   - Improve TypeScript type coverage
   - Add code documentation and examples

2. **Infrastructure**
   - Docker containerization for deployment
   - CI/CD pipeline setup
   - Monitoring and alerting system

3. **Security**
   - Input validation and sanitization
   - Secure configuration management
   - Access control for API endpoints

4. **Scalability**
   - Database sharding for large datasets
   - Caching layer for frequently accessed data
   - Load balancing for multiple scrapers

---

*This documentation is current as of the latest version of the cztenis-scraper project. For the most up-to-date information, please refer to the source code and commit history.*