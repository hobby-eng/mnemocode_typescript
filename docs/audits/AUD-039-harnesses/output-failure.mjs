/** Observe a real failed stdout write; no stream or runtime method is replaced. Linux only. */
import { openSync, closeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const sink = openSync("/dev/full", "w");
let result;
try {
  result = spawnSync(process.execPath, [
    "dist/mnemocode.js", "encode", "--mode", "direct", "--format", "unicode", "--mnemonic-file", "-",
  ], {
    input: "abandon ".repeat(11) + "about\n",
    stdio: ["pipe", sink, "pipe"],
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 15000,
    maxBuffer: 65536,
  });
} finally {
  closeSync(sink);
}
if (result.error !== undefined) throw result.error;
console.log(JSON.stringify({ status: result.status, signal: result.signal, stderr: result.stderr }));
assert.notEqual(result.status, null);
assert.notEqual(result.status, 0, "A failed stdout write must not report successful output.");
