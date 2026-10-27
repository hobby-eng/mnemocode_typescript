// The known answers of the library's foundation for the Rust port (increment 1 of its
// docs/design/architect/PLAN.md):
// white space over every scalar value, safe display, whole numbers, the words of running text and
// of places, codes as text, bytes as hexadecimal, pieces, strict UTF-8, byte limits, the search
// plan's words, CRC-32 and the self-check messages, each read from this build's own module with
// public inputs. The Rust port's crates/mnemocode/tests/ts_foundation.rs replays them.

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "foundation-v1.json";

/** Every Unicode scalar value, as a one-character string, with its code point. */
function* scalars() {
  for (let point = 0; point <= 0x10ffff; point += 1) {
    if (point >= 0xd800 && point <= 0xdfff) continue;
    yield [point, String.fromCodePoint(point)];
  }
}

/** The code points for which `test` holds. */
function pointsWhere(test) {
  const points = [];
  for (const [point, text] of scalars()) if (test(text)) points.push(point);
  return points;
}

/** The native kind of a refusal, which TS keeps through its own class: "RangeError", "TypeError" or "Error". */
function kindOf(error) {
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof TypeError) return "TypeError";
  return "Error";
}

/** What `run` gives, or its refusal as { code, message, kind }. */
function outcome(run) {
  try {
    const value = run();
    return { value: value instanceof Uint8Array ? Array.from(value) : value };
  } catch (error) {
    return { code: error.code, message: error.message, kind: kindOf(error) };
  }
}

/** The TS modules this recorder reads. */
async function modules(ts) {
  return {
    space: await ts.load("core/white-space.js"),
    style: await ts.load("cli/terminal-style.js"),
    numbers: await ts.load("core/typed-number.js"),
    places: await ts.load("core/places.js"),
    prose: await ts.load("core/prose.js"),
    codes: await ts.load("core/code-text.js"),
    bits: await ts.load("core/bits.js"),
    pieces: await ts.load("core/pieces.js"),
    utf8: await ts.load("core/utf8-text.js"),
    limits: await ts.load("core/byte-units.js"),
    plan: await ts.load("core/search-plan.js"),
    turns: await ts.load("core/search-turns.js"),
    checksum: await ts.load("sskr/checksum.js"),
    check: await ts.load("core/self-test-check.js"),
    vectors: await ts.load("core/self-test-vectors.js"),
  };
}

const RANGES = [
  [1, 2048],
  [0, 2147483647],
  [1, Number.MAX_SAFE_INTEGER],
];
const TYPED = ["0", "1", "0007", "2048", "2049", "", " 1", "+1", "1.0", "1e3", "-1", "١"];
const TOKENS = [
  "ab,cd; #ef　12",
  " 07 a4 ",
  "#ab, #cd",
  "7684 ?6?4 ?",
  "7684",
  "76845728",
  "7684?5728",
  "768?",
  "",
  "7684 ????",
  "7684 5728",
  "7684 ?728",
  "????",
  "straße",
];

/** White space, safe display, whole numbers and the words of running text and places. */
function textAnswers({ space, style, numbers, places, prose }) {
  return {
    ecmascriptSpace: pointsWhere((text) => /^\s$/u.test(text)),
    whiteSpaceTrimmed: pointsWhere((text) => space.trimWhiteSpace(text) === ""),
    unsafeDisplay: pointsWhere((text) => style.printableText(text) !== text),
    wholeNumbers: RANGES.flatMap(([min, max]) =>
      TYPED.map((text) => [
        text,
        min,
        max,
        numbers.wholeNumberOf(text, numbers.DECIMAL_DIGITS, { min, max }) ?? null,
      ]),
    ),
    typedRefusal: outcome(() => numbers.typedWholeNumber("x", { min: 0, max: 2147483647 })),
    integerRefusals: [
      numbers.integerRefusal("The month", { min: 1, max: 12 }),
      numbers.integerRefusal("The year", { min: 1, max: 9999 }, "0001 through 9999"),
    ],
    rangeTexts: [
      numbers.rangeText({ min: 1, max: 2048 }),
      numbers.rangeText({ min: 1, max: 2048 }, "to"),
    ],
    lists: [
      [[], "and", places.listInWords([], "and")],
      [[2], "and", places.listInWords([2], "and")],
      [[1, 2], "and", places.listInWords([1, 2], "and")],
      [[12, 15, 18], "or", places.listInWords([12, 15, 18], "or")],
    ],
    placesNamed: [
      ["Date", [2], places.placesNamed("Date", [2])],
      ["Date", [1, 2], places.placesNamed("Date", [1, 2])],
      ["Share", [1, 2, 3], places.placesNamed("Share", [1, 2, 3])],
    ],
    placeOf: [
      [[3, 5], 2, places.placeOf([3, 5], 2)],
      [[3], 2, places.placeOf([3], 2)],
      [null, 4, places.placeOf(undefined, 4)],
    ],
    numberWords: Array.from({ length: 15 }, (_, value) => [value, prose.numberWord(value)]),
    capitalized: ["share 2", "", "été", "already", "\u{1D400}bc"].map((text) => [
      text,
      prose.capitalized(text),
    ]),
    lowerFirst: [
      "Unknown word",
      "SSKR share",
      "MnemoCode reads",
      "Mnemo",
      "PDF",
      "A",
      "",
      "\u{1D400}BC",
    ].map((text) => [text, prose.lowerFirst(text)]),
    afterPlace: [
      ["Share", 2, "Unknown word.", ": ", prose.afterPlace("Share", 2, "Unknown word.")],
    ],
  };
}

/** Codes as text, hexadecimal bytes, pieces, strict UTF-8 and byte limits. */
function codeAnswers({ codes, bits, pieces, utf8, limits }) {
  return {
    codeTokens: TOKENS.map((text) => [text, codes.codeTokens(text)]),
    compactCode: TOKENS.map((text) => [text, codes.compactCode(text)]),
    unspacedCode: TOKENS.map((text) => [text, codes.unspacedCode(text)]),
    hexUnits: TOKENS.flatMap((text) =>
      [4, 2].map((width) => [
        text,
        width,
        codes.apartHexUnits(text, width) ?? null,
        codes.joinedHexUnits(text, width) ?? null,
        codes.hexUnits(text, width) ?? null,
        codes.hexUnits(text, width, { foldWholeMarks: true }) ?? null,
        codes.completeHexUnits(text, width) ?? null,
      ]),
    ),
    joinedMarksHint: TOKENS.map((text) => [text, codes.withJoinedMarksHint("Refused.", text)]),
    fitsPattern: [
      ["7?84", "7684", codes.fitsPattern("7?84", "7684")],
      ["7?84", "76840", codes.fitsPattern("7?84", "76840")],
      ["????", "abcd", codes.fitsPattern("????", "abcd")],
      ["?b", "\u{1F600}b", codes.fitsPattern("?b", "\u{1F600}b")],
      ["??b", "\u{1F600}b", codes.fitsPattern("??b", "\u{1F600}b")],
    ],
    hexCodePoints: [0x41, 0x7684, 0xffff].map((point) => [point, codes.hexCodePoint(point)]),
    hexOfBytes: [[[0, 0xab, 0x7f], bits.hexOfBytes([0, 0xab, 0x7f])]],
    bytesOfHex: ["00AB7f", "", "0", "0g", "+1", " 1"].map((text) => [
      text,
      outcome(() => bits.bytesOfHex(text)),
    ]),
    textPieces: [
      ["0102ff", 2],
      ["的在", 1],
      ["", 3],
      ["010", 2],
      ["01", 0],
    ].map(([text, width]) => [text, width, outcome(() => pieces.textPieces(text, width))]),
    notUtf8: outcome(() => utf8.strictUtf8Text(Uint8Array.of(0x61, 0xff), "The file")),
    limitName: limits.limitName(limits.MEBIBYTE),
    inputTooLarge: outcome(() => {
      throw new limits.InputTooLargeError("The file", limits.MEBIBYTE);
    }),
  };
}

/** The search plan's words, kept counts, CRC-32, the self-check messages and public vectors. */
function planAnswers({ plan, turns, checksum, check, vectors, pieces }) {
  return {
    selfTestVectors: Object.fromEntries(Object.entries(vectors)),
    counting: [0, 999, 65536, 2147483648].map((value) => [value, plan.counting(value)]),
    durations: [0.4, 1, 59.6, 90, 150, 2.5, 32400, 259200].map((seconds) => [
      seconds,
      plan.duration(seconds),
    ]),
    counted: [
      [1, "share combination", plan.counted(1, "share combination")],
      [2, "candidate", plan.counted(2, "candidate")],
    ],
    plans: [
      ["10 date combinations", 10, 32400, 5],
      ["128 candidates", 128, 180, null],
      ["4 candidates", 4, 0.2, null],
      ["9 shares", 9, 50000, null],
    ].map(([size, count, seconds, limit]) => {
      const searchPlan = plan.SearchPlan.of(size, count, seconds, limit ?? undefined);
      return {
        size,
        count,
        seconds,
        limit,
        ask: searchPlan.ask,
        tell: searchPlan.tell,
        question: searchPlan.question(),
        extent: searchPlan.extent(),
        notice: searchPlan.notice(),
        timeNotice: searchPlan.timeNotice(),
      };
    }),
    correctWrittenCopy: plan.CORRECT_WRITTEN_COPY,
    keptCount: outcome(() => turns.keptCount(0, 20, "maxShown", 1)),
    crc32: ["", "123456789", "abandon"].map((text) => [
      text,
      checksum.crc32(new TextEncoder().encode(text)),
    ]),
    selfCheck: [
      outcome(() => check.expectSame(1, 2, "Word lists")),
      outcome(() => check.expectRefused(() => 1, "x", "Case 2")),
      outcome(() =>
        // Refused, but with another message than the one expected.
        check.expectRefused(() => pieces.textPieces("01", 0), "x", "Width"),
      ),
    ],
  };
}

export async function record(ts) {
  const loaded = await modules(ts);
  return { ...textAnswers(loaded), ...codeAnswers(loaded), ...planAnswers(loaded) };
}
