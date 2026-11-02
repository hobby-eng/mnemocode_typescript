// The known answers of recovery for the Rust port (increment 8 of its
// docs/design/architect/PLAN.md): the places of a phrase, marked codes, the date, word and
// marked-code searches, how a backup as given is read, the check of a written backup and the
// restore of shares in its steps, each read from this build's own modules over public phrases, so
// that every run records the same cases. Times come from a clock of fixed steps: one second between
// each two reads. The Rust port's crates/mnemocode/tests/ts_recovery.rs replays them.

import { createHash } from "node:crypto";

import {
  DATE,
  FINGERPRINT,
  LEGAL,
  NO_FINGERPRINT,
  SHOWN,
  TWELVE,
  replaced,
  resultPlain,
  steps,
  wallet,
} from "./recovery-common.mjs";
import { sets, shareChecks, shareRestores } from "./recovery-shares.mjs";
import { outcome, shareModules } from "./shares.mjs";

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "recovery-v1.json";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The modules that recovery reads. */
async function modules(ts) {
  return {
    candidates: await ts.load("core/candidates.js"),
    wordCandidate: await ts.load("core/word-candidate.js"),
    marked: await ts.load("core/missing-codes.js"),
    markedSearch: await ts.load("core/missing-codes-search.js"),
    dateSearch: await ts.load("core/date-search.js"),
    dates: await ts.load("core/dates.js"),
    reading: await ts.load("core/backup-reading.js"),
    check: await ts.load("core/backup-check.js"),
    backup: await ts.load("core/encoded-backup.js"),
    restore: await ts.load("sskr/share-restore.js"),
    unmasking: await ts.load("sskr/share-unmasking.js"),
    evidence: await ts.load("bitcoin-evidence.js"),
  };
}

/** The phrase of `text` encoded in `mode` with `days`, in English words. */
function encoded({ backup, dates }, text, mode, days = []) {
  return backup.EncodedBackup.encode(text, days.map(dates.parseDate), "english", mode).backup;
}

/** A place written, as its words or its refusal. */
const placeCases = (candidates) =>
  [
    "?",
    "about",
    "about|abandon|about",
    "abo*",
    "zoo*",
    "*",
    "a?*",
    "a*b*",
    "zzz",
    "zoo|zzz",
    "",
  ].map((written) => ({
    written,
    ...(() => {
      try {
        return { words: candidates.wordPlaceOf(written, 3) };
      } catch (error) {
        return { refused: { code: error.code, message: error.message } };
      }
    })(),
  }));

/** How a search of `text` tells its size, or why it is refused. */
const searchFacts = async ({ candidates }, text, kind) => ({
  text,
  kind,
  ...(await outcome(() => {
    const search = candidates.WordCandidateSearch.parse(text, kind);
    return {
      wordCount: search.wordCount,
      combinations: search.combinations,
      expected: search.expected,
      unknownPlaces: search.unknownPlaces,
    };
  })),
});

/** What a word search of `text` found. */
async function wordSearch(all, text, kind, run = {}) {
  const { candidates } = all;
  return {
    text,
    kind,
    keep: run.keep ?? 0,
    maxShown: run.maxShown ?? null,
    fingerprint: run.fingerprint ?? null,
    ...(await outcome(async () => {
      const search = candidates.WordCandidateSearch.parse(text, kind);
      const walletCheck = run.fingerprint === undefined ? undefined : wallet(all, run.fingerprint);
      const found = await search.run({ walletCheck, keep: run.keep, maxShown: run.maxShown });
      return {
        count: found.count,
        matched: found.matched,
        warning: found.warning ?? null,
        listFull: found.listFull,
        shownCount: found.shown.length,
        shownHash: sha256(found.shown.map(({ candidate }) => candidate.phrase).join("\n")),
        shown: found.shown.slice(0, SHOWN).map(({ candidate, match }) => ({
          number: candidate.number,
          phrase: candidate.phrase,
          bits: candidate.checksumBits,
          places: search.placesOf(candidate),
          match: match === undefined ? null : { matched: match.matched, path: match.path ?? null },
        })),
        entropies: sha256(Buffer.concat(found.entropies)),
      };
    })),
  };
}

/** What marked `text` read in `format` gives. */
const markedFacts = async ({ marked }, text, format, mode) => ({
  text,
  format,
  mode,
  ...(await outcome(() => {
    const codes = marked.MissingCodes.read(text, format, mode);
    const candidates = [...codes.candidates()];
    return {
      wordCount: codes.wordCount,
      placements: codes.placements,
      combinations: codes.combinations,
      checksummed: codes.checksummed,
      expected: codes.expected,
      candidates: candidates.length,
      hash: sha256(candidates.map((candidate) => candidate.join(" ")).join("\n")),
    };
  })),
});

/** The marked texts of the public phrase in every form, with refusals of each. */
function markedTexts(all) {
  const { backup } = all;
  const { indexes } = backup.EncodedBackup.read(TWELVE, "english", "direct");
  const written = (format) => backup.EncodedBackup.of(indexes, format, "direct").text();
  const numbers = written("indexes");
  const unicode = written("unicode");
  const colors = written("colors");
  const colorUnits = colors.split(" ");
  return [
    [replaced(TWELVE, [11], "?"), "english"],
    [replaced(TWELVE, [0, 11], "?"), "english"],
    [replaced(TWELVE, [11], "abo*"), "english"],
    [replaced(TWELVE, [11], "about|abandon"), "english"],
    ["abandon ?", "english"],
    [TWELVE, "english"],
    [replaced(TWELVE, [3], "zzz*"), "english"],
    [replaced(TWELVE, [3], "zzz"), "english"],
    [Array(12).fill("?").join(" "), "english"],
    [replaced(numbers, [11], "?"), "indexes"],
    [replaced(numbers, [11], "?"), "unicode"],
    [replaced(numbers, [11], "4"), "indexes"],
    [replaced(numbers, [11], "?"), "colors"],
    [replaced(numbers, [2], "1?34"), "indexes"],
    [replaced(numbers, [2], "9?99"), "indexes"],
    [replaced(numbers, [2], "3000"), "indexes"],
    [replaced(numbers, [2], "1?345"), "indexes"],
    ["1?3456789012 2 3", "indexes"],
    [replaced(unicode, [11], "?"), "unicode"],
    [replaced(unicode, [4], "4E?0"), "unicode"],
    [replaced(unicode, [4], "ZZZZ"), "unicode"],
    [replaced(unicode, [4], "E000"), "unicode"],
    [replaced(colors, [7], "?"), "colors"],
    [replaced(colors, [0], "?"), "colors"],
    [colorUnits.map((unit, at) => (at < 2 ? "?" : unit)).join(" "), "colors"],
    [replaced(colors, [3], "#12?456"), "colors"],
    [written("colors-unicode").slice(0, -4), "colors-unicode"],
    [`${written("colors-unicode").slice(0, -8)}????????`, "colors-unicode"],
    [`${written("colors-unicode").slice(0, -8)}`, "colors-unicode"],
  ];
}

/** The plan of `way` with fixed steps of time, as data. */
async function planOf(way, limit) {
  const plan = await way.plan(limit, steps());
  return {
    size: plan.size,
    count: plan.count,
    seconds: plan.seconds,
    ask: plan.ask,
    tell: plan.tell,
    question: plan.question(),
    notice: plan.notice(),
    extent: plan.extent(),
  };
}

/** What a way found, as data. */
function resultOf({ dates }, result) {
  if (result.kind === "found")
    return {
      kind: "found",
      codes: result.backup.text(),
      dates: result.dates === undefined ? null : result.dates.map(dates.formatDate),
      foundDates: result.foundDates ?? null,
      others: result.others ?? null,
      warning: result.warning ?? null,
    };
  if (result.kind === "list")
    return {
      kind: "list",
      rows: result.rows.map(({ codes, phrase, fingerprint }) => ({ codes, phrase, fingerprint })),
    };
  return result;
}

/** One search of marked codes, every question about it, and each way that it asks for. */
async function markedSearchCase(all, fingerprintOf, { text, format, mode, ways }) {
  const { marked, markedSearch, dateSearch, dates } = all;
  const codes = marked.MissingCodes.read(text, format, mode);
  const search = new markedSearch.MissingCodesSearch(codes, fingerprintOf);
  const answers = [];
  for (const way of ways) {
    answers.push({
      way,
      ...(await outcome(async () => {
        const dateAnswer =
          way.dates === undefined
            ? undefined
            : dateSearch.DatesAnswer.parse(way.dates, {
                wordCount: codes.wordCount,
                patterns: true,
              });
        const prepared =
          way.kind === "encoded"
            ? search.byEncodedFingerprint(way.fingerprint)
            : way.kind === "wallet"
              ? search.byWallet(wallet(all, way.fingerprint), dateAnswer)
              : search.listed((way.complete ?? []).map(dates.parseDate));
        return { plan: await planOf(prepared), result: resultOf(all, await prepared.run()) };
      })),
    });
  }
  return {
    text,
    format,
    mode,
    places: markedSearch.MissingCodesSearch.placesText(codes),
    unreadable: search.unreadable,
    many: search.many,
    needsDates: search.needsDates,
    ways: search.ways,
    whyNot: Object.fromEntries(
      markedSearch.MISSING_CODES_WAYS.map((way) => [way, search.whyNot(way) ?? null]),
    ),
    answers,
  };
}

/** What a date search of `codes` found. */
async function dateCase(all, { text, mode, dates, fingerprint, maxShown, keep }) {
  const { backup, dateSearch } = all;
  return {
    text,
    mode,
    dates,
    fingerprint: fingerprint ?? null,
    maxShown: maxShown ?? null,
    keep: keep ?? 0,
    ...(await outcome(async () => {
      const codes = backup.EncodedBackup.read(text, "english", mode);
      const answer = dateSearch.DatesAnswer.parse(dates, {
        wordCount: codes.words,
        patterns: true,
      });
      const walletCheck = fingerprint === undefined ? undefined : wallet(all, fingerprint);
      const search = new dateSearch.DateSearch({
        indexes: codes.indexes,
        dates: answer,
        mode,
        walletCheck,
        maxShown,
        keep,
      });
      const pace = { perCheck: 1 / 3, perCombination: 0.25 };
      const plan = search.plan(pace);
      const found = await search.run();
      return {
        note: answer.forgottenDigitsNote ?? null,
        checks: search.checks(),
        seconds: search.estimatedSeconds(pace),
        plan: { size: plan.size, count: plan.count, ask: plan.ask },
        combinations: found.combinations,
        checksumValid: found.checksumValid,
        matchCount: found.matchCount,
        checked: found.checked,
        warning: found.warning ?? null,
        kept: found.kept,
        shown: found.shown.slice(0, SHOWN).map((match) => ({
          dates: match.dates,
          phrase: match.mnemonic,
          evidence: match.evidence ?? null,
          warning: match.warning ?? null,
        })),
        hash: sha256(found.shown.map((match) => `${match.dates} ${match.mnemonic}`).join("\n")),
      };
    })),
  };
}

/** The public phrase masked in `mode` with `days`, as English words. */
const maskedWords = (all, mode, days) => encoded(all, TWELVE, mode, days).text();

/** The date searches: every mode, dates that give the same shifts, and refusals. */
function dateCases(all) {
  const one = maskedWords(all, "seedshift", [DATE]);
  const two = maskedWords(all, "seedshift", ["01-02-2001", DATE]);
  const four = maskedWords(all, "seedshift", [
    "01-02-2001",
    "03-04-2002",
    "05-06-2003",
    "07-08-2004",
  ]);
  const legacy = maskedWords(all, "seedshift-legacy", [DATE]);
  return [
    { text: one, mode: "seedshift", dates: "2?-09-2026", fingerprint: FINGERPRINT },
    { text: one, mode: "seedshift", dates: "2?-09-2026", fingerprint: NO_FINGERPRINT },
    { text: one, mode: "seedshift", dates: "2?-09-2026" },
    { text: one, mode: "seedshift", dates: "2?-09-2026", maxShown: 2, keep: 3 },
    { text: one, mode: "seedshift", dates: "??-??-2026", fingerprint: FINGERPRINT },
    { text: two, mode: "seedshift", dates: "0?-02-2001 23-09-2026", fingerprint: FINGERPRINT },
    { text: two, mode: "seedshift", dates: "0?-02-2001 2?-09-2026", fingerprint: FINGERPRINT },
    { text: two, mode: "seedshift", dates: "0?-01-2000 0?-01-2000" },
    { text: one, mode: "seedshift", dates: "23-09-2026|0978" },
    { text: one, mode: "seedshift", dates: "05-05-0100|2148|4196" },
    { text: four, mode: "seedshift", dates: "01-02-2001 03-04-2002 05-06-2003 0?-08-2004" },
    { text: four, mode: "seedshift", dates: "01-02-2001 03-04-2002 05-06-2003 ??-08-2004" },
    { text: four, mode: "seedshift", dates: "01-02-2001 03-04-2002 05-06-2003 ??-0?-2004" },
    { text: legacy, mode: "seedshift-legacy", dates: "2?-09-2026" },
    { text: legacy, mode: "seedshift-legacy", dates: "??-0?-2026" },
    { text: legacy, mode: "seedshift-legacy-valid", dates: "2?-09-2026" },
    { text: TWELVE, mode: "seedshift-legacy-valid", dates: "1?-01-2000" },
    { text: TWELVE, mode: "direct", dates: "2?-09-2026" },
    {
      text: one,
      mode: "seedshift",
      dates: "2?-09-2026 2?-09-2026 2?-09-2026 2?-09-2026 2?-09-2026",
    },
    { text: one, mode: "seedshift", dates: "23-09-2026" },
  ];
}

/** Date answers as typed: their notes and refusals. */
const dateAnswers = ({ dateSearch }, lines) =>
  lines.map(([line, wordCount, patterns]) => ({
    line,
    wordCount,
    patterns,
    ...(() => {
      try {
        const answer = dateSearch.DatesAnswer.parse(line, { wordCount, patterns });
        return {
          count: answer.count,
          forgotten: answer.hasForgottenDigits,
          combinations: answer.combinations,
          note: answer.forgottenDigitsNote ?? null,
          fits12: answer.fitsPhrase(12),
          tooMany12: answer.tooManyFor(12) ?? null,
          incomplete: (() => {
            try {
              answer.assertIncomplete();
              return null;
            } catch (error) {
              return { code: error.code, message: error.message };
            }
          })(),
        };
      } catch (error) {
        return { refused: { code: error.code, message: error.message } };
      }
    })(),
  }));

/** How `text` as given is read. */
const readingCase = async ({ reading }, text, rules, given) => ({
  text,
  rules,
  given,
  ...(await outcome(() => {
    const read = reading.BackupReading.of(text, { shareReader: "the Shares tab", ...rules });
    const said = (ask) => {
      try {
        return { value: ask() };
      } catch (error) {
        return { refused: { code: error.code, message: error.message } };
      }
    };
    return {
      record: read.hasRecord,
      mode: read.mode(given.mode) ?? null,
      modeConflict: read.modeConflict(given.mode) ?? null,
      formatConflict: read.formatConflict(given.format) ?? null,
      marked: read.marked,
      forms: said(() => read.formats(given.format)),
      markedForms: said(() => read.markedFormats(given.format)),
    };
  })),
});

/** What the check of an encoded backup says of `written`. */
async function encodedChecks(all) {
  const { check, dates, backup } = all;
  const parsed = [dates.parseDate("01-02-2001"), dates.parseDate(DATE)];
  const result = backup.EncodedBackup.encode(TWELVE, parsed, "english", "seedshift").backup;
  const words = result.text();
  const original = {
    mnemonic: TWELVE,
    format: "english",
    mode: "seedshift",
    codes: [...result.indexes],
    dates: parsed,
  };
  const checker = new check.EncodedBackupCheck(original);
  const cases = [
    { backup: words, dates: `${DATE} 01-02-2001` },
    { backup: words, dates: DATE },
    { backup: words, dates: "02-02-2001 23-09-2026" },
    { backup: words, dates: "no date" },
    { backup: words },
    { backup: replaced(words, [0, 3], "zoo"), dates: DATE },
    { backup: replaced(words, [3], "zoo"), dates: DATE },
    { backup: replaced(words, [3], "zzz"), dates: DATE },
    { backup: "abandon", dates: DATE },
  ];
  const answers = [];
  for (const written of cases)
    answers.push({
      written,
      ...(await outcome(async () => resultPlain(await checker.check(written)))),
    });
  return { words, answers };
}

export async function record(ts) {
  const all = await modules(ts);
  const { candidates } = all;
  const fingerprintOf = (phrase) => all.evidence.masterFingerprint(phrase);
  const shares = await shareModules(ts);
  const made = await sets(all, shares);
  const words = [];
  for (const [text, kind] of [
    [replaced(TWELVE, [11], "?"), "unknown-words"],
    [replaced(TWELVE, [0, 11], "?"), "unknown-words"],
    [replaced(TWELVE, [2], "ab*"), "unknown-words"],
    [Array(12).fill("?").join(" "), "unknown-words"],
    [TWELVE, "unknown-words"],
    ["abandon about", "unknown-words"],
    [replaced(TWELVE, [3], "zzz"), "unknown-words"],
    [TWELVE.replace("abandon ", ""), "missing-word"],
    [TWELVE, "missing-word"],
    [replaced(TWELVE, [3], "zzz").replace("abandon ", ""), "missing-word"],
  ])
    words.push(await searchFacts(all, text, kind));
  const wordRuns = [];
  for (const [text, kind, run] of [
    [replaced(TWELVE, [11], "?"), "unknown-words", {}],
    [replaced(TWELVE, [11], "?"), "unknown-words", { keep: 128 }],
    [replaced(TWELVE, [11], "?"), "unknown-words", { keep: 127 }],
    [replaced(TWELVE, [11], "?"), "unknown-words", { maxShown: 2 }],
    [replaced(TWELVE, [11], "abo*"), "unknown-words", { fingerprint: FINGERPRINT }],
    [replaced(TWELVE, [11], "?"), "unknown-words", { fingerprint: NO_FINGERPRINT, maxShown: 1 }],
    [replaced(LEGAL, [2], "?"), "unknown-words", {}],
    [replaced(LEGAL, [2, 7], "th*"), "unknown-words", { keep: 1000 }],
    [TWELVE.replace("abandon ", ""), "missing-word", { keep: 4096 }],
    [LEGAL.replace("thank ", ""), "missing-word", {}],
  ])
    wordRuns.push(await wordSearch(all, text, kind, run));
  const marked = [];
  for (const [text, format] of markedTexts(all))
    for (const mode of ["direct", "seedshift", "seedshift-legacy"])
      marked.push(await markedFacts(all, text, format, mode));
  const forms = markedTexts(all).map(([text]) => ({
    text,
    marked: all.marked.MissingCodes.marked(text),
    forms: all.marked.MissingCodes.formats(text),
  }));
  const one = maskedWords(all, "seedshift", [DATE]);
  const legacy = maskedWords(all, "seedshift-legacy", [DATE]);
  const searches = [];
  for (const entry of [
    {
      text: replaced(TWELVE, [11], "?"),
      format: "english",
      mode: "direct",
      ways: [
        { kind: "wallet", fingerprint: FINGERPRINT },
        { kind: "wallet", fingerprint: NO_FINGERPRINT },
        { kind: "encoded", fingerprint: FINGERPRINT },
        { kind: "encoded", fingerprint: "not hex" },
        { kind: "list" },
      ],
    },
    {
      text: replaced(TWELVE, [11], "abo*"),
      format: "english",
      mode: "direct",
      ways: [{ kind: "list" }, { kind: "wallet", fingerprint: FINGERPRINT }],
    },
    {
      text: replaced(one, [11], "?"),
      format: "english",
      mode: "seedshift",
      ways: [
        { kind: "wallet", fingerprint: FINGERPRINT, dates: DATE },
        { kind: "wallet", fingerprint: FINGERPRINT, dates: "2?-09-2026" },
        { kind: "wallet", fingerprint: NO_FINGERPRINT, dates: "2?-09-2026" },
      ],
    },
    {
      text: replaced(legacy, [10], "?"),
      format: "english",
      mode: "seedshift-legacy",
      ways: [
        { kind: "encoded", fingerprint: FINGERPRINT },
        { kind: "wallet", fingerprint: FINGERPRINT, dates: DATE },
      ],
    },
    {
      text: replaced(legacy, [10], "ab*"),
      format: "english",
      mode: "seedshift-legacy-valid",
      ways: [{ kind: "list", complete: [DATE] }],
    },
  ])
    searches.push(await markedSearchCase(all, fingerprintOf, entry));
  const dateRuns = [];
  for (const entry of dateCases(all)) dateRuns.push(await dateCase(all, entry));
  const record = encoded(all, TWELVE, "seedshift", [DATE]).record();
  const plain = all.backup.EncodedBackup.read(TWELVE, "english", "direct").record();
  const readings = [];
  for (const [text, rules, given] of [
    [record, {}, {}],
    [record, {}, { mode: "direct", format: "colors" }],
    [record, { seedshiftOnly: true }, { mode: "seedshift" }],
    [plain, { seedshiftOnly: true }, {}],
    [plain, {}, { mode: "seedshift" }],
    [one, {}, {}],
    [replaced(one, [3], "?"), {}, {}],
    [replaced(one, [3], "?"), {}, { format: "english" }],
    [TWELVE, { words: 12 }, {}],
    [`${TWELVE} zoo zoo zoo`, { words: 12 }, {}],
    ["abandon", {}, {}],
    ["? ? ?", {}, {}],
    ["MNC1 broken", {}, {}],
    [TWELVE, { words: 13 }, {}],
  ])
    readings.push(await readingCase(all, text, { seedshiftOnly: false, ...rules }, given));
  return {
    places: placeCases(candidates),
    notices: [10, 2048, 2049].flatMap((count) => [
      { count, save: null, text: candidates.unshownCandidatesNotice(count) },
      { count, save: "save them", text: candidates.unshownCandidatesNotice(count, "save them") },
    ]),
    words,
    wordRuns,
    marked,
    forms,
    searches,
    dateAnswers: dateAnswers(all, [
      ["23-09-2026", 12, false],
      ["2?-09-2026 01-01-2000", 12, true],
      ["2?-09-2026 0?-01-2000", 24, true],
      ["2?-09-2026", 12, false],
      ["23-09-2026 01-01-2000 02-01-2000 03-01-2000 04-01-2000", 12, false],
      ["? ? ? ?", 24, true],
      ["?", 12, true],
      ["? ?", 12, true],
      ["", 12, false],
    ]),
    wallets: ["direct", "seedshift", "seedshift-legacy", "seedshift-legacy-valid"].map((mode) => ({
      mode,
      needed: all.dateSearch.walletNeeded(mode),
      reason: all.dateSearch.walletReason(mode),
    })),
    unknownReason: all.dateSearch.walletReason(undefined),
    dateRuns,
    readings,
    encodedChecks: await encodedChecks(all),
    shareChecks: await shareChecks(all, shares, made),
    shares: { direct: made.direct, masked: made.masked, other: made.other },
    ...(await shareRestores(all, shares, made)),
  };
}
