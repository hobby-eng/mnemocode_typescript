import { describe, expect, it } from "vitest";
import { parseListPassphrase, parseRecipient } from "../src/core/candidate-encryption.js";
import { isDatePattern, parseDate, parseDatePattern } from "../src/core/dates.js";
import { WordTable } from "../src/core/word-table.js";
import { BackupReading } from "../src/core/backup-reading.js";
import { parseRecord, serializeRecord } from "../src/record.js";
import { ShareInput } from "../src/sskr/share-input.js";
import { readShare } from "../src/sskr/transport.js";
import { TEST_PHRASE } from "./helpers/test-phrase.js";
import { sskrVectors } from "./helpers/vectors.js";

// One rule removes what a person typed or pasted around a value read whole: Unicode's White_Space
// at either end (trimWhiteSpace), as Rust's str::trim takes it; words, codes and dates read as a
// list are still split at JavaScript's white space. String.prototype.trim differs in two
// characters: it keeps NEL (U+0085), which is white space, and removes a byte order mark (U+FEFF),
// which is not (owner, 2026-10-27).
const NEL = "\u0085";
const BYTE_ORDER_MARK = "\uFEFF";
/** The public recipient of vectors/candidates-v1.json. */
const RECIPIENT = "age1fdc6vcx5w70ah6qtmyctutym56y4fhw82dhvjxyjqyqxea2g34hsvnn808";

describe("one rule trims every value read whole", () => {
  it("removes NEL around a date, a date pattern, a record, a table word, a list passphrase and a recipient", () => {
    expect(parseDate(`${NEL}23-09-2026${NEL}`)).toEqual(parseDate("23-09-2026"));
    expect(isDatePattern(`${NEL}??-09-2026${NEL}`)).toBe(true);
    expect(parseDatePattern(`${NEL}??-09-2026${NEL}`)).toEqual(parseDatePattern("??-09-2026"));
    const record = serializeRecord("direct", "english", TEST_PHRASE);
    expect(serializeRecord("direct", "english", `${NEL}${TEST_PHRASE}${NEL}`)).toBe(record);
    expect(parseRecord(`${NEL}${record}${NEL}`)).toEqual(parseRecord(record));
    expect(WordTable.lookup("word", `${NEL}abandon${NEL}`)).toEqual(
      WordTable.lookup("word", "abandon"),
    );
    expect(parseListPassphrase(`${NEL}correct horse battery staple${NEL}`)).toBe(
      "correct horse battery staple",
    );
    expect(parseRecipient(`${NEL}${RECIPIENT}${NEL}`)).toBe(RECIPIENT);
  });

  it("keeps a byte order mark, which is no white space, as part of the value", () => {
    expect(() => parseDate(`${BYTE_ORDER_MARK}23-09-2026`)).toThrow(
      "Use DD-MM-YYYY with a four-digit year, for example 23-09-2026.",
    );
    expect(() => parseDatePattern(`??-09-2026${BYTE_ORDER_MARK}`)).toThrow(
      "Use DD-MM-YYYY with ? for each forgotten digit",
    );
    expect(() => parseRecipient(`${RECIPIENT}${BYTE_ORDER_MARK}`)).toThrow(
      "The key must be one age key of 62 characters",
    );
    expect(parseListPassphrase(`correct horse battery staple${BYTE_ORDER_MARK}`)).toBe(
      `correct horse battery staple${BYTE_ORDER_MARK}`,
    );
  });

  it("reads a key or a share from a file that an editor began with a byte order mark", () => {
    expect(parseRecipient(`${BYTE_ORDER_MARK}${RECIPIENT}\n`)).toBe(RECIPIENT);
    const share = sskrVectors().official.shares[0]!;
    for (const text of [`${BYTE_ORDER_MARK}${share}\n`, `${NEL}${share}${NEL}`]) {
      expect(readShare(text).ur).toBe(share);
      expect(ShareInput.partsOfText(text)).toEqual([share]);
      expect(BackupReading.shareKind(text)).toBe("share");
    }
  });
});
