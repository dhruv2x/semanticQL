/**
 * SemanticQL CLI — readline interface
 * 
 * - Standard I/O stream configuration factory
 */

import readline from "readline";
import { styles } from "../utils/styles.js";

/**
 * Prompt factory for the CLI’s interactive REPL.
 */
export function createPrompt() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: styles.blue("semanticql > "),
    });
}
