# Postgres migration

This app is still Firebase-first. The first Postgres slice is listings, guarded by:

```env
DATABASE_URL=postgres://localhost:5432/josealo
USE_POSTGRES_LISTINGS=true
```

Keep `USE_POSTGRES_LISTINGS=false` until the local database exists and `db/schema.sql` has been applied.

## Local setup

1. Make sure Postgres command-line tools are in your PATH.

   On macOS, common locations are:

   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin
   /opt/homebrew/opt/postgresql@16/bin
   /usr/local/opt/postgresql@16/bin
   ```

2. Create the local database:

   ```bash
   createdb josealo
   ```

3. Apply the schema:

   ```bash
   psql postgres://localhost:5432/josealo -f db/schema.sql
   ```

4. Add this to `.env.local`:

   ```env
   DATABASE_URL=postgres://localhost:5432/josealo
   USE_POSTGRES_LISTINGS=true
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

## Migration order

Do not migrate everything at once. The current app uses Firebase Auth and Firestore in many places, so the safer order is:

1. Listings: create, edit, delete, item detail, marketplace search.
2. Profiles: public profile and private onboarding/settings data.
3. Likes and follows.
4. Chats and messages.
5. Reports, reviews, admin, ads, analytics, presence.
6. Auth, only after the data migration is stable.

The current Postgres schema includes starter tables for the first few areas, but only listings are wired behind the feature flag.

## Import existing Firebase listings

Run a dry run first:

```bash
npm run migrate:listings:dry-run
```

If the count looks right, run the import:

```bash
npm run migrate:listings
```

The script preserves Firebase listing document IDs, so old `/item/{id}` URLs can continue to work after the listing reads move to Postgres.

Do not delete Firebase data immediately after importing. Keep it until:

1. The import count matches what you expect.
2. Homepage, search, item detail, edit, sold, and delete flows work in Postgres.
3. You have a backup/export of the Firebase collections.
4. Production Postgres is configured and verified.

## Deployment note

For production, use a managed Postgres provider instead of a local database. On Vercel, Neon via Marketplace is the cleanest path because it provisions `DATABASE_URL` for the project.
