import { getSecret } from "astro:env/server";
import Database from "better-sqlite3";

export const db = new Database(getSecret("DATABASE_URL"));

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
