// The known answers of the repair of Shamir shares for the Rust port (increment 7 of its
// docs/design/architect/PLAN.md): the marks of unreadable elements, the repair of one share and of
// shares together, and the report of a repair, each read from this build's own modules, over the
// public shares of vectors/sskr-v1.json changed by a fixed sequence (shares.mjs). The Rust port's
// crates/mnemocode/tests/ts_shares.rs replays them.

import {
  loadVectors,
  madeShares,
  marked,
  markedDigits,
  outcome,
  places,
  setPlain,
  sequence,
  sharePlain,
  shareModules,
  subjects,
  symbolsOf,
  otherLayouts,
  joined,
  unitsOf,
} from "./shares.mjs";

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "share-repair-v1.json";

/** The pace of a report: digest checks a second, public and fixed, so that its times are data. */
const PACE = 1_000_000;
/** The search a date search adds to a report: combinations, and seconds for each. */
const DATE_WORK = { combinations: 3650, secondsEach: 0.5 };
/** The most combinations a recorded search tries, so that a recording takes seconds. */
const MAX_RECORDED_SEARCH = 2 ** 18;

/** The marks of `texts`, as the repair counts and refuses them. */
function marks(repair, texts) {
  return texts.map((text) => ({
    text,
    count: repair.markCount(text),
    over: repair.exceedsMarks(text, 6),
    problem: repair.markProblem(text) ?? null,
  }));
}

/** The texts that the repair of one share reads. */
function repairTexts(modules, vectors, next) {
  const { transport } = modules;
  const texts = subjects(vectors)
    .flatMap((share) => otherLayouts(modules, share))
    .flatMap((share) =>
      Array.from({ length: unitsOf(transport, share, "colors").length }, (_, place) =>
        marked(transport, share, "colors", [place]),
      ),
    );
  for (const share of subjects(vectors)) {
    for (const format of transport.SHARE_FORMATS) {
      const units = unitsOf(transport, share, format);
      const count = units.length;
      for (let place = 0; place < count; place += 1)
        texts.push(marked(transport, share, format, [place]));
      for (const size of [2, 3, 4, 6, 7])
        for (let round = 0; round < 3; round += 1)
          texts.push(marked(transport, share, format, places(next, count, size)));
      texts.push(marked(transport, share, format, [1, 9, count - 2]));
      // A wrong element beside a mark.
      const wrong = [...units];
      wrong[3] = wrong[4];
      wrong[6] = "?";
      texts.push(joined(wrong, format));
    }
    const colors = unitsOf(transport, share, "colors");
    const codes = unitsOf(transport, share, "unicode");
    const pairs = unitsOf(transport, share, "colors-unicode");
    for (const digits of [[0], [5], [1, 4], [0, 2, 4], [0, 1, 2, 3, 4]]) {
      const where = places(next, colors.length, 3);
      texts.push(markedDigits(transport, share, "colors", where, digits));
    }
    for (const digits of [[0], [3], [1, 2]]) {
      for (const size of [1, 2, 5]) {
        const where = places(next, codes.length, size);
        texts.push(markedDigits(transport, share, "unicode", where, digits));
      }
      const where = places(next, pairs.length, 2);
      texts.push(markedDigits(transport, share, "colors-unicode", where, digits));
    }
    // Whole marks read as digits, a mark joined to a code, codes run together, colors with #.
    texts.push(
      colors.map((color, place) => (place === 3 ? "??????" : color)).join(" "),
      colors.map((color, place) => (place === 3 ? "#?" : color)).join(""),
      [...colors.slice(0, 2), `#?${colors[3]}`, ...colors.slice(4)].join(" "),
      codes.map((code, place) => (place === 2 ? "????" : code)).join(" "),
      [...codes.slice(0, 2), `?${codes[3]}`, ...codes.slice(4)].join(" "),
      marked(transport, share, "unicode", [4]).replaceAll(" ", ""),
      marked(transport, share, "colors", [4]).replaceAll(" ", ""),
      marked(transport, share, "indexes", [4]).replaceAll(" ", ",\n"),
      marked(transport, share, "words", [4]).replaceAll(" ", "-"),
      marked(transport, share, "words", [4]).replaceAll(" ", ""),
    );
    // Decoy cards after a share: whole, marked, and a mark in the header too.
    texts.push(
      `${marked(transport, share, "colors", [5])} #000000`,
      `${marked(transport, share, "colors", [5])} #123456 ?`,
      `${marked(transport, share, "colors", [0])} #123456`,
      `${marked(transport, share, "unicode", [5])} 4E00`,
      `${marked(transport, share, "indexes", [5])} 7`,
    );
    // Color Unicode: whole colors, runs of marks, symbols, and decoys after them.
    const whole = unitsOf(transport, share, "colors-unicode", true);
    for (const size of [1, 2, 3]) {
      const where = places(next, whole.length, size);
      const units = whole.map((color, place) => (where.includes(place) ? "?" : color));
      texts.push(units.join(""));
    }
    texts.push(
      marked(transport, share, "colors-unicode", [2, 3]),
      marked(transport, share, "colors-unicode", [2, 3, 4, 5]),
      symbolsOf(
        unitsOf(transport, share, "colors-unicode").map((code, place) =>
          place === 4 ? "?" : code,
        ),
      ).join(""),
      symbolsOf(pairs.map((code, place) => (place === 6 || place === 7 ? "?" : code))).join(" "),
      `${whole.map((color, place) => (place === 4 ? "?" : color)).join("")}${whole[0]}`,
      `${whole.map((color, place) => (place === 4 ? "?" : color)).join("")}??`,
      "?".repeat(whole.length),
      "?".repeat(whole.length * 2),
    );
  }
  return texts;
}

/** A share's repair by the one entry that lists variants: the shares as typed, each alone. */
function repaired(ShareInput, text) {
  const input = new ShareInput({ decodeEntry: "Decode" });
  input.add([text]);
  const each = input.repairEach();
  if (each.kind === "repaired") return { shares: each.shares.map(sharePlain) };
  if (each.kind === "variants")
    return { variants: each.variants.map(sharePlain), message: each.message };
  return { message: each.message, code: each.cause.code ?? null };
}

/** The lists of marked shares that are repaired together. */
function jointLists(transport, vectors, twins, next) {
  const lists = [];
  for (const vector of vectors.deterministic)
    for (const format of transport.SHARE_FORMATS) {
      lists.push(
        vector.shares.map((share, at) => marked(transport, share, format, [2 + at, 7 + at])),
      );
      const units = unitsOf(transport, vector.shares[0], format).length;
      lists.push([
        marked(transport, vector.shares[0], format, places(next, units, 3)),
        marked(transport, vector.shares[1], format, places(next, units, 2)),
      ]);
    }
  const [first, second, third] = vectors.deterministic[0].shares;
  const [one, two, three] = vectors.deterministic[1].shares;
  const numbers = unitsOf(transport, three, "indexes").length;
  const every = Array.from({ length: numbers }, (_, place) => place);
  lists.push(
    // Six word numbers on each of three shares, the secret part of one, and one wholly unread.
    [first, second, third].map((share, at) =>
      marked(
        transport,
        share,
        "indexes",
        [1, 4, 6, 9, 12, 15].map((place) => place + at),
      ),
    ),
    [
      one,
      two,
      marked(
        transport,
        three,
        "indexes",
        every.filter((place) => place > 10),
      ),
    ],
    [one, two, marked(transport, three, "indexes", every)],
    // Two damaged copies of one share.
    [
      marked(transport, first, "colors", [2, 3, 4]),
      marked(transport, first, "colors", [5, 6, 7]),
      marked(transport, second, "colors", [8]),
    ],
    // Shares of another phrase with the same identifier.
    [
      marked(transport, twins.mine[0], "colors", [3]),
      marked(transport, twins.mine[1], "colors", [5]),
      twins.other[2],
    ],
    [
      marked(transport, twins.mine[0], "colors", [3]),
      twins.other[0],
      marked(transport, twins.mine[1], "colors", [5]),
    ],
    twins.threeOfFive.map((share, at) => marked(transport, share, "indexes", [2 + at, 9 + at])),
    [
      twins.threeOfFive[0],
      twins.threeOfFive[1],
      marked(transport, twins.threeOfFive[2], "indexes", [10, 13, 16]),
    ],
    [
      twins.threeOfFive[0],
      twins.threeOfFive[1],
      marked(transport, twins.threeOfFive[2], "indexes", [10, 13, 16, 19]),
    ],
    // Too few, repeated, foreign, unreadable, of several groups, of two lengths.
    [marked(transport, first, "indexes", [4])],
    [marked(transport, first, "indexes", [4]), first],
    [marked(transport, first, "indexes", [4]), two],
    ["not a share at all", marked(transport, second, "colors", [5])],
    [marked(transport, first, "indexes", [4]), "1 2 3"],
    [marked(transport, vectors.official.shares[0], "colors", [5]), vectors.official.shares[1]],
    [marked(transport, first, "colors", [5]), vectors.deterministic[4].shares[1]],
    // More open than a search takes, and a marked share past the limit of marks.
    [
      marked(transport, first, "indexes", [5, 6, 7, 8, 9, 10, 11, 12]),
      marked(transport, second, "indexes", [6, 7, 8, 9, 10, 11, 12, 13]),
    ],
    [`${"? ".repeat(65)}1`, first],
    // Color Unicode marks that fit several ways, and more ways than a repair tries.
    ["?".repeat(20), second],
    ["?".repeat(40), second],
    ["?".repeat(60), second],
    [
      unitsOf(transport, vectors.deterministic[4].shares[0], "colors-unicode", true)
        .map((color, place) => (place % 2 === 1 && place < 12 ? "??" : color))
        .join(""),
      vectors.deterministic[4].shares[1],
    ],
    // Shares of which nothing is read: every form and every length fits each of them.
    Array.from({ length: 5 }, () => Array(21).fill("?").join(" ")),
    // Digits read: colors and Unicode codes on both shares.
    [
      markedDigits(transport, first, "colors", [4, 5, 6], [4, 5]),
      markedDigits(transport, second, "colors", [6, 7], [3, 4, 5]),
    ],
    [marked(transport, first, "colors", [4, 5, 6]), marked(transport, second, "colors", [6, 7])],
    [
      markedDigits(transport, first, "unicode", [4, 7, 9, 12, 15], [3]),
      markedDigits(transport, second, "unicode", [5, 8, 10, 13], [2]),
    ],
    [
      markedDigits(transport, first, "unicode", [3, 5, 7, 9, 11, 13], [1, 2, 3]),
      markedDigits(transport, second, "unicode", [3, 5, 7, 9, 11, 13], [1, 2, 3]),
    ],
    twins.threeOfSix
      .slice(0, 2)
      .map((share) => markedDigits(transport, share, "unicode", [12, 14, 16, 18], [3])),
  );
  return lists;
}

/** The report of `assessment` at the recorded pace, every text of it. */
function reportOf(RepairReport, assessment, listed) {
  const report = new RepairReport(assessment, PACE, listed);
  return {
    lines: report.lines(),
    seconds: report.seconds(),
    secondsWithDates: report.seconds(DATE_WORK),
    needsQuestion: report.needsQuestion(),
    needsQuestionLimit: report.needsQuestion(1000),
    needsQuestionDates: report.needsQuestion(undefined, DATE_WORK, 100),
    question: report.searchQuestion(),
    questionWithDates: report.searchQuestion(DATE_WORK),
    extent: report.searchExtent(),
    notice: report.searchNotice(),
    noticeWithDates: report.searchNotice(DATE_WORK),
  };
}

/** The plan of `texts`, its report, and, where it is searched, its sets and the repairs. */
async function jointCase(modules, platform, texts) {
  const { joint, report } = modules;
  const listed = texts.map((_, index) => index + 2);
  const plan = await outcome(() => new joint.JointRepair(platform).plan(texts, { places: listed }));
  if (plan.refused !== undefined) return { texts, ...plan };
  const { assessment } = plan;
  const recorded = { texts, assessment, report: reportOf(report.RepairReport, assessment, listed) };
  const searched =
    (assessment.verdict === "search" || assessment.verdict === "determined") &&
    assessment.combinations <= MAX_RECORDED_SEARCH;
  if (!searched) {
    plan.wipe();
    return recorded;
  }
  const { sets: found } = await joint.searchOnce(plan);
  return {
    ...recorded,
    sets: found.map(setPlain),
    repairs: found.map((set) => ({
      list: report.RepairReport.repairs(set, listed),
      lines: report.RepairReport.repairLines(set, listed),
    })),
  };
}

/** The whole record. */
export async function record(ts) {
  const { modules, platform } = await shareModules(ts);
  const vectors = loadVectors(ts);
  const { transport, repair, input } = modules;
  const next = sequence();
  const twins = await madeShares(modules, platform);
  const texts = repairTexts(modules, vectors, next);
  const joint = [];
  for (const list of jointLists(transport, vectors, twins, next))
    joint.push(await jointCase(modules, platform, list));
  return {
    marks: marks(repair, texts),
    repairs: texts.map((text) => ({ text, ...repaired(input.ShareInput, text) })),
    joint,
  };
}
