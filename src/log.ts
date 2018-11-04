export const PASS = ['32']; // green
export const FAIL = ['31', '1']; // red, bold
export const STATUS = ['37']; // gray
export const WARN = ['95']; // magenta
export const BOLD = ['1']; // bold

export function logStyle(ansiEscapeCodes: string[], text: string) {
  console.log(`\x1b[${ansiEscapeCodes.join(';')}m${text}\x1b[0m`);
}
