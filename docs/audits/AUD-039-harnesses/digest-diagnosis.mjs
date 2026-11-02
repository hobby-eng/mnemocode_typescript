/** Real native restoration of synthetic digestless A,A,B shares, with a checked 2-of-3 control. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ShareInput } from "../../../dist/sskr/share-input.js";
import { ShareSet } from "../../../dist/sskr/share-set.js";
import { transportToUr, urToTransport } from "../../../dist/sskr/transport.js";
import { nodeSharePlatform } from "../../../dist/sskr/share-platform-node.js";

/** IEEE CRC-32 from the transport specification; independent of the production checksum helper. */
function framed(body) {
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const result = new Uint8Array(body.length + 4);
  result.set(body);
  new DataView(result.buffer).setUint32(body.length, (crc ^ 0xffffffff) >>> 0);
  return result;
}

/** 21-byte SSKR payload: identifier, threshold-one metadata, member number, 16 public bytes. */
function digestless(member, value) {
  const body = new Uint8Array(22);
  body.set([0x55, 0x12, 0x34, 0, 0, member, value]);
  const transport = framed(body);
  try {
    return transportToUr(transport);
  } finally {
    body.fill(0);
    transport.fill(0);
  }
}

const records = [digestless(0, 0), digestless(1, 0), digestless(2, 1)];
const subset = await ShareSet.restore(records.slice(0, 2), nodeSharePlatform);
try {
  assert.equal(subset.digestChecked, false);
} finally {
  subset.wipe();
}
let diagnosed = 0;
for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  const input = new ShareInput({ decodeEntry: "Decode" });
  try {
    input.add(order.map((index) => records[index]));
    const { outcome } = await input.restoreComplete(nodeSharePlatform);
    assert.equal(outcome.kind, "trouble");
    const blamed = outcome.trouble.kind === "odd";
    diagnosed += Number(blamed);
    console.log(JSON.stringify({ order, kind: outcome.trouble.kind, code: outcome.trouble.code, place: outcome.trouble.place ?? null, checkedReference: false }));
  } finally {
    input.wipe();
  }
}

const vector = JSON.parse(readFileSync(new URL("../../../vectors/sskr-v1.json", import.meta.url), "utf8")).deterministic[0];
const damaged = urToTransport(vector.shares[2]);
damaged[damaged.length - 5] ^= 1;
const correctedCrc = framed(damaged.subarray(0, -4));
const checkedInput = new ShareInput({ decodeEntry: "Decode" });
try {
  checkedInput.add([vector.shares[0], vector.shares[1], transportToUr(correctedCrc)]);
  const { outcome } = await checkedInput.restoreComplete(nodeSharePlatform);
  assert.equal(outcome.kind, "trouble");
  assert.equal(outcome.trouble.kind, "odd");
  assert.equal(outcome.trouble.place, 3);
  console.log(JSON.stringify({ checkedControl: "2-of-3", blamedPlace: outcome.trouble.place }));
} finally {
  damaged.fill(0);
  correctedCrc.fill(0);
  checkedInput.wipe();
}
console.log(JSON.stringify({ unauthenticatedMinorityBlamed: diagnosed }));
process.exitCode = diagnosed === 0 ? 0 : 1;
