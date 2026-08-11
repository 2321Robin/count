import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db.js";

const dbPath = process.env.COUNTER_DB_PATH ?? "counter-data/db.sqlite";
const port = Number(process.env.PORT ?? 8787);

const db = createDb(dbPath);
const app = createApp(db);

serve({ fetch: app.fetch, port });
console.log(`counter-api listening on http://127.0.0.1:${port} (db: ${dbPath})`);
