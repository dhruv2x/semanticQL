/**
 * SemanticQL CLI — Output module
 * 
 * View-layer utilities for the terminal.
 * - Data tabularization
 * - String constraint calculations (truncation and padding)
 * - ANSI-colored brand headers
 */

import { styles } from "../utils/styles";

const MAX_CELL_WIDTH = 30;

function truncate(value: string, maxWidth: number) {
  if (value.length <= maxWidth) {
    return value;
  }

  return value.slice(0, maxWidth - 3) + "...";
}

function pad(value: string, width: number) {
  return value.padEnd(width, " ");
}

export function printRows(rows: any[]) {
  if (!rows.length) {
    console.log("No rows found");
    return;
  }

  const headers = Object.keys(rows[0]);

  const columnWidths = headers.map((header) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map((row) =>
        truncate(String(row[header] ?? ""), MAX_CELL_WIDTH).length
      )
    );

    return Math.min(maxContentWidth, MAX_CELL_WIDTH);
  });

  const separator = columnWidths
    .map((width) => "-".repeat(width + 2))
    .join("+");

  const formatRow = (values: string[]) => {
    return values
      .map((value, index) =>
        ` ${pad(truncate(value, MAX_CELL_WIDTH), columnWidths[index])} `
      )
      .join("|");
  };

  console.log(formatRow(headers));
  console.log(separator);

  for (const row of rows) {
    const values = headers.map((header) =>
      String(row[header] ?? "")
    );

    console.log(formatRow(values));
  }

  console.log(`\n${rows.length} row(s)\n`);
}

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
    `${styles.gray("Connected to DB:")} ${styles.bold(styles.green(database))}`
  );

  console.log(
    styles.gray(
      'Type "exit" or "quit" to close the REPL.'
    )
  );

  console.log();
}
