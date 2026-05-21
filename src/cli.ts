#!/usr/bin/env node

import "dotenv/config";
import * as readline from "readline";
import { Pool } from "pg";
import { tokenize } from "./tokenizer/index";
import { parse } from "./parser/index";
import { buildSql } from "./sql-builder/index";

// ANSI Styling Helpers
const styles = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    bgBlue: "\x1b[44m",
    white: "\x1b[37m",
};

/**
 * Preprocess user queries when a table is bound.
 * Converts:
 *   "how many" -> "how many <boundTable>"
 *   "how many with state sale" -> "how many <boundTable> with state sale"
 */
function preprocessQuery(input: string, boundTable?: string): string {
    const trimmed = input.trim();
    if (!boundTable) return trimmed;

    if (trimmed.toLowerCase().startsWith("how many")) {
        const afterHowMany = trimmed.slice("how many".length).trim();
        // If the query is just "how many" or continues directly with "with ..."
        if (afterHowMany === "" || afterHowMany.toLowerCase().startsWith("with")) {
            return `how many ${boundTable} ${afterHowMany}`.trim();
        }
    }
    return trimmed;
}

async function runREPL() {
    const boundTable = process.argv[2];

    console.log(`${styles.bgBlue}${styles.white}${styles.bold}  SemanticQL — Deterministic NL to SQL Converter  ${styles.reset}\n`);

    // DB setup
    let pool: Pool | null = null;
    let dbName: string | null = null;
    const database = process.argv[2];
    if (!database) {
        console.error("Usage: semanticql <database>");
        process.exit(1);
    }
    const dbUrl =
        `postgres://${process.env.DB_USER}:` +
        `${process.env.DB_PASSWORD}@` +
        `${process.env.DB_HOST}:` +
        `${process.env.DB_PORT}/` +
        `${database}`;

    if (dbUrl) {
        pool = new Pool({ connectionString: dbUrl });
        dbName = dbUrl.split("/").pop() || "database";
        console.log(`${styles.dim}Connected to DB:${styles.reset} ${styles.bold}${styles.green}${dbName}${styles.reset}`);
    } else {
        console.log(`${styles.dim}No database URL (DB_URL) found in environment/dotenv. Execution will be skipped.${styles.reset}`);
    }

    if (boundTable) {
        console.log(`${styles.dim}Bound to PostgreSQL table:${styles.reset} ${styles.bold}${styles.cyan}${boundTable}${styles.reset}`);
        console.log(`${styles.dim}You can omit the table name (e.g., "how many" or "how many with state sale")${styles.reset}\n`);
    } else {
        console.log(`${styles.dim}No table bound. Provide full queries (e.g., "how many sale_order with state sale")${styles.reset}\n`);
    }
    console.log(`${styles.dim}Type "exit" or "quit" to close the prototype REPL.${styles.reset}\n`);

    // Set prompt symbol to database name if connected, otherwise bound table name, otherwise default
    const promptSymbol = dbName
        ? `${styles.bold}${styles.magenta}semanticql (${dbName}) > ${styles.reset}`
        : (boundTable
            ? `${styles.bold}${styles.magenta}semanticql (${boundTable}) > ${styles.reset}`
            : `${styles.bold}${styles.magenta}semanticql > ${styles.reset}`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.setPrompt(promptSymbol);
    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();
        if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
            rl.close();
            return;
        }

        if (input === "") {
            rl.prompt();
            return;
        }

        // Check for debug flag "-d" at the end of the query
        let debug = false;
        let queryText = input;
        if (queryText.endsWith(" -d")) {
            debug = true;
            queryText = queryText.slice(0, -3).trim();
        }

        const preprocessed = preprocessQuery(queryText, boundTable);
        if (debug && preprocessed !== queryText) {
            console.log(`${styles.dim}→ Rewrote query to: "${preprocessed}"${styles.reset}`);
        }

        try {
            const tokens = tokenize(preprocessed);
            const ast = parse(tokens);
            const { sql, params } = buildSql(ast);

            if (debug) {
                // Show full debugging details
                console.log(`\n${styles.bold}${styles.cyan}--- Tokens ---${styles.reset}`);
                console.log(JSON.stringify(tokens, null, 2));

                console.log(`\n${styles.bold}${styles.yellow}--- Parsed AST ---${styles.reset}`);
                console.log(JSON.stringify(ast, null, 2));

                console.log(`\n${styles.bold}${styles.green}--- Generated SQL ---${styles.reset}`);
                console.log(sql);

                console.log(`\n${styles.bold}${styles.magenta}--- Params ---${styles.reset}`);
                console.log(JSON.stringify(params, null, 2));

                if (pool) {
                    try {
                        const result = await pool.query(sql, params);
                        const count = (result.rows[0] as { count?: string | number })?.count ?? 0;
                        console.log(`\n${styles.bold}${styles.green}--- DB Result ---${styles.reset}`);
                        console.log(`COUNT = ${count}`);
                    } catch (dbErr) {
                        console.log(`\n${styles.bold}${styles.red}❌ DB Execution Error: ${(dbErr as Error).message}${styles.reset}`);
                    }
                }
                console.log();
            } else {
                // Show clean production-like output
                console.log(`\nSQL:\n${sql}`);

                if (pool) {
                    try {
                        const result = await pool.query(sql, params);
                        const count = (result.rows[0] as { count?: string | number })?.count ?? 0;
                        console.log(`\nResult:\n${count}`);
                    } catch (dbErr) {
                        console.log(`\n${styles.bold}${styles.red}❌ DB Execution Error: ${(dbErr as Error).message}${styles.reset}`);
                    }
                }
                console.log();
            }
        } catch (err) {
            console.log(`\n${styles.bold}${styles.red}❌ Error: ${(err as Error).message}${styles.reset}\n`);
        }

        rl.prompt();
    });

    rl.on("close", async () => {
        if (pool) {
            await pool.end();
        }
        console.log(`\n${styles.bold}${styles.cyan}Goodbye!${styles.reset}\n`);
        process.exit(0);
    });
}

runREPL();
