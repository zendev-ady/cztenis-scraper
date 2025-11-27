# CZTenis Scraper

A TypeScript-based web scraper for Czech tennis data from cztenis.cz. This project scrapes player information, match results, tournament data, and maintains head-to-head statistics in a SQLite database.

## Features

- Web scraping of player profiles and match history from cztenis.cz
- Queue-based scraping system with retry logic
- SQLite database with Drizzle ORM for data persistence
- Head-to-head (H2H) statistics calculation
- Tournament and match data extraction
- Player rankings tracking
- CLI interface for scraping operations and database verification

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cztenis-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:generate  # Generate database migrations
npm run db:migrate   # Apply migrations to create tables
```

## Usage

### Scraping Data

Start scraping from the queue or add a specific player:

```bash
# Start processing the queue
npm run scrape start

# Add a specific player to the queue and start scraping
npm run scrape start 1026900
# or
npm run scrape start --player 1026900
```

#### Depth-Limited Scraping

Control how deeply the scraper crawls through the player network using the `--max-depth` option:

**Easy method (recommended for Windows):** Use pre-configured npm scripts:

```bash
# Scrape only the specified player (no opponents)
npm run scrape:depth0 1026900

# Scrape the player and their direct opponents only
npm run scrape:depth1 1026900

# Scrape the player, their opponents, and opponents' opponents
npm run scrape:depth2 1026900

# Unlimited depth (scrapes entire connected network)
npm run scrape:unlimited 1026900
```

**Alternative methods:**

```bash
# Using npm with -- separator (Linux/macOS)
npm run scrape -- start 1026900 --max-depth 1

# Using npx directly (works on all platforms)
npx tsx src/cli/scrape.ts start 1026900 --max-depth 1
```

**Depth levels explained:**
- `depth 0`: Only the manually specified player
- `depth 1`: The player + all their opponents (typically 5-50 players)
- `depth 2`: All of the above + opponents of opponents (hundreds of players)
- `depth -1`: Unlimited (entire connected network, potentially thousands of players)

**Use cases:**
- **Testing**: Use `--max-depth 0` or `--max-depth 1` for quick testing
- **Targeted scraping**: Use `--max-depth 1` to get a player and their immediate competition
- **Full dataset**: Use `--max-depth -1` for production scraping of the entire network

### Queue Management

Check the current queue status and depth distribution:

```bash
npm run queue-status
```

Reset failed items in the queue back to pending status:

```bash
npm run scrape reset-queue
```

Clear the entire scrape queue (use before testing to ensure clean state):

```bash
npm run scrape clear-queue
```

**Important:** Always clear the queue before testing depth limits to avoid interference from previously queued players.

### Database Verification

Check the database contents and verify scraping results:

```bash
npm run verify-db
```

### Database Operations

Generate new migrations after schema changes:
```bash
npm run db:generate
```

Apply pending migrations:
```bash
npm run db:migrate
```

Push schema changes directly to database (development only):
```bash
npm run db:push
```

## Project Structure

```
cztenis-scraper/
├── src/
│   ├── cli/                    # CLI commands
│   │   ├── scrape.ts          # Scraping commands
│   │   └── verify-db.ts       # Database verification
│   ├── database/              # Database layer
│   │   ├── migrations/        # Database migrations
│   │   ├── repositories/      # Data access objects
│   │   ├── schema.ts          # Database schema definition
│   │   └── index.ts           # Database connection
│   ├── scrapers/              # Web scraping logic
│   │   ├── parsers/           # HTML parsers
│   │   └── player-scraper.ts  # Player data scraper
│   ├── services/              # Business logic
│   │   └── queue-manager.ts   # Queue management
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   │   ├── logger.ts          # Logging configuration
│   │   └── score-parser.ts    # Score parsing utilities
│   └── config.ts              # Application configuration
├── data/                      # Database file location
├── drizzle.config.ts          # Drizzle ORM configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

The application uses the following main tables:

- **players**: Player information including name, club, and registration details
- **matches**: Match results with scores, participants, and tournament information
- **tournaments**: Tournament details including venue, date, and category
- **seasons**: Season definitions and time periods
- **h2h_stats**: Calculated head-to-head statistics between players
- **player_rankings**: Player rankings across different categories and seasons
- **scrape_queue**: Queue management for scraping operations

## Technologies Used

- **TypeScript**: Type-safe JavaScript development
- **Node.js**: Runtime environment
- **Drizzle ORM**: Type-safe SQL toolkit for TypeScript
- **SQLite**: Lightweight database for data storage
- **Playwright**: Browser automation for web scraping
- **Cheerio**: Server-side HTML parsing
- **Commander.js**: CLI framework for Node.js
- **Winston**: Logging library
- **p-queue**: Promise queue with concurrency control

## Configuration

The application can be configured through environment variables:

- `LOG_LEVEL`: Set logging level (default: 'info')

Other configuration options are available in `src/config.ts`:
- Scraping delay and retry settings
- Database path
- Base URL for scraping
- User agent string

## Development

To run the application in development mode:

```bash
npm start
```

To run tests:

```bash
npm test
```

## License

ISC