# AppThrust Next.js PostgreSQL template

This starter proves the AppThrust managed PostgreSQL path:

- AppThrust injects `DATABASE_URL` through `ComponentConnection`.
- The initial schema is applied through `DatabaseChange`.
- The Next.js app reads and writes `appthrust_demo_messages`.

The app does not run migrations on startup. For local development, apply
`db/migrations/0001_init.sql` to your PostgreSQL database, then set:

```bash
DATABASE_URL=postgresql://app:password@localhost:5432/app
```

Run locally:

```bash
npm install
npm run dev
```
