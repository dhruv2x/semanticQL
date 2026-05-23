/**
 * SemanticQL CLI — Output module
 *
 * Responsible for rendering query results in the terminal.
 *
 * Responsibilities:
 * - Table formatting
 * - Cell truncation
 * - Width calculations
 * - JSON/object formatting
 * - Welcome banner rendering
 */

import { styles } from "../utils/styles";

/**
 * Maximum width allowed for a single table cell before truncation.
 */
const MAX_CELL_WIDTH = 30;

/**
 * Convert unknown database values into printable strings.
 *
 * Handles:
 * - null / undefined
 * - JSON / JSONB objects
 * - primitive values
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // PostgreSQL JSON/JSONB values arrive as JS objects
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Truncate long strings to preserve table layout.
 *
 * Example:
 *   "abcdefghijklmnopqrstuvwxyz"
 * becomes:
 *   "abcdefghijklmnopqrstuvw..."
 */
function truncate(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }

  return value.slice(0, maxWidth - 3) + "...";
}

/**
 * Pad string with spaces for aligned table rendering.
 * (Basically Padding adds spaces: for better alignment of columns)
 */
function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}

/**
 * Render database rows in terminal-friendly table format.
 *
 * Rendering modes:
 *
 * 1. Expanded mode
 *    Triggered when:
 *    - exactly 1 row
 *    - exactly 1 column
 *
 *    Useful for:
 *    - JSONB
 *    - XML
 *    - HTML
 *    - long text blobs
 *
 * 2. Table mode
 *    Default grid-style rendering with truncation.
 */
export function printRows(rows: any[]) {
  if (!rows.length) {
    console.log("No rows found");
    return;
  }

  const headers = Object.keys(rows[0]);

  /**
   * Expanded mode:
   * Print full content for single-cell results.
   *
   * Example:
   *   show arch_db from ir_ui_view ...
   */
  if (rows.length === 1 && headers.length === 1) {
    const value = rows[0][headers[0]];

    // Pretty-print JSON objects
    if (typeof value === "object" && value !== null) {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(String(value));
    }

    console.log(`\n1 row(s)\n`);
    return;
  }

  /**
   * Calculate width for each column.
   *
   * Width is based on:
   * - header width
   * - widest truncated cell content
   */
  const columnWidths = headers.map((header) => {
    const maxContentWidth = Math.max(
      header.length,

      ...rows.map((row) =>
        truncate(
          formatValue(row[header]),
          MAX_CELL_WIDTH
        ).length
      )
    );

    return Math.min(maxContentWidth, MAX_CELL_WIDTH);
  });

  /**
   * Table separator line.
   *
   * Example:
   * -----+--------+------
   */
  const separator = columnWidths
    .map((width) => "-".repeat(width + 2))
    .join("+");

  /**
   * Render a single table row.
   */
  const formatRow = (values: string[]) => {
    return values
      .map((value, index) =>
        ` ${pad(
          truncate(value, MAX_CELL_WIDTH),
          columnWidths[index]
        )} `
      )
      .join("|");
  };

  // Print table headers
  console.log(formatRow(headers));

  // Print separator line
  console.log(separator);

  // Print row values
  for (const row of rows) {
    const values = headers.map((header) =>
      formatValue(row[header])
    );

    console.log(formatRow(values));
  }

  // Print final row count
  console.log(`\n${rows.length} row(s)\n`);
}

/**
 * Render SemanticQL startup banner and DB connection info.
 */
export function printWelcome(database: string): void {
  console.log(
    styles.bgBlue(
      styles.white(
        styles.bold(
          "  SemanticQL — Deterministic Query Engine  "
        )
      )
    )
  );

  console.log();

  console.log(
    `${styles.gray("Connected to DB:")} ${styles.bold(
      styles.green(database)
    )}`
  );

  console.log(
    styles.gray(
      'Type "exit" or "quit" to close the REPL.'
    )
  );

  console.log();
}
