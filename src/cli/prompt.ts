/**
 * SemanticQL CLI — readline interface
 * 
 * - Standard I/O stream configuration factory
 * - Masked password prompt
 */

import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { styles } from "../utils/styles.js";

/**
 * Prompt factory for the CLI’s interactive REPL.
 */
export function createPrompt() {
    return readline.createInterface({
        input: stdin,
        output: stdout,
        prompt: styles.blue("semanticql > "),
    });
}

/**
 * Prompt for a secret value without echoing the typed characters.
 * Falls back to a normal readline question when the process is not attached
 * to a TTY (for example, when stdin/stdout are piped).
 */
export async function promptForPassword(prompt = "Password: "): Promise<string> {
    if (!stdin.isTTY || !stdout.isTTY) {
        const rl = createInterface({
            input: stdin,
            output: stdout,
        });

        try {
            return await rl.question(prompt);
        } finally {
            rl.close();
        }
    }

    return await new Promise<string>((resolve, reject) => {
        let password = "";
        const cleanup = () => {
            stdin.off("keypress", onKeypress);
            if (typeof stdin.setRawMode === "function") {
                stdin.setRawMode(false);
            }
            stdin.pause();
        };

        const onKeypress = (_chunk: string, key: readline.Key) => {
            if (key.ctrl && key.name === "c") {
                cleanup();
                stdout.write("\n");
                reject(new Error("Interrupted"));
                return;
            }

            if (key.name === "return" || key.name === "enter") {
                cleanup();
                stdout.write("\n");
                resolve(password);
                return;
            }

            if (key.name === "backspace") {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    stdout.write("\b \b");
                }
                return;
            }

            if (typeof key.sequence === "string" && key.sequence.length > 0 && !key.ctrl && !key.meta) {
                password += key.sequence;
                stdout.write("*");
            }
        };

        readline.emitKeypressEvents(stdin);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("keypress", onKeypress);
        stdout.write(prompt);
    });
}
