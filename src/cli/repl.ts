/**
 * SemanticQL CLI — REPL loop
 * 
 * - Orchestrates user inputs
 * - Intercepts internal CLI controls (help, exit, etc.)
 * - Executes queries asynchronously
 * - Handles graceful stream termination
 */

import { createPrompt } from "./prompt";
import { executeQuery } from "../db/execute";
import { printRows } from "./output";
import {
  isExitCommand,
  isHelpCommand,
  printHelp,
} from "./commands";

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

    try {
      const rows = await executeQuery(query);
      printRows(rows);
    } catch (error) {
      console.error(error);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
