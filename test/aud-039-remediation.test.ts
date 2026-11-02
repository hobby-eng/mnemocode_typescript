import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defined } from "../src/core/defined.js";
import { MissingCodes } from "../src/core/missing-codes.js";
import { COLOR_FORM, ownUnitCount, type MixedForm } from "../src/sskr/mixed-layout.js";
import { SEED_BYTES } from "../src/sskr/share-platform.js";
import { nodeSharePlatform } from "../src/sskr/share-platform-node.js";
import { ShareInput } from "../src/sskr/share-input.js";
import { readShare, shareToColors, writeShare } from "../src/sskr/transport.js";
import { SHARE_FORMATS } from "../src/sskr/share-units.js";
import { BUILT_CLI } from "./helpers/built-cli.js";

// Public test data only: secrets of zeros and of ones, split with a seed of sevens, so that both
// sets carry the same identifier and a share of one can stand among the other's.
const ZEROS = new Uint8Array(16);
const ONES = new Uint8Array(16).fill(1);
const SEED = new Uint8Array(SEED_BYTES).fill(7);

/** What a restore of `texts`, in this order, says. */
async function restored(texts: readonly string[]) {
  using input = new ShareInput({ decodeEntry: "Decode" });
  input.add(texts);
  const { outcome } = await input.restoreComplete(nodeSharePlatform);
  return outcome;
}

describe("a share left out names the wrong share only with a digest (AUD-039-FUN001)", () => {
  it("names no share where two unchecked shares agree and a third differs", async () => {
    const zeros = await nodeSharePlatform.createShares(ZEROS, 1, 3, SEED.slice());
    const ones = await nodeSharePlatform.createShares(ONES, 1, 3, SEED.slice());
    const shares = [defined(zeros[0]), defined(zeros[1]), defined(ones[2])];
    for (const order of [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]) {
      const outcome = await restored(order.map((at) => defined(shares[defined(at)])));
      // Each share restores its own secret alone: the two that agree prove nothing of the third.
      expect(outcome).toMatchObject({ kind: "trouble", trouble: { kind: "refused" } });
    }
  });

  it("still names the share that the digest of the others refutes", async () => {
    const zeros = await nodeSharePlatform.createShares(ZEROS, 2, 3, SEED.slice());
    const ones = await nodeSharePlatform.createShares(ONES, 2, 3, SEED.slice());
    const outcome = await restored([defined(zeros[0]), defined(zeros[1]), defined(ones[2])]);
    expect(outcome).toMatchObject({
      kind: "trouble",
      trouble: { kind: "odd", code: "share-does-not-fit", place: 3 },
    });
  });
});

describe("the check of marked codes answers true or false (AUD-039-API001)", () => {
  it("refuses an answer of another type and counts true and false", async () => {
    using codes = MissingCodes.read(`${"abandon ".repeat(11)}about|abandon`, "english", "direct");
    for (const answer of [{ matched: false }, "false", 1, undefined]) {
      await expect(
        // An answer that no type allows, given on purpose as a JavaScript host could.
        codes.run({ check: async () => answer as unknown as boolean }),
      ).rejects.toMatchObject({ code: "core.missing-codes.check-answers-true-or-false" });
    }
    // An answer that comes after a stop is not counted, whatever it is: the run ends as stopped.
    const stop = new AbortController();
    const late = await codes.run({
      signal: stop.signal,
      check: () => {
        stop.abort();
        // An answer that no type allows, given on purpose as a JavaScript host could.
        return "false" as unknown as boolean;
      },
    });
    expect([late.stopped, late.count]).toEqual([true, 0]);
    const passing = await codes.run({ check: () => true });
    const failing = await codes.run({ check: () => false });
    // Of about and abandon at the last place, only about passes the checksum: one candidate.
    expect([passing.count, passing.passed, failing.count, failing.passed]).toEqual([1, 1, 1, 0]);
    for (const backup of passing.found) backup.wipe();
  });
});

describe("a result that standard output does not take (AUD-039-API003)", () => {
  /** The built CLI's `table` with standard output on `stdout`. */
  const table = (stdout: number | "pipe") =>
    spawnSync(process.execPath, [BUILT_CLI, "table", "--all"], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", stdout, "pipe"],
    });

  it.runIf(process.platform === "linux")("ends the command with 1 and its reason", () => {
    const full = openSync("/dev/full", "w");
    try {
      const run = table(full);
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("The result could not be written to standard output");
    } finally {
      closeSync(full);
    }
  });

  it("ends as done where the reader closed standard output first, as `| head` does", async () => {
    const child = spawn(process.execPath, [BUILT_CLI, "table", "--all"], {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    // The reader is gone before the first write, which meets EPIPE.
    child.stdout.destroy();
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (text: string) => (stderr += text));
    const status = await new Promise((resolve) => child.on("close", resolve));
    expect([status, stderr]).toEqual([0, ""]);
  });

  it("leaves a run whose output is read as it was", () => {
    const run = table("pipe");
    expect(run.status).toBe(0);
    expect(run.stdout.split("\n").length).toBeGreaterThan(2048);
    expect(run.stderr).toBe("");
  });
});

describe("a mixed share's working copies are wiped (AUD-039-SEC001)", () => {
  it("wipes the bytes it packed to read a share's length", async () => {
    const [share] = await nodeSharePlatform.createShares(ZEROS, 2, 3, SEED.slice());
    const units = shareToColors(defined(share)).map((color) => Number.parseInt(color.slice(1), 16));
    const packed: (readonly number[])[] = [];
    const watched: MixedForm = {
      ...COLOR_FORM,
      pack: (values) => {
        const result = COLOR_FORM.pack(values);
        packed.push(result.bytes);
        return result;
      },
    };
    expect(ownUnitCount(watched, units)).toBe(units.length);
    expect(packed.flat().every((byte) => byte === 0)).toBe(true);
    // The caller's units are left as they were.
    expect(units.some((unit) => unit !== 0)).toBe(true);
  });

  it("writes and reads every form of a share as before", async () => {
    const [share] = await nodeSharePlatform.createShares(ZEROS, 2, 3, SEED.slice());
    for (const format of SHARE_FORMATS)
      expect(readShare(writeShare(defined(share), format)).ur).toBe(defined(share));
  });
});
