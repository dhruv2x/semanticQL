/**
 * SemanticQL CLI — REPL loop
 * 
 * - Orchestrates user inputs
 * - Intercepts internal CLI controls (help, exit, etc.)
 * - Executes queries asynchronously
 * - Handles graceful stream termination
 * - Supports optional debug mode
 */

import { createPrompt } from "./prompt";
import {
  executeQuery,
  executeSQL,
} from "../db/execute";
import { printRows } from "./output";
import {
  isExitCommand,
  isHelpCommand,
  printHelp,
} from "./commands";
import { semanticQL, normalize } from "..";

export async function startRepl() {
  const rl = createPrompt();

  rl.prompt();

  rl.on("line", async (input) => {
    const query = input.trim();

    if (!query) {
      rl.prompt();
      return;
    }

    if (isExitCommand(query)) {
      rl.close();
      return;
    }

    if (isHelpCommand(query)) {
      printHelp();
      rl.prompt();
      return;
    }

    const isDebug = query.endsWith(" -d");

    const cleanedQuery = isDebug
      ? query.slice(0, -3).trim()
      : query;

    try {
      const normalizedResult = normalize(cleanedQuery);

      if (normalizedResult.isRaw) {
        console.log("⚡ [Raw SQL Bypassing Engine]");
        const rows = await executeSQL(normalizedResult.rawSql!, []);
        printRows(rows);
        rl.prompt();
        return;
      }

      // 3. Handle Standard SemanticQL Processing Mode
      if (isDebug) {
        const result = semanticQL(normalizedResult.query!);

        console.log("--- Tokens ---");
        console.log(JSON.stringify(result.tokens, null, 2));

        console.log("--- Parsed AST ---");
        console.log(JSON.stringify(result.ast, null, 2));

        console.log("--- Generated SQL ---");
        console.log(result.sql);

        console.log("--- Params ---");
        console.log(JSON.stringify(result.params, null, 2));

        const rows = await executeSQL(result.sql, result.params);
        console.log("--- DB Result ---");
        printRows(rows);
      } else {
        const rows = await executeQuery(normalizedResult.query!);
        printRows(rows);
      }
    } catch (error) {
      console.error(error);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
