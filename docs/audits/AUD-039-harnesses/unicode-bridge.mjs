/** Search exact generated WASM memory after public, malformed Unicode input; no allocator patches. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../../../", import.meta.url);
const bytes = readFileSync(new URL("sskr-wasm/generated/recovery_sskr_wasm_bg.wasm", root));
const vector = JSON.parse(readFileSync(new URL("vectors/sskr-v1.json", root), "utf8")).deterministic[0];
const records = vector.shares.slice(0, 2).join("\n");
const needle = new TextEncoder().encode(vector.shares[0].slice(16, 48));
function hits(memory) {
  const found = [];
  const view = Buffer.from(memory.buffer);
  for (let start = 0; ; ) {
    const at = view.indexOf(needle, start);
    if (at < 0) return found;
    found.push(at);
    start = at + 1;
  }
}
const cases = [
  ["valid-ascii", records],
  ["invalid-ascii", records + "x"],
  ["trailing-nbsp", records + "\u00a0"],
  ["leading-nbsp", "\u00a0" + records],
  ["invalid-accent", records + "é"],
  ["long-invalid-accent", records + "é".repeat(128)],
];
let residualCases = 0;
for (const [name, input] of cases) {
  const url = new URL("sskr-wasm/generated/recovery_sskr_wasm.js", root);
  url.searchParams.set("aud039", name);
  const bridge = await import(url.href);
  const { memory } = bridge.initSync({ module: bytes });
  assert.equal(hits(memory).length, 0);
  let outcome = "returned";
  try {
    bridge.recover_sskr_shares(input).fill(0);
  } catch {
    outcome = "refused";
  }
  const offsets = hits(memory);
  residualCases += Number(offsets.length > 0);
  console.log(JSON.stringify({ name, outcome, residualCount: offsets.length, offsets, memoryBytes: memory.buffer.byteLength }));
}
console.log(JSON.stringify({ wasmSha256: createHash("sha256").update(bytes).digest("hex"), needleSha256: createHash("sha256").update(needle).digest("hex"), residualCases }));
needle.fill(0);
process.exitCode = residualCases ? 1 : 0;
