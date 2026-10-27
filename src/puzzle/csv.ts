/** Minimal CSV reader for custom fact tables: one record per line, double quotes for commas, "" for a quote. */
export function parseCsv(input: string): string[][] {
  return input.trim().split(/\r?\n/).map(line => {
    const cells: string[] = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(value); value = ''; }
      else value += char;
    }
    cells.push(value);
    return cells;
  });
}
