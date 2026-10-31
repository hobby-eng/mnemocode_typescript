// What the command line writes for the Rust port to replay (increment 8 of its
// docs/design/architect/PLAN.md, CORE-33): each command with public inputs, run as a script runs
// it, standard output and standard error going to pipes, with both as written and its exit status.
// The Rust port's crates/mnemocode-cli/tests/ts_transcripts.rs runs the same commands.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "transcripts-v1.json";

const TWELVE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const MASKED = "wool abuse actual wool abuse actual wool abuse actual wool abuse congress";
const TEN = TWELVE.split(" ").slice(0, 10).join(" ");

/** The files every command finds in its folder. */
const FILES = {
  "phrase.txt": TWELVE,
  "masked.txt": MASKED,
  "date.txt": "23-09-2026",
  "wrong-date.txt": "24-09-2026",
  "pattern.txt": "2?-09-2026",
  "forgotten.txt": `${TEN} ? about`,
  "two-forgotten.txt": `${TEN} ab* ab*`,
  "missing.txt": `${TEN} about`,
  "no-words.txt": "nothing that reads",
  "numbers.txt": "2027 10 24 2027 10 24 2027 10 24 2027 10 377",
  "numbers-marked.txt": "2027 10 2? 2027 10 24 2027 10 24 2027 10 377",
  "record.txt": `MNC1:seedshift:english:${MASKED}`,
  "direct-record.txt": `MNC1:direct:english:${TWELVE}`,
  "legacy-valid.txt":
    "MNC1:seedshift-legacy-valid:english:mosquito dust hotel maximum rich kitten hair mother salute dream flush actress",
  "passphrase.txt": "TREZOR\n",
  "share.txt": "ur:sskr/gogrrsbyadaefmnlbnctaaecvoqdfnjpbzecstfgaxtifpsskbfw",
  "shares.txt":
    "ur:sskr/gocewfaeadaevyhsytosutcxutkslackjsheeonewytomobatslg\nur:sskr/gocewfaeadadmumepfuogalggapeaojnhtjshsjpdeonaolufpes\n",
  "one-of-two.txt": "ur:sskr/gocewfaeadaevyhsytosutcxutkslackjsheeonewytomobatslg\n",
  "masked-shares.txt":
    "1592 418 431 227 1643 1963 1925 921 125 1957 1194 635 1455 1037 1201 773 1436 1004 1595 85 129\n503 1051 430 1725 1177 62 825 1662 1883 174 1685 519 1828 811 765 570 808 374 236 1118 1537\n",
  "marked-shares.txt":
    "1289 1955 1971 ? 1916 1373 1409 443 364 1511 219 537 945 1539 1030 1247 609 1655 1661 543 1665\n1867 166 26 1886 920 572 1724 100 1966 612 795 29 1422 661 1840 1553 1660 1876 1908 1623 1409\n",
};

/** The commands, each as a script gives it. */
const COMMANDS = [
  ["encode", "--mnemonic-file", "phrase.txt"],
  ["encode", "--mnemonic-file", "phrase.txt", "--dates-file", "date.txt"],
  ["encode", "--mnemonic-file", "phrase.txt", "--dates-file", "date.txt", "--format", "indexes"],
  ["encode", "--mnemonic-file", "no-words.txt"],
  ["decode", "--input-file", "masked.txt", "--dates-file", "date.txt", "--mode", "seedshift"],
  ["decode", "--input-file", "masked.txt", "--dates-file", "wrong-date.txt", "--mode", "seedshift"],
  ["decode", "--input-file", "masked.txt", "--mode", "direct"],
  ["decode", "--input-file", "masked.txt", "--mode", "direct", "--format", "indexes"],
  ["decode", "--input-file", "numbers.txt", "--dates-file", "date.txt", "--mode", "seedshift"],
  ["decode", "--input-file", "record.txt", "--dates-file", "date.txt"],
  ["decode", "--input-file", "record.txt", "--dates-file", "date.txt", "--mode", "direct"],
  ["decode", "--input-file", "record.txt", "--dates-file", "date.txt", "--format", "indexes"],
  ["decode", "--input-file", "direct-record.txt"],
  ["decode", "--input-file", "legacy-valid.txt", "--dates-file", "date.txt"],
  ["decode", "--input-file", "share.txt"],
  ["decode", "--input-file", "numbers-marked.txt", "--mode", "seedshift"],
  ["decode", "--input-file", "no-words.txt"],
  ["decode", "--input-file", "masked.txt", "--mode", "seedshift"],
  ["decode", "--input-file", "masked.txt", "--mode", "direct", "--words", "13"],
  ["decode", "--input-file", "masked.txt", "--mode", "direct", "--list-candidates"],
  ["decode", "--input-file", "masked.txt", "--mode", "direct", "--bitcoin-address", "bc1q"],
  ["decode"],
  ["decode", "--input-file", "masked.txt", "--qr-file", "image.png"],
  [
    "recover-date",
    "--input-file",
    "masked.txt",
    "--mode",
    "seedshift",
    "--dates-file",
    "pattern.txt",
  ],
  [
    "recover-date",
    "--input-file",
    "masked.txt",
    "--mode",
    "seedshift",
    "--dates-file",
    "pattern.txt",
    "--master-fingerprint",
    "73c5da0a",
  ],
  [
    "recover-date",
    "--input-file",
    "masked.txt",
    "--mode",
    "seedshift",
    "--dates-file",
    "pattern.txt",
    "--master-fingerprint",
    "00000000",
  ],
  [
    "recover-date",
    "--input-file",
    "masked.txt",
    "--mode",
    "seedshift-legacy",
    "--dates-file",
    "pattern.txt",
    "--progress-every",
    "2",
  ],
  [
    "recover-date",
    "--input-file",
    "masked.txt",
    "--mode",
    "seedshift-legacy",
    "--dates-file",
    "pattern.txt",
    "--max-results",
    "1",
  ],
  ["recover-date", "--input-file", "masked.txt", "--mode", "seedshift", "--dates-file", "date.txt"],
  ["recover-date", "--input-file", "masked.txt", "--mode", "direct", "--dates-file", "pattern.txt"],
  ["recover-date", "--input-file", "masked.txt", "--mode", "seedshift"],
  [
    "recover-date",
    "--input-file",
    "record.txt",
    "--master-fingerprint",
    "73c5da0a",
    "--dates-file",
    "pattern.txt",
  ],
  ["recover-word", "--mnemonic-file", "forgotten.txt"],
  ["recover-word", "--mnemonic-file", "forgotten.txt", "--master-fingerprint", "73c5da0a"],
  ["recover-word", "--mnemonic-file", "forgotten.txt", "--master-fingerprint", "00000000"],
  [
    "recover-word",
    "--mnemonic-file",
    "forgotten.txt",
    "--master-fingerprint",
    "73c5da0a",
    "--bip39-passphrase-file",
    "passphrase.txt",
  ],
  ["recover-word", "--mnemonic-file", "two-forgotten.txt"],
  ["recover-word", "--mnemonic-file", "two-forgotten.txt", "--master-fingerprint", "73c5da0a"],
  ["recover-word", "--mnemonic-file", "missing.txt", "--missing-word"],
  [
    "recover-word",
    "--mnemonic-file",
    "missing.txt",
    "--missing-word",
    "--master-fingerprint",
    "73c5da0a",
  ],
  ["recover-word", "--mnemonic-file", "masked.txt", "--legacy-valid-last-word"],
  ["recover-word", "--mnemonic-file", "masked.txt", "--legacy-valid-last-word", "--missing-word"],
  ["recover-word", "--mnemonic-file", "phrase.txt"],
  ["recover-word", "--mnemonic-file", "numbers-marked.txt"],
  ["recover-word", "--mnemonic-file", "forgotten.txt", "--network", "testnet"],
  ["recover-word", "--mnemonic-file", "forgotten.txt", "--scan-gap", "5"],
  ["recover-word", "--mnemonic-file", "forgotten.txt", "--coin", "ethereum"],
  [
    "recover-word",
    "--mnemonic-file",
    "forgotten.txt",
    "--master-fingerprint",
    "73c5da0a",
    "--account",
    "1",
  ],
  [
    "recover-word",
    "--mnemonic-file",
    "forgotten.txt",
    "--master-fingerprint",
    "73c5da0a",
    "--bitcoin-address",
    "bc1q",
  ],
  [
    "recover-word",
    "--mnemonic-file",
    "forgotten.txt",
    "--bitcoin-address",
    "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  ],
  ["sskr-combine", "--share-file", "shares.txt"],
  ["sskr-combine", "--share-file", "shares.txt", "--master-fingerprint", "73c5da0a"],
  ["sskr-combine", "--share-file", "shares.txt", "--master-fingerprint", "00000000"],
  ["sskr-combine", "--share-file", "masked-shares.txt", "--mode", "seedshift"],
  [
    "sskr-combine",
    "--share-file",
    "masked-shares.txt",
    "--mode",
    "seedshift",
    "--dates-file",
    "date.txt",
  ],
  [
    "sskr-combine",
    "--share-file",
    "masked-shares.txt",
    "--mode",
    "seedshift",
    "--dates-file",
    "pattern.txt",
    "--master-fingerprint",
    "73c5da0a",
  ],
  ["sskr-combine", "--share-file", "marked-shares.txt"],
  ["sskr-combine", "--share-file", "marked-shares.txt", "--master-fingerprint", "73c5da0a"],
  ["sskr-combine", "--share-file", "one-of-two.txt"],
  ["sskr-combine", "--share-file", "no-words.txt"],
  ["sskr-combine"],
  ["sskr-export", "--share-file", "shares.txt"],
  ["sskr-export", "--share-file", "shares.txt", "--format", "indexes"],
  ["sskr-export", "--share-file", "marked-shares.txt"],
  ["sskr-export", "--share-file", "marked-shares.txt", "--master-fingerprint", "73c5da0a"],
  ["sskr-export", "--share-file", "one-of-two.txt"],
  ["sskr-export", "--share-file", "no-words.txt"],
  ["sskr-split", "--mnemonic-file", "phrase.txt", "--threshold", "1", "--shares", "3"],
  ["sskr-split", "--mnemonic-file", "phrase.txt", "--threshold", "4", "--shares", "3"],
  ["sskr-split", "--mnemonic-file", "no-words.txt", "--threshold", "2", "--shares", "3"],
  ["sskr-split", "--threshold", "2", "--shares", "3"],
  ["encode", "--mnemonic-file", "phrase.txt", "--sskr", "--threshold", "4", "--shares", "3"],
  [
    "re-encode",
    "--input-file",
    "masked.txt",
    "--old-dates-file",
    "date.txt",
    "--old-mode",
    "seedshift",
    "--recognised",
    "--mode",
    "direct",
    "--format",
    "indexes",
  ],
  [
    "re-encode",
    "--input-file",
    "masked.txt",
    "--old-dates-file",
    "date.txt",
    "--old-mode",
    "seedshift",
    "--master-fingerprint",
    "73c5da0a",
    "--dates-file",
    "wrong-date.txt",
    "--mode",
    "seedshift",
  ],
  [
    "re-encode",
    "--input-file",
    "masked.txt",
    "--old-dates-file",
    "date.txt",
    "--old-mode",
    "seedshift",
    "--master-fingerprint",
    "00000000",
    "--mode",
    "direct",
  ],
  [
    "re-encode",
    "--input-file",
    "masked.txt",
    "--old-dates-file",
    "date.txt",
    "--old-mode",
    "seedshift",
  ],
  ["re-encode"],
  ["table", "--word", "abandon"],
  ["table", "--index", "2048"],
  ["table", "--unicode", "5BF6"],
  ["table", "--word", "nothing"],
  ["table", "--index", "2049"],
  ["table", "--all"],
  ["table", "--recovery-guide"],
  ["table"],
  ...[
    "encode",
    "decode",
    "re-encode",
    "recover-date",
    "recover-word",
    "sskr-combine",
    "sskr-export",
    "sskr-split",
    "table",
    "self-test",
    "formats",
  ].flatMap((name) =>
    [
      ["help", name],
      [name, "--help"],
      [name, "-h"],
    ].slice(0, name === "formats" ? 1 : 3),
  ),
];

/** Records every command. */
export function record(ts) {
  const folder = mkdtempSync(join(tmpdir(), "mnemocode-transcripts-"));
  try {
    for (const [name, text] of Object.entries(FILES)) writeFileSync(join(folder, name), text);
    const program = join(ts.root, "dist", "mnemocode.js");
    const commands = COMMANDS.map((args) => {
      const { status, stdout, stderr } = spawnSync(process.execPath, [program, ...args], {
        cwd: folder,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { args, status, stdout, stderr };
    });
    return { files: FILES, commands };
  } finally {
    rmSync(folder, { recursive: true });
  }
}
