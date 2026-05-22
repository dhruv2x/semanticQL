const RESET = "\x1b[0m";

function wrap(code: string, text: string): string {
  return `${code}${text}${RESET}`;
}

export const styles = {
  bold: (text: string) => wrap("\x1b[1m", text),
  dim: (text: string) => wrap("\x1b[2m", text),

  green: (text: string) => wrap("\x1b[32m", text),
  red: (text: string) => wrap("\x1b[31m", text),
  yellow: (text: string) => wrap("\x1b[33m", text),
  blue: (text: string) => wrap("\x1b[34m", text),
  cyan: (text: string) => wrap("\x1b[36m", text),
  magenta: (text: string) => wrap("\x1b[35m", text),
  gray: (text: string) => wrap("\x1b[90m", text),

  bgBlue: (text: string) => wrap("\x1b[44m", text),
  white: (text: string) => wrap("\x1b[37m", text),
};
