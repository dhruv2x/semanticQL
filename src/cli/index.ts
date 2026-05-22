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
import { connectDB } from "../db/connection";
import { startRepl } from "./repl";
import { printWelcome } from "./output";

dotenv.config({ quiet: true });

const database = process.argv[2];

if (!database) {
  console.log("Usage: semanticql <database>");
  process.exit(1);
}

connectDB({
  database,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

printWelcome(database);

startRepl();
