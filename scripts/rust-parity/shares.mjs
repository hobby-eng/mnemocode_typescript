// The known answers of Shamir shares for the Rust port (increment 7 of its
// docs/design/architect/PLAN.md): the forms of a share, its reading and refusals, the facts of a
// restored set, shares as typed, their export and the keeping note, each read from this build's own
// modules, and what share-repair.mjs shares with this recorder. The inputs are the public vectors of
// vectors/sskr-v1.json, changed by a fixed sequence, so that every run records the same cases. The
// Rust port's crates/mnemocode/tests/ts_shares.rs replays them.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "shares-v1.json";

/** What the UR of a share starts with. */
const UR_PREFIX = "ur:sskr/";
/** A public seed in place of randomness: only the recorder uses it. */
const SEED = 7;
/** The other phrase of two sets with one identifier: a share of it fits but for the restore. */
const OTHER_PHRASE = `${"zoo ".repeat(11)}wrong`;

/** The next number below `limit` of a fixed sequence (a Lehmer generator), the same every run. */
export function sequence() {
  let state = 20261027;
  return (limit) => {
    state = (state * 48271) % 2147483647;
    return state % limit;
  };
}

/** The native kind of a refusal: "RangeError", "TypeError" or "Error". */
function kindOf(error) {
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof TypeError) return "TypeError";
  return "Error";
}

/** A refusal as data. */
const refusal = (error) => ({ code: error.code, message: error.message, kind: kindOf(error) });

/** What `run` gives, or its refusal. */
export async function outcome(run) {
  try {
    return await run();
  } catch (error) {
    return { refused: refusal(error) };
  }
}

/** A share as a repair gives it. */
export const sharePlain = (share) => ({
  ur: share.ur,
  format: share.format,
  repaired: share.repaired,
  filled: share.filled.map(({ position, value }) => ({ position, value })),
});

/** A restored set as data. */
export const setPlain = (set) => ({
  mnemonic: set.mnemonic,
  shares: set.shares.map(sharePlain),
  unsettled: set.unsettled.map(({ share, position }) => ({ share, position })),
  unchecked: [...(set.unchecked ?? [])],
  digestUnchecked: set.digestUnchecked === true,
});

/** The units of `share` written in `format`: a color's two codes apart, or `whole` as one. */
export function unitsOf(transport, share, format, whole = false) {
  const text = transport.writeShare(share, format);
  if (format === "ur") return text.slice(UR_PREFIX.length).match(/../gu);
  if (format === "colors-unicode") return text.match(whole ? /.{8}/gu : /.{4}/gu);
  return text.split(" ");
}

/** `units` as `format` joins them. */
export function joined(units, format) {
  if (format === "ur") return `${UR_PREFIX}${units.join("")}`;
  return format === "colors-unicode" ? units.join("") : units.join(" ");
}

/** `share` in `format` with the units at `places` marked with ?. */
export function marked(transport, share, format, places, whole = false) {
  const units = unitsOf(transport, share, format, whole);
  for (const place of places) units[place] = "?";
  return joined(units, format);
}

/** `share` in `format`, each unit at `places` with a ? at each of `digits`. */
export function markedDigits(transport, share, format, places, digits) {
  const units = unitsOf(transport, share, format);
  for (const place of places) {
    const unit = units[place];
    const prefix = unit.startsWith("#") ? "#" : "";
    const symbols = Array.from(unit.slice(prefix.length));
    for (const digit of digits) symbols[digit] = "?";
    units[place] = prefix + symbols.join("");
  }
  return units.join(" ");
}

/** Color Unicode codes as their symbols, ? kept. */
export function symbolsOf(codes) {
  return codes.map((code) => (code === "?" ? "?" : String.fromCodePoint(parseInt(code, 16))));
}

/** `count` places below `limit`, each once, in order. */
export function places(next, limit, count) {
  const chosen = new Set();
  while (chosen.size < Math.min(count, limit)) chosen.add(next(limit));
  return [...chosen].sort((a, b) => a - b);
}

/** Texts that a change of one character, an element or the case makes of `text`. */
function damaged(next, text) {
  const at = next(text.length);
  const elements = text.split(" ");
  const gone = next(elements.length);
  return [
    `${text.slice(0, at)}${"0a?z#-".charAt(next(6))}${text.slice(at + 1)}`,
    `${text.slice(0, at)}${text.slice(at + 1)}`,
    elements.filter((_, place) => place !== gone).join(" "),
    text.toLowerCase(),
    text.toUpperCase(),
    `${text} ${elements[0]}`,
  ];
}

/** `share` as a UR of another layout that a reader accepts: a tag, or a longer head. */
export function otherLayouts(modules, share) {
  const { transport, checksum, words } = modules;
  const cbor = transport.urToTransport(share).subarray(0, -checksum.CRC32_BYTES);
  // A short share's length sits in its head, which a longer head may write apart.
  const longer = cbor[0] === 0x58 ? [] : [Uint8Array.of(0x58, cbor[0] - 0x40, ...cbor.subarray(1))];
  return [
    ...longer,
    Uint8Array.of(0xd9, 0x01, 0x35, ...cbor),
    Uint8Array.of(0xd9, 0x9d, 0x75, ...cbor),
  ].map((layout) => {
    const bytes = new Uint8Array(layout.length + checksum.CRC32_BYTES);
    bytes.set(layout);
    new DataView(bytes.buffer).setUint32(layout.length, checksum.crc32(layout));
    return `${UR_PREFIX}${Array.from(bytes, (byte) => words.MINIMAL_BYTEWORDS[byte]).join("")}`;
  });
}

/** Texts of no share, and shares written otherwise than the forms write them. */
function oddTexts(modules, share) {
  return [
    ...otherLayouts(modules, share),
    "",
    "   ",
    "hello world",
    "12 34",
    "99999",
    "4096 4097",
    "#zzzzzz",
    "ZZZZ",
    "ur:",
    "ur:sskr/",
    "ur:sskr/zz",
    "ur:other/aeae",
    `UR:SSKR/${share.slice(UR_PREFIX.length).toUpperCase()}`,
    `\ufeff${share}`,
    `  ${share}\n`,
    share.replace("ur:sskr", "ur:s\u017fkr"),
    share.replace("ur:sskr", "ur:sskr".replace("s", "\u017f")),
    "a".repeat(3000),
    "1 ".repeat(1100),
    "#123456 ".repeat(400),
  ];
}

/** Every share that the recorder reads, marks and repairs: short, long, and the official. */
export function subjects(vectors) {
  return [
    vectors.deterministic[0].shares[0],
    vectors.deterministic[4].shares[1],
    vectors.official.shares[0],
  ];
}

/** The facts of every form. */
function formFacts(transport, encodedForms) {
  return transport.SHARE_FORMATS.map((format) => ({
    format,
    name: transport.SHARE_FORMAT_NAMES[format],
    mirrored: transport.MIRRORED_FORM[format],
    color: transport.isColorShareFormat(format),
    cards: transport.shareFormatHasCards(format),
    cardsRefusal: (() => {
      try {
        transport.assertShareFormatHasCards(format);
        return null;
      } catch (error) {
        return refusal(error);
      }
    })(),
  })).concat(
    encodedForms.map((form) => ({ form, mirroring: transport.shareFormatMirroring(form) })),
  );
}

/** Every vector share in every form, and the texts around it read back. */
function reads(modules, vectors, next) {
  const { transport } = modules;
  const shares = [
    ...vectors.official.shares,
    ...vectors.deterministic.flatMap((vector) => vector.shares),
  ];
  const texts = shares.flatMap((share) =>
    transport.SHARE_FORMATS.map((format) => transport.writeShare(share, format)),
  );
  const written = shares.flatMap((share) =>
    transport.SHARE_FORMATS.map((format) => ({
      ur: share,
      format,
      text: transport.writeShare(share, format),
      bytewords: format === "words" ? transport.urToBytewords(share) : undefined,
    })),
  );
  const odd = subjects(vectors).flatMap((share) => oddTexts(modules, share));
  const changed = texts.slice(0, 96).flatMap((text) => damaged(next, text));
  const read = [...odd, ...changed].map((text) => {
    try {
      const { ur, format } = transport.readShare(text);
      return { text, ur, format };
    } catch (error) {
      return { text, refused: refusal(error) };
    }
  });
  return { written, read };
}

/** The sets that are read together, right and wrong. */
async function sets(modules, vectors, platform, twins) {
  const { transport } = modules;
  const { ShareSet } = modules.set;
  const { combineSskrShares } = modules.shares;
  const { official, deterministic } = vectors;
  const inWords = (share, places) => marked(transport, share, "words", places);
  const quorums = [...official.validQuorums, ...official.invalidQuorums].map((quorum) =>
    quorum.map((place) => official.shares[place]),
  );
  const lists = [
    ...quorums,
    [],
    official.shares,
    [...official.shares, official.shares[0]],
    [official.shares[0], deterministic[0].shares[0]],
    deterministic[0].shares,
    [deterministic[0].shares[0]],
    deterministic[0].shares.slice(0, 2),
    deterministic[4].shares.slice(1),
    [deterministic[0].shares[0], deterministic[0].shares[0]],
    [twins.mine[0], twins.other[1]],
    [twins.mine[0], twins.mine[1], twins.other[2]],
    [twins.mine[0], twins.other[0]],
    ...twins.single.map((share) => [share]),
    twins.single,
    [twins.single[0], twins.otherSingle[1]],
    // Groups: one of another secret, an incomplete one, one that a digest checks only itself.
    [...twins.pairs.slice(0, 2), ...twins.otherPairs.slice(2)],
    twins.pairs.slice(0, 3),
    twins.pairs,
    twins.mixed,
    twins.mixed.slice(0, 2),
    twins.mixed.slice(1),
    [twins.mixed[0], twins.mixed[1], twins.mixed[3], twins.mixed[4]],
    [twins.singles[0], twins.otherSingles[2]],
    [twins.singles[0], twins.singles[1], twins.singles[2]],
    twins.singles,
    [...twins.triple.slice(0, 4), ...twins.otherTriple.slice(4)],
    [...twins.triple.slice(0, 2), ...twins.otherTriple.slice(2)],
    [...twins.otherTriple.slice(0, 2), ...twins.triple.slice(2, 4), ...twins.otherTriple.slice(4)],
    // Marked, restored together: settled by the search, too few, another secret, too much open.
    [inWords(twins.mine[0], [8]), twins.mine[1]],
    [inWords(twins.mine[0], [8]), inWords(twins.mine[1], [9])],
    [inWords(twins.mine[0], [8])],
    [inWords(twins.mine[0], [8]), twins.other[1]],
    [inWords(twins.mine[0], [8]), inWords(twins.other[1], [9])],
    [
      inWords(twins.mine[0], [8, 9, 10, 11, 12, 13]),
      inWords(twins.mine[1], [8, 9, 10, 11, 12, 13]),
    ],
    [inWords(twins.single[0], [8])],
    [inWords(twins.pairs[0], [8]), twins.pairs[1], twins.pairs[2]],
  ];
  const restored = [];
  for (const texts of lists) {
    const listed = texts.map((_, index) => index + 3);
    restored.push({
      texts,
      valid: await outcome(() => ({ urs: transport.validateShareSet(texts) })),
      loose: await outcome(() => ({ urs: transport.validateShareSet(texts, false) })),
      restored: await outcome(async () =>
        setFacts(await ShareSet.combine(texts, platform, listed)),
      ),
      phrase: await outcome(async () => ({ phrase: await combineSskrShares(texts) })),
    });
  }
  return restored;
}

/** A share set's facts, with the notes that name each share by a place 2 past its index. */
function setFacts(set) {
  const named = set.shares.map((_, index) => index + 3);
  return {
    ...setPlain(set.toRepairedSet()),
    digestChecked: set.digestChecked,
    checked: set.checked,
    groupThreshold: set.groupThreshold,
    groupCount: set.groupCount,
    groups: set.groups.map(({ index, threshold, members }) => ({ index, threshold, members })),
    secretBytes: set.secretBytes,
    wordCount: set.wordCount,
    note: set.uncheckedNote(named) ?? null,
    plainNote: set.uncheckedNote() ?? null,
  };
}

/** Shares as typed, each list through every reading and check of ShareInput. */
async function typed(modules, platform, transport, vectors, twins) {
  const { input: shareInput } = modules;
  const { ShareInput } = shareInput;
  const texts = (shares) => shares.join("\n");
  const [first, second, third] = vectors.deterministic[0].shares;
  const words = transport.writeShare(second, "words");
  const half = Math.floor(words.length / 2);
  const answers = [
    "",
    " ; ;\n",
    texts([first]),
    texts([first, second]),
    `${first};${second}`,
    `\ufeff${first}\r\n${second}\r\n`,
    `${first};\n${words.slice(0, half)}\n${words.slice(half)}\n`,
    `${first.slice(0, 20)}\n${first.slice(20)}`,
    texts([first, first, second]),
    texts([first, third, second]),
    texts([first, vectors.deterministic[1].shares[1]]),
    texts([first, vectors.deterministic[1].shares[1], second]),
    texts([first, second, vectors.deterministic[1].shares[0], vectors.deterministic[1].shares[1]]),
    texts([twins.mine[0], twins.other[1]]),
    texts([twins.mine[0], twins.mine[1], twins.other[2]]),
    texts([twins.mine[0], twins.other[0]]),
    texts(vectors.official.shares),
    texts(vectors.official.shares.slice(0, 3)),
    `not a share\n${second}`,
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "abandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabout",
    "1 1 1 1 1 1 1 1 1 1 1 4",
    "768476847684768476847684768476847684768476845728",
    `${marked(transport, first, "indexes", [3])}\n${second}`,
    `${"? ".repeat(65)}1\n${second}`,
    `${marked(transport, first, "unicode", [3]).replace(" ", "?")}\n${second}`,
    markedDigits(transport, first, "indexes", [3], [0]),
    "line\n".repeat(300),
  ];
  const cases = [];
  for (const answer of answers) {
    const entry = { answer };
    const input = new ShareInput({ decodeEntry: "Decode" });
    entry.parts = await outcome(() => ({ parts: ShareInput.partsOfText(answer) }));
    entry.ofText = await outcome(() => ({ shares: input.sharesOfText(answer, "The file holds") }));
    entry.ofAnswer = await outcome(() => ({ shares: input.sharesOfAnswer(answer) }));
    if (entry.parts.parts !== undefined && entry.parts.parts.length > 0) {
      input.add(entry.parts.parts);
      entry.marked = input.marked;
      entry.problems = input.list.map(({ place, text }) => input.readProblem(place, text) ?? null);
      entry.first = input.firstUnreadable() ?? null;
      const each = input.repairEach();
      entry.each = {
        kind: each.kind,
        ...(each.kind === "repaired" ? { shares: each.shares.map(sharePlain) } : {}),
        ...(each.kind === "variants"
          ? { place: each.place, count: each.variants.length, message: each.message }
          : {}),
        ...(each.kind === "unreadable"
          ? { place: each.place, message: each.message, code: each.cause.code ?? null }
          : {}),
      };
      // Marked shares are assessed together: a host takes complete shares here.
      if (!input.marked) {
        const rewritten = input.rewritten();
        entry.rewritten =
          rewritten.kind === "set"
            ? { shares: rewritten.set.shares.map(sharePlain) }
            : { trouble: rewritten.trouble };
        const { outcome: restored, copies } = await input.restoreComplete(platform);
        entry.restored = {
          copies,
          places: input.places(),
          ...(restored.kind === "complete"
            ? {
                set: setPlain(restored.set),
                secretBytes: restored.secretBytes,
                setPlaces: restored.places,
              }
            : { trouble: restored.trouble }),
        };
      }
    }
    cases.push(entry);
  }
  // The places through retyping, leaving out and adding.
  const input = new ShareInput({ decodeEntry: "Decode" });
  input.add([first, second]);
  input.add([third]);
  input.leaveOut(2);
  input.replace(3, second);
  const refusedPlace = await outcome(() => input.replace(2, first));
  input.add([third]);
  const places = input.places();
  input.replaceAll([third]);
  const steps = { texts: [first, second, third], places, refusedPlace, after: input.places() };
  return { cases, steps };
}

/** The exports of shares, with and without what a repair left unsettled. */
async function shareExports(modules, vectors) {
  const { input: shareInput, repair, transport } = modules;
  const { ShareInput } = shareInput;
  const [first, second] = vectors.deterministic[0].shares;
  const [other] = vectors.deterministic[1].shares;
  const shares = [first, second, first, other].map(repair.unrepairedShare);
  const cases = [
    { shares: shares.slice(0, 3), unsettled: [], places: [2, 4, 5], form: undefined },
    { shares: shares.slice(0, 3), unsettled: [], places: [2, 4, 5], form: "colors" },
    {
      shares: shares.slice(0, 2),
      unsettled: [{ share: 2, position: 3 }],
      places: [1, 2],
      form: undefined,
    },
    {
      shares: shares.slice(0, 2),
      unsettled: [
        { share: 1, position: 3 },
        { share: 2, position: 3 },
      ],
      places: [1, 2],
      form: "words",
    },
    { shares: [shares[0], shares[3]], unsettled: [], places: [1, 2], form: undefined },
    { shares: shares.slice(0, 2), unsettled: [], places: [1], form: undefined },
    { shares: shares.slice(0, 2), unsettled: [], places: [0, 1], form: undefined },
  ];
  const recorded = [];
  for (const { shares: exported, unsettled, places, form } of cases) {
    recorded.push({
      shares: exported.map((share) => share.ur),
      unsettled,
      places,
      form: form ?? null,
      outcome: await outcome(() => {
        const checked = ShareInput.checkedExport({ shares: exported, unsettled }, places, form);
        const { written } = checked;
        return {
          kind: checked.kind,
          trouble: checked.trouble ?? null,
          shown: written.shown.map(({ ur, format, number }) => ({ ur, format, number })),
          saved: written.saved.map(({ number }) => number),
          forms: written.forms,
          leftOut: written.leftOut,
          messages: written.leftOutMessages(),
          total: written.total,
          note: written.copiesNote ?? null,
          text: written.shown.map(({ ur, format }) => transport.writeShare(ur, format)),
          inColors: written
            .inForm("colors")
            .shown.map(({ format, number }) => ({ format, number })),
        };
      }),
    });
  }
  return recorded;
}

/** Splits with the public seed, a backup masked first, and the refusals of a split. */
async function splits(modules, platform) {
  const { split, dates } = modules;
  const seeded = new split.ShareSplit(platform, (bytes) => bytes.fill(SEED));
  const date = dates.parseDate("23-09-2026");
  const phrase =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const requests = [
    { mode: "direct", dates: [], threshold: 2, count: 3 },
    { mode: "seedshift", dates: [date], threshold: 2, count: 2 },
    { mode: "seedshift", dates: [date], threshold: 3, count: 5 },
    { mode: "direct", dates: [], threshold: 16, count: 16 },
    { mode: "direct", dates: [], threshold: 1, count: 3 },
    { mode: "direct", dates: [], threshold: 0, count: 3 },
    { mode: "direct", dates: [], threshold: 4, count: 3 },
    { mode: "direct", dates: [], threshold: 2, count: 17 },
    { mode: "direct", dates: [date], threshold: 2, count: 3 },
    { mode: "seedshift", dates: [], threshold: 2, count: 3 },
    { mode: "seedshift-legacy", dates: [date], threshold: 2, count: 3 },
    { mode: "seedshift-legacy-valid", dates: [date], threshold: 2, count: 3 },
  ];
  const recorded = [];
  for (const { mode, dates: chosen, threshold, count } of requests)
    recorded.push({
      mode,
      dates: chosen.length,
      threshold,
      count,
      outcome: await outcome(async () => {
        const { records, held, original } = await seeded.splitBackup({
          mnemonic: phrase,
          mode,
          dates: chosen,
          threshold,
          count,
        });
        return { count: records.length, held, original };
      }),
    });
  return recorded;
}

/** The keeping notes of shares saved each way. */
function keeping(modules, vectors, twins) {
  const { keeping: notes } = modules;
  const [first, second, third] = vectors.deterministic[0].shares;
  const lists = [
    [first, second, third],
    [first, second],
    [first],
    [first, first, second],
    vectors.official.shares,
    twins.threeOfFive,
    twins.threeOfFive.slice(0, 3),
    [],
    [first, vectors.deterministic[1].shares[1]],
    [twins.mine[0], twins.other[0]],
  ];
  const recorded = [];
  for (const records of lists)
    for (const packaging of ["file", "folder", "files", "folders", "pages", "box"])
      for (const masked of [false, true])
        try {
          recorded.push({
            records,
            packaging,
            masked,
            note: notes.shareKeepingNote(records, packaging, masked),
          });
        } catch (error) {
          recorded.push({ records, packaging, masked, refused: refusal(error) });
        }
  return recorded;
}

/** The QR check of a share: the codes printed beside it and what the QR code holds. */
function qrChecks(transport, vectors) {
  const [first, second] = vectors.deterministic[0].shares;
  const colors = transport.shareToColors(first);
  const unicode = transport.writeShare(first, "unicode").split(" ");
  const cases = [
    { colors, payload: first },
    { colors, payload: second },
    { colors, payload: first, labels: unicode },
    { colors, payload: second, labels: unicode },
    { colors, payload: "not a share" },
    { colors: ["#000000"], payload: first },
  ];
  return cases.map(({ colors: printed, payload, labels }) => {
    const entry = { colors: printed, payload, labels: labels ?? null };
    try {
      transport.assertShareQr(printed, payload, labels);
      return { ...entry, fits: true };
    } catch (error) {
      return { ...entry, refused: refusal(error) };
    }
  });
}

/** The words hinted below shares being typed. */
function hints(shareInput, vectors) {
  const [first] = vectors.deterministic[0].shares;
  const lines = [
    "",
    "t",
    "tu",
    "tuna ne",
    "tunanext",
    "tunanextk",
    "tuna-ne",
    "qq",
    first,
    `${first};`,
    `${first};tu`,
    `${first}\ntuna ne`,
    "12 ",
    "#12",
  ];
  return lines.map((line) => ({
    line,
    hint: shareInput.SHARE_WORD_HINTS.hint(line) ?? null,
    completion: shareInput.SHARE_WORD_HINTS.completion(line) ?? null,
  }));
}

/** Shares split from the fixed seed for the cases that no vector holds. */
export async function madeShares(modules, platform) {
  const { split, bytes, runtime } = modules;
  const phrase =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const seeded = new split.ShareSplit(platform, (filled) => filled.fill(SEED));
  const entropy = (value) => bytes.bytesOfHex(value);
  const seed = () => new Uint8Array(32).fill(SEED);
  const zeros = "00000000000000000000000000000000";
  const ones = "ffffffffffffffffffffffffffffffff";
  /** The shares of `hex` in `groups`, each [threshold, count], `needed` of them restoring it. */
  const inGroups = async (hex, needed, groups) =>
    (await runtime.sskrEngine())
      .create_sskr_shares(entropy(hex), needed, Uint8Array.from(groups.flat()), seed())
      .trim()
      .split("\n");
  return {
    mine: await seeded.split(phrase, 2, 3),
    other: await seeded.split(OTHER_PHRASE, 2, 3),
    threeOfFive: await seeded.split(phrase, 3, 5),
    threeOfSix: await seeded.split(phrase, 3, 6),
    // A threshold of 1 keeps no digest: nothing checks these shares, which a split refuses.
    single: await platform.createShares(entropy(zeros), 1, 2, seed()),
    otherSingle: await platform.createShares(entropy(ones), 1, 2, seed()),
    pairs: await inGroups(zeros, 1, [
      [2, 2],
      [2, 2],
    ]),
    otherPairs: await inGroups(ones, 1, [
      [2, 2],
      [2, 2],
    ]),
    mixed: await inGroups(zeros, 2, [
      [2, 3],
      [1, 1],
      [1, 2],
    ]),
    singles: await inGroups(zeros, 1, [
      [1, 2],
      [1, 2],
    ]),
    otherSingles: await inGroups(ones, 1, [
      [1, 2],
      [1, 2],
    ]),
    triple: await inGroups(zeros, 2, [
      [2, 2],
      [2, 2],
      [2, 2],
    ]),
    otherTriple: await inGroups(ones, 2, [
      [2, 2],
      [2, 2],
      [2, 2],
    ]),
  };
}

/** The modules the two recorders of shares read, and the platform of this build. */
export async function shareModules(ts) {
  const modules = {
    transport: await ts.load("sskr/transport.js"),
    shares: await ts.load("sskr/shares.js"),
    repair: await ts.load("sskr/repair.js"),
    joint: await ts.load("sskr/joint-repair.js"),
    report: await ts.load("sskr/repair-report.js"),
    input: await ts.load("sskr/share-input.js"),
    split: await ts.load("sskr/split.js"),
    set: await ts.load("sskr/share-set.js"),
    keeping: await ts.load("export/sskr-keeping-text.js"),
    dates: await ts.load("core/dates.js"),
    bytes: await ts.load("core/bits.js"),
    checksum: await ts.load("sskr/checksum.js"),
    words: await ts.load("sskr/bytewords-list.js"),
    runtime: await ts.load("sskr/runtime.js"),
  };
  const { nodeSharePlatform: platform } = await ts.load("sskr/share-platform-node.js");
  return { modules, platform };
}

/** The public vectors of shares. */
export function loadVectors(ts) {
  return JSON.parse(readFileSync(join(ts.root, "vectors", "sskr-v1.json"), "utf8"));
}

/** The whole record. */
export async function record(ts) {
  const { modules, platform } = await shareModules(ts);
  const { ENCODED_FORMATS } = await ts.load("core/types.js");
  const vectors = loadVectors(ts);
  const { transport, input } = modules;
  const next = sequence();
  const twins = await madeShares(modules, platform);
  return {
    forms: formFacts(transport, ENCODED_FORMATS),
    reads: reads(modules, vectors, next),
    sets: await sets(modules, vectors, platform, twins),
    typed: await typed(modules, platform, transport, vectors, twins),
    exports: await shareExports(modules, vectors),
    splits: await splits(modules, platform),
    keeping: keeping(modules, vectors, twins),
    qr: qrChecks(transport, vectors),
    hints: hints(input, vectors),
  };
}
