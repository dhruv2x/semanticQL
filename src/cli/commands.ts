import { styles } from "../utils/styles.js";

export function isGrammarCommand(input: string) {
  return ["grammar", "\\g"].includes(input.trim().toLowerCase());
}

export function isExitCommand(input: string) {
  return ["exit", "quit", "\\q"].includes(input.trim().toLowerCase());
}

export function isHelpCommand(input: string) {
  return input.trim().toLowerCase() === "help";
}

export function printHelp() {
  console.log(`
${styles.bgBlue(styles.white(styles.bold("  SemanticQL Help & Usage  ")))}

${styles.bold("Interactive REPL Commands:")}
  ${styles.green("help")}        ${styles.gray("Show this help menu")}
  ${styles.green("exit, \\q")}   ${styles.gray("Exit the CLI")}

${styles.bold("Query Modifiers (Inside REPL):")}
  ${styles.cyan("-d")}          ${styles.gray("Run query in debug mode (shows tokens, AST, and generated SQL)")}
  ${styles.cyan("-r")}          ${styles.gray("Run raw SQL query (e.g., -r SELECT * FROM users;)")}

${styles.bold("Startup Connection Flags:")}
  ${styles.cyan("-d, --dbname")}     ${styles.gray("Database name")}
  ${styles.cyan("-h, --host")}       ${styles.gray("Database server host")}
  ${styles.cyan("-p, --port")}       ${styles.gray("Database server port")}
  ${styles.cyan("-U, --username")}   ${styles.gray("Database user")}
  ${styles.cyan("-W, --password")}   ${styles.gray("Prompt for password")}
  ${styles.cyan("--url")}            ${styles.gray("PostgreSQL connection URL")}
  ${styles.cyan("--grammar, -g")}    ${styles.gray("Show the SemanticQL syntax cheat sheet")}

${styles.dim("---------------------------------------------------------")}
💡 ${styles.bold("Need syntax examples?")} 
Exit the REPL and run: ${styles.yellow("semanticql --grammar")}
${styles.dim("---------------------------------------------------------")}
`);
}

export function printGrammar() {
  console.log(`
${styles.bgBlue(styles.white(styles.bold("  SemanticQL Cheat Sheet & Examples  ")))}

${styles.dim("Note: The words in ")}${styles.yellow("yellow")}${styles.dim(" are examples of your actual tables, columns, and values.")}

${styles.bold("1. Basic Queries (Selecting Data)")}
Use verbs like: ${styles.cyan("show, list, fetch, get, find")}

  ${styles.gray("// Show an entire table")}
  > ${styles.green("show")} ${styles.yellow("user_table")}
  
  ${styles.gray("// Pick specific columns")}
  > ${styles.green("list")} ${styles.yellow("id, name")} ${styles.green("from")} ${styles.yellow("customers")}

${styles.bold("2. Filtering Data (Where / With)")}
Connectors: ${styles.cyan("where, with, and, or")}

  ${styles.gray("// Exact match")}
  > ${styles.green("find")} ${styles.yellow("orders")} ${styles.green("where")} ${styles.yellow("status")} ${styles.green("is")} ${styles.yellow("shipped")}
  
  ${styles.gray("// Number comparisons (>, <, >=, <=)")}
  > ${styles.green("show")} ${styles.yellow("products")} ${styles.green("with")} ${styles.yellow("price")} ${styles.green("less than")} ${styles.yellow("50")}
  > ${styles.green("fetch")} ${styles.yellow("payments")} ${styles.green("where")} ${styles.yellow("amount")} ${styles.green("is at least")} ${styles.yellow("100")}
  
  ${styles.gray("// Text search")}
  > ${styles.green("list")} ${styles.yellow("customers")} ${styles.green("where")} ${styles.yellow("email")} ${styles.green("ends with")} ${styles.yellow("'@gmail.com'")}
  > ${styles.green("show")} ${styles.yellow("users")} ${styles.green("where")} ${styles.yellow("name")} ${styles.green("starts with")} ${styles.yellow("'A'")}

  ${styles.gray("// Multiple conditions")}
  > ${styles.green("show")} ${styles.yellow("order_table")} ${styles.green("where")} ${styles.yellow("total")} ${styles.green(">")} ${styles.yellow("100")} ${styles.green("and")} ${styles.yellow("status")} ${styles.green("is")} ${styles.yellow("paid")}

${styles.bold("3. Aggregations (Math & Counting)")}
Use math words: ${styles.cyan("count, sum, avg, average, max, highest, min, lowest")}

  ${styles.gray("// Count rows")}
  > ${styles.green("how many")} ${styles.yellow("users")}
  > ${styles.green("count")} ${styles.yellow("orders")} ${styles.green("where")} ${styles.yellow("status")} ${styles.green("is")} ${styles.yellow("pending")}
  
  ${styles.gray("// Calculate totals and averages")}
  > ${styles.green("sum")} ${styles.yellow("amount")} ${styles.green("from")} ${styles.yellow("payments")}
  > ${styles.green("highest")} ${styles.yellow("score")} ${styles.green("from")} ${styles.yellow("exams")}

${styles.bold("4. Sorting & Limiting")}
Use modifiers: ${styles.cyan("sort by, order by, limit")}

  ${styles.gray("// Basic sorting")}
  > ${styles.green("show")} ${styles.yellow("user_table")} ${styles.green("sort by")} ${styles.yellow("created_at")} ${styles.green("desc")}

  ${styles.gray("// Limiting results")}
  > ${styles.green("fetch")} ${styles.yellow("logs")} ${styles.green("limit")} ${styles.yellow("10")}

${styles.bold("5. Shortcuts (Top, Latest, Oldest)")}
Quick prefixes for common tasks.

  ${styles.gray("// Quick Top-N")}
  > ${styles.green("top")} ${styles.yellow("10")} ${styles.yellow("customers")}
  
  ${styles.gray("// Quick latest/oldest")}
  > ${styles.green("latest")} ${styles.yellow("orders")}       ${styles.dim("(Implies: sort by created_at desc)")}
  > ${styles.green("oldest")} ${styles.yellow("users")}        ${styles.dim("(Implies: sort by created_at asc)")}

=========================================================
`);
}
