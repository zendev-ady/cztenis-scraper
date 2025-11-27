# CZTenis Scraper - Web Frontend

React-based web interface for the CZTenis Scraper project. This application provides a user-friendly interface to view and manage Czech tennis player data, match results, and tournament statistics.

## Features

- Player profile browsing and search
- Match history visualization
- Head-to-head (H2H) statistics comparison
- Tournament data display
- Player rankings overview
- Responsive design with modern UI/UX

## Tech Stack

- **React 19**: Modern React with latest features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing
- **TailwindCSS**: Utility-first CSS framework

## Installation

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Development

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is occupied).

### Build

Build the production-optimized bundle:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview

Preview the production build locally:

```bash
npm run preview
```

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

## Project Structure

```
web/
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── contexts/           # React context providers
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles and Tailwind imports
├── public/                 # Static assets
├── index.html              # HTML template
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # TailwindCSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json
```

## Configuration

### Vite

The Vite configuration is located in `vite.config.ts`. Default settings use the React plugin with Fast Refresh.

### TailwindCSS

Tailwind configuration is in `tailwind.config.js`. Customize theme, colors, and plugins here.

### TypeScript

TypeScript configuration is split into:
- `tsconfig.json`: Base configuration
- `tsconfig.app.json`: Application code configuration
- `tsconfig.node.json`: Build tool configuration

## Development

### Code Style

The project uses ESLint for code quality. Configuration is in `eslint.config.js`.

### Type Safety

TypeScript is configured with strict type checking. Ensure all types are properly defined.

## Integration with Backend

The web frontend is designed to work with the CZTenis Scraper backend. Make sure the backend API is running before starting the frontend development.

## License

ISC
