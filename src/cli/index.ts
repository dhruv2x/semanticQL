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
import { connectDB, validateDBConnection } from "../db/connection.js";
import { startRepl } from "./repl.js";
import { printWelcome } from "./output.js";
import { printGrammar } from "./commands.js";
import { describeConnectionTarget, parseCliOptions, printUsage } from "./options.js";

dotenv.config({ quiet: true });

async function main() {
  try {
    const { connectOptions, showHelp, showGrammar } = await parseCliOptions(
      process.argv.slice(2),
      process.env
    );

    if (showHelp) {
      printUsage();
      process.exit(0);
    }

    // Intercept and print grammar, then exit
    if (showGrammar) {
      printGrammar();
      process.exit(0);
    }

    connectDB(connectOptions);
    await validateDBConnection();

    printWelcome(describeConnectionTarget(connectOptions));
    startRepl();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
