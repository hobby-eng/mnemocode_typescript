// How recover-date and recover-word say that the wallet matched a candidate at m: on a terminal a
// person reads that the master fingerprint matched, or that m, where a master key matched, is the
// BIP32 root key; a file, a pipe and TERM=dumb keep the path, which a script reads (owner's request
// after 0.1.0). Public test data only: the "abandon … about" phrase, its fingerprint, its root key
// and its form masked with a public date.

import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseArguments } from "../src/cli/arguments.js";
import { runRecoverDate } from "../src/cli/recover-date-command.js";
import { runRecoverWord } from "../src/cli/recover-word-command.js";
import { streamsAsTerminal } from "./helpers/terminal-streams.js";
import {
  DATE,
  LAST_WORD_FORGOTTEN,
  MASKED,
  TEST_FINGERPRINT,
  TEST_PHRASE,
} from "./helpers/test-phrase.js";

/** The BIP32 root key of the test phrase as an xpub, written by @scure/bip32. */
const ROOT_XPUB = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_PHRASE)).publicExtendedKey;

/** Each wallet given at m: its options, and what a terminal says of the candidate it matched. */
const AT_THE_ROOT = [
  [
    "the master fingerprint",
    ["--master-fingerprint", TEST_FINGERPRINT],
    "master fingerprint matched",
  ],
  ["the master key", ["--master-xpub", ROOT_XPUB], "matched at m, the BIP32 root key"],
] as const;

/** The lines of standard output, as console.log writes them. */
let out: string[] = [];

beforeEach(() => {
  out = [];
  vi.stubEnv("NO_COLOR", "1");
  vi.spyOn(console, "log").mockImplementation((...line: unknown[]) => {
    out.push(line.join(" "));
  });
  // The notes and the progress on standard error are not what these tests read.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Runs recover-date, then recover-word, for the test phrase with the `wallet` options. */
async function recoverBoth(wallet: readonly string[]): Promise<void> {
  await runRecoverDate(
    parseArguments(["--mode", "seedshift", "--input", MASKED, "--dates", "2?-09-2026", ...wallet]),
  );
  await runRecoverWord(parseArguments(["--mnemonic", LAST_WORD_FORGOTTEN, ...wallet]));
}

describe("a match at m", () => {
  it.each(AT_THE_ROOT)("names %s on a terminal", async (_, wallet, said) => {
    streamsAsTerminal();
    await recoverBoth(wallet);
    const facts = out
      .filter((line) => line.startsWith("  Wallet "))
      .map((line) => line.slice("  Wallet".length).trim());
    // The date's one match, then the one of recover-word's 128 candidates that is the test phrase.
    expect(facts.filter((fact) => fact !== "not matched")).toEqual([said, said]);
    expect(facts).toHaveLength(1 + 128);
  });

  it.each(AT_THE_ROOT)("keeps the path for a script with %s", async (_, wallet) => {
    await recoverBoth(wallet);
    expect(out).toContain(`${DATE}\t${TEST_PHRASE}\tmatched at m`);
    expect(out).toContain(`1\tabout\t4\t0011\tmatched at m\t${TEST_PHRASE}`);
  });
});
