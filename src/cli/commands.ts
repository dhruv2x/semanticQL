export function isExitCommand(input: string) {
  return ["exit", "quit", "\\q"].includes(input.trim().toLowerCase());
}

export function isHelpCommand(input: string) {
  return input.trim().toLowerCase() === "help";
}

export function printHelp() {
  console.log(`
Available commands:

  help        Show help
  exit        Exit CLI
  \\q          Exit CLI
`);
}
