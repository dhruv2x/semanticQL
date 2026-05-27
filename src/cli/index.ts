#!/usr/bin/env node

/**
 * SemanticQL CLI — main entry point
 * 
 * - Environment initialization
 * - Argument validation
 * - Database connectivity orchestration
 * - REPL initiation
 */

import dotenv from "dotenv";
import { connectDB } from "../db/connection.js";
import { startRepl } from "./repl.js";
import { printWelcome } from "./output.js";

dotenv.config({ quiet: true });

// Fallback to standard psql environment variable (PGDATABASE)
const database = process.argv[2] || process.env.PGDATABASE;

if (!database) {
  console.log("Usage: semanticql <database>");
  process.exit(1);
}

connectDB({
  database,
  host: process.env.DB_HOST || process.env.PGHOST || "/var/run/postgresql",
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  user: process.env.DB_USER || process.env.PGUSER || process.env.USER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
});

printWelcome(database);

startRepl();
