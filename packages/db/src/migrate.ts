import { migrate } from "drizzle-orm/postgres-js/migrator";
import { migrationClient, db } from "./client.js";

async function runMigrations() {
    console.log("⏳ Running migrations...");

    const start = Date.now();
    try {
        // This will run migrations from the "drizzle" directory
        // We need to ensure this directory exists relative to where the script is run
        // or provide an absolute path.
        // In Docker, we'll copy "drizzle" to "packages/db/drizzle"
        await migrate(db, { migrationsFolder: "packages/db/drizzle" });

        const end = Date.now();
        console.log(`✅ Migrations completed in ${end - start}ms`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed");
        console.error(err);
        process.exit(1);
    } finally {
        await migrationClient.end();
    }
}

runMigrations();
