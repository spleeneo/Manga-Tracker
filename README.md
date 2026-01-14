# Manga Tracker 📚

A personal manga tracking application that aggregates chapters from multiple sources (MangaDex, NeloManga, etc.) into a single, clean interface.

## Features

- **Multi-Source Tracking**: Aggregate chapters from MangaDex, NeloManga, and more.
- **Unified Library**: Track all your reading progress in one place.
- **Auto-Updates**: Automatically fetch new chapters from tracked sources.
- **Clean UI**: A solid, distraction-free interface (no glassmorphism!) designed for readability.
- **Click-to-Add**: Easily add manga from search results with a single click.

## Prerequisites

- **Node.js**: Version 18 or higher recommended.
- **npm**: Comes with Node.js.

## Installation & Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Database Setup**
    This project uses SQLite via Prisma. You need to push the schema to create the database file.
    ```bash
    npx prisma db push
    ```

3.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server at localhost:3000 |
| `npm run build` | Builds the application for production |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs the linter to check for code issues |
| `npm run db:reset` | **⚠️ WIPES DATABASE**: Deletes all manga, sources, and chapters. |

## Resetting the Database

If you need to clear all data and start fresh, run:

```bash
npm run db:reset
```

This will execute a script to delete all entries from the SQLite database.

## Project Structure

- `src/app`: Next.js App Router pages and API routes.
- `src/components`: UI components (MangaCard, ChapterList, etc.).
- `src/lib`: core utilities (database, scrapers).
- `scripts`: Maintenance scripts (reset-db, cleanup-db).
- `prisma`: Database schema (`schema.prisma`).

## Contributing

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request
