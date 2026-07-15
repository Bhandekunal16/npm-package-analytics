<div align="center">
  <img src="./public/icon.svg" alt="NPM Package Analytics" width="80" height="80" />
  <h1>NPM Package Analytics</h1>
  <p>Real-time analytics, download trends, dependency trees, and health metrics for npm packages.</p>
</div>

---

## Overview

**NPM Package Analytics** (PackageLens) is a full-stack web app for exploring the npm ecosystem. Search any package and get download statistics, version timelines, dependency graphs, GitHub stats, security signals, and a composite health score — all in one dashboard.

### Features

- **Dashboard** — Search packages, view download charts (7/30/90/365-day ranges), health scores, version history, dependency tree, and GitHub repository stats
- **Compare** — Side-by-side comparison of up to 4 packages (downloads, stars, health, release cadence)
- **Rankings** — Curated leaderboards for most downloaded, trending, and top-starred packages
- **Bookmarks & history** — Save favorites and track recently viewed packages (stored in `localStorage`)
- **Deep links** — Share a package via `?package=express`
- **Dark mode** — Toggle with the UI or `Ctrl+M`

### Keyboard shortcuts

| Shortcut   | Action              |
|------------|---------------------|
| `Ctrl+D`   | Open Dashboard      |
| `Ctrl+C`   | Open Compare        |
| `Ctrl+R`   | Open Rankings       |
| `Ctrl+M`   | Toggle dark mode    |

---

## Tech stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19, TypeScript, Tailwind CSS 4 |
| Charts     | Recharts                            |
| Backend    | Express (Node.js)                   |
| Build      | Vite 6, esbuild                     |
| Data       | npm Registry, npm Downloads API, GitHub API |

---

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone <your-repo-url>
cd npm-package-analytics
npm install
```

### Environment variables

Copy the example env file and configure optional variables:

```bash
cp .env.example .env
```

| Variable        | Required | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `GITHUB_TOKEN`  | No       | GitHub personal access token for higher API rate limits |
| `NODE_ENV`      | No       | Set to `production` for production builds        |

> **Note:** The app fetches data from public npm and GitHub APIs. A `GITHUB_TOKEN` is recommended for heavy usage to avoid rate limits.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npm run build
npm start
```

### Deploy to Vercel

This project uses Vercel serverless functions for the API (`api/index.ts`) and Vite for the static frontend.

1. Push the repo to GitHub and import it in [Vercel](https://vercel.com)
2. Vercel auto-detects the Vite build; `vercel.json` routes `/api/*` to the Express API handler
3. Optionally add `GITHUB_TOKEN` in Vercel project settings → Environment Variables

> **Note:** The API does not run from `server.ts` on Vercel — only the static `dist/` output and `/api` serverless functions are deployed. Local dev still uses `npm run dev` with the full Express server.

---

## API endpoints

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| `GET`  | `/api/search?q=`      | Package search autocomplete    |
| `GET`  | `/api/package/:name`  | Full package analytics         |
| `GET`  | `/api/compare?packages=` | Compare multiple packages   |
| `GET`  | `/api/rankings`       | Curated package rankings       |

Responses are cached in memory (5 min – 12 hr depending on endpoint) with request deduplication and rate limiting (120 req/min per IP).

---

## Project structure

```
npm-package-analytics/
├── public/
│   └── icon.svg          # App icon / favicon
├── src/
│   ├── App.tsx           # Root layout, routing, state
│   ├── components/
│   │   ├── DashboardOverview.tsx
│   │   ├── CompareView.tsx
│   │   ├── RankingsView.tsx
│   │   ├── DependencyTree.tsx
│   │   └── Header.tsx
│   └── types.ts
├── api/
│   ├── index.ts          # Vercel serverless API entry
│   └── _lib/
│       └── apiApp.ts     # Shared Express API logic
├── server.ts             # Local dev server (Express + Vite)
├── index.html
└── vite.config.ts
```

---

## License

Apache-2.0
