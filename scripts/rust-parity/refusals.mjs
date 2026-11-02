// The known answers of refusal codes for the Rust port (ADR 0004 of its docs/design/architect):
// every code of every error catalog of this program, read from its sources, which Prettier writes
// one code to a line. The Rust port's `cargo xtask code-rules` finds each code it writes in this
// list or in its own.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The order of `Array.prototype.sort` without a comparison: by UTF-16 code units. */
const inOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "refusals-v1.json";
/** Where a catalog begins, with its namespace. */
const CATALOG = /new ErrorCatalog\(\s*"([^"]+)",\s*\{\n/gu;
/** A code at the first level of a catalog. */
const CODE = /^ {2}"?([a-z0-9-]+)"?:/u;

/** The codes of the catalog whose body starts at the beginning of `body`. */
function codesOf(namespace, body) {
  const codes = [];
  for (const line of body.split("\n")) {
    if (line.startsWith("}")) break;
    const found = CODE.exec(line);
    if (found !== null) codes.push(`${namespace}.${found[1]}`);
  }
  return codes;
}

/** The whole record. */
export async function record(ts) {
  const folder = join(ts.root, "src");
  const names = readdirSync(folder, { recursive: true }).filter((name) => name.endsWith(".ts"));
  const codes = new Set();
  let catalogs = 0;
  for (const name of names.sort(inOrder)) {
    const text = readFileSync(join(folder, name), "utf8");
    for (const match of text.matchAll(CATALOG)) {
      catalogs += 1;
      const body = text.slice(match.index + match[0].length);
      for (const code of codesOf(match[1], body)) codes.add(code);
    }
  }
  return { catalogs, codes: [...codes].sort(inOrder) };
}
