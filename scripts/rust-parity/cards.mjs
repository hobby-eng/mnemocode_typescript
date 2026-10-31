// The known answers of cards for the Rust port (increment 9 of its docs/design/architect/PLAN.md):
// with a fixed sequence in place of randomness, every text and image that each design draws, page
// by page, in the order and at the place that pdf-lib is told, for a public phrase and public
// shares, read from this build's own modules. Shapes are not recorded: a design's paths are compared
// on the pages themselves. The Rust port's crates/mnemocode-cards/tests/ts_cards.rs replays them.

import { wordlist } from "@scure/bip39/wordlists/english.js";
import { entropyToMnemonic } from "@scure/bip39";
import { PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { loadVectors, sequence } from "./shares.mjs";

/** The file this recorder writes in vectors/ts-0.1.0/. */
export const FILE = "cards-v1.json";

/** The public phrases of the cards, by their length. */
const PHRASES = { 12: `${"abandon ".repeat(11)}about`, 24: `${"abandon ".repeat(23)}art` };
/** The sizes of a sheet that the longer phrase is drawn on, with its QR code. */
const SHEET_SIZES = ["a5", "a4"];
/** The cases of details, forms and turns, one design each. */
const OTHER_CASES = [
  { template: "business-it", words: 12, format: "unicode" },
  { template: "material-tile", words: 12, format: "unicode" },
  { template: "business-curves", words: 24, format: "colors-unicode" },
  { template: "business-mixed", words: 12, format: "colors", title: "Sample title" },
  { template: "material-switch", words: 12, format: "colors", title: "Sample title" },
  { template: "business-estate", words: 12, format: "colors", pageSize: "a5", turn: "portrait" },
  { template: "material-kitchen", words: 12, format: "colors", pageSize: "a4", turn: "landscape" },
  {
    template: "business-contact",
    words: 12,
    format: "colors",
    profile: { name: "Ada Lovelace", company: "Sample Works", email: "ada@sample.example" },
  },
];
/** The designs and layouts of the cards of shares. */
const SHARE_CASES = [
  { template: "business-it", layout: "qr", shareFormat: "colors" },
  { template: "business-it", layout: "collection", shareFormat: "colors" },
  { template: "business-it", layout: "individual", shareFormat: "colors" },
  { template: "business-mixed", layout: "individual", shareFormat: "unicode" },
  { template: "material-vehicle", layout: "collection", shareFormat: "colors" },
  { template: "material-tile", layout: "qr", shareFormat: "unicode" },
];
/** The forms whose QR codes are recorded, and how many phrases of each length and form. */
const FORMS_OF_QR = ["colors", "unicode", "colors-unicode"];
const QR_SEEDS = 12;
/** A way through a program to the seed phrase, for the sheets for heirs. */
const ROUTE = {
  subtitle: "Made for the known answers.",
  address: "https://example.org/program",
  start: ["Open https://example.org/program and start the program."],
  decode: (mode, words, dates) => [`Read the ${words} codes in ${mode}${then(dates)}.`],
  restore: (mode, threshold, dates) => [`Type ${threshold} shares in ${mode}${then(dates)}.`],
  dateDigitHelp: "Try the digits of the date in turn.",
};

/** ", then `dates`", or nothing without dates. */
function then(dates) {
  return dates === undefined ? "" : `, then ${dates}`;
}

/** The sheets for heirs: the size, then the facts as the sheet is told them. */
const HEIR_CASES = [
  ["a5", { backup: { kind: "encoded", format: "colors", words: 12 }, mode: "direct", dates: 0 }],
  [
    "a6",
    { backup: { kind: "encoded", format: "unicode", words: 24 }, mode: "seedshift", dates: 2 },
  ],
  [
    "a5",
    {
      backup: { kind: "shares", format: "colors", threshold: 2, count: 3, codes: 11 },
      mode: "seedshift",
      dates: 1,
    },
  ],
  [
    "a6",
    {
      backup: { kind: "shares", format: "words", threshold: 3, count: 5 },
      mode: "direct",
      dates: 0,
    },
  ],
];

/** A number as the recording keeps it, to a millionth of a point. */
const rounded = (value) => Math.round(value * 1e6) / 1e6;

/** The steps of the pages drawn in the current case, by page, in the order they were drawn. */
let drawn = new Map();

/** Keeps `step` of `page`. */
function note(page, step) {
  if (!drawn.has(page)) drawn.set(page, []);
  drawn.get(page).push(step);
}

/** Makes every page of this build tell what it is asked to draw. */
function watchPages() {
  const { drawText, drawImage } = PDFPage.prototype;
  PDFPage.prototype.drawText = function drawTextWatched(text, options) {
    const { x, y, size, color } = options;
    const rgb = [color?.red ?? 0, color?.green ?? 0, color?.blue ?? 0].map(rounded);
    note(this, { text, at: [x, y, size].map(rounded), rgb });
    return drawText.call(this, text, options);
  };
  PDFPage.prototype.drawImage = function drawImageWatched(image, options) {
    const { x, y, width, height } = options;
    note(this, { image: [x, y, width, height].map(rounded) });
    return drawImage.call(this, image, options);
  };
}

/** What `draw` draws, page by page. */
async function pagesOf(draw) {
  drawn = new Map();
  await draw();
  return [...drawn].map(([page, steps]) => {
    const { width, height } = page.getSize();
    return { size: [width, height].map(rounded), steps };
  });
}

/** The modules of the build. */
async function loadModules(ts) {
  const { CardRenderer } = await ts.load("export/card-renderer.js");
  const { nodeRenderPlatform } = await ts.load("export/platform-node.js");
  const { backupCardContent } = await ts.load("export/backup-cards.js");
  const { PlannedCards, renderCards, renderIndividualCards, separateCardJob } =
    await ts.load("export/render.js");
  const { CARD_TEMPLATES } = await ts.load("export/templates.js");
  const { EncodedBackup } = await ts.load("core/encoded-backup.js");
  const { ShareCardSet } = await ts.load("export/sskr-render.js");
  const { HeirInstructions } = await ts.load("export/heir-sheet-text.js");
  const { HEIR_SHEET_FORMATS, renderHeirSheet } = await ts.load("export/heir-sheet.js");
  return {
    newDrawing: () => new CardRenderer({ ...nodeRenderPlatform, randomInt: sequence() }),
    assets: nodeRenderPlatform,
    backupCardContent,
    PlannedCards,
    renderCards,
    renderIndividualCards,
    separateCardJob,
    template: (id) => CARD_TEMPLATES.find((one) => one.id === id),
    templates: CARD_TEMPLATES,
    EncodedBackup,
    ShareCardSet,
    HeirInstructions,
    HEIR_SHEET_FORMATS,
    renderHeirSheet,
  };
}

/** The cards of one case planned as a save plans them. */
async function plannedCase(modules, drawing, given) {
  const { backup: encoded } = modules.EncodedBackup.encode(
    PHRASES[given.words],
    [],
    given.format,
    "direct",
  );
  const settings = {
    ...(given.pageSize === undefined ? {} : { pageSize: given.pageSize }),
    ...(given.turn === undefined ? {} : { orientation: given.turn }),
    ...(given.profile === undefined ? {} : { profile: given.profile }),
    ...(given.cardQr === true ? { cardQr: true } : {}),
  };
  const content = modules.backupCardContent(encoded, { settings, title: given.title });
  return modules.PlannedCards.plan(drawing, {
    template: modules.template(given.template),
    content,
  });
}

/** The sheets of one case. */
async function sheets(modules, given) {
  const drawing = modules.newDrawing();
  const pages = await pagesOf(async () => {
    const planned = await plannedCase(modules, drawing, given);
    await modules.renderCards(drawing, [planned.job]);
  });
  return { ...given, pages };
}

/** The separate cards of one case, from a plan for sheets, as `--cards-dir` draws them. */
async function separateCards(modules, given) {
  const drawing = modules.newDrawing();
  const pages = await pagesOf(async () => {
    const planned = await plannedCase(modules, drawing, given);
    const job = modules.separateCardJob(planned.job, undefined);
    await modules.renderIndividualCards(drawing, job.template, job.content);
  });
  return { ...given, separate: true, pages };
}

/** Every document of the cards of one case of shares. */
async function shareCards(modules, records, given) {
  const drawing = modules.newDrawing();
  const names = [];
  const pages = await pagesOf(async () => {
    const set = await modules.ShareCardSet.create(drawing, records, {
      style: modules.template(given.template).style,
      layout: given.layout,
      shareFormat: given.shareFormat,
    });
    for (const place of set.shares.keys())
      for await (const document of set.documents(place)) names.push(document.name);
  });
  return { ...given, names, pages };
}

/** One sheet for heirs: its two pages. */
async function heirSheet(modules, [size, facts]) {
  const text = new modules.HeirInstructions(ROUTE).text(facts);
  const pages = await pagesOf(() =>
    modules.renderHeirSheet(modules.assets, text, modules.HEIR_SHEET_FORMATS[size]),
  );
  return { size, facts, pages };
}

/** The bytes of entropy of each length of a phrase, counted from `seed`: public, made up. */
function countedPhrase(words, seed) {
  const bytes = Uint8Array.from(
    { length: (words * 4) / 3 },
    (_, at) => (seed * 37 + at * 11) & 255,
  );
  return entropyToMnemonic(bytes, wordlist);
}

/** The size of the QR code that node-qrcode gives each payload of phrases and shares. */
function qrSizes(modules, records) {
  const payloads = [...records];
  for (const words of [12, 15, 18, 21, 24])
    for (const format of FORMS_OF_QR)
      for (let seed = 0; seed < QR_SEEDS; seed += 1) {
        const phrase = countedPhrase(words, seed);
        const { backup } = modules.EncodedBackup.encode(phrase, [], format, "direct");
        payloads.push(backup.text());
      }
  return [...new Set(payloads)].map((payload) => ({
    payload,
    size: QRCode.create(payload, { errorCorrectionLevel: "M" }).modules.size,
  }));
}

/** The whole record. */
export async function record(ts) {
  const modules = await loadModules(ts);
  watchPages();
  const backups = [];
  const separate = [];
  for (const template of modules.templates) {
    const base = { template: template.id, words: 12, format: "colors" };
    backups.push(await sheets(modules, base));
    for (const pageSize of SHEET_SIZES)
      backups.push(await sheets(modules, { ...base, words: 24, pageSize, cardQr: true }));
    if (template.renderIndividual !== undefined) {
      separate.push(await separateCards(modules, base));
      separate.push(await separateCards(modules, { ...base, words: 24, format: "colors-unicode" }));
    }
  }
  for (const given of OTHER_CASES) backups.push(await sheets(modules, given));
  const records = loadVectors(ts).deterministic[0].shares.slice(0, 3);
  const shares = [];
  for (const given of SHARE_CASES) shares.push(await shareCards(modules, records, given));
  const heirs = [];
  for (const given of HEIR_CASES) heirs.push(await heirSheet(modules, given));
  return {
    backups,
    separate,
    records,
    shares,
    route: ROUTE,
    heirs,
    qrSizes: qrSizes(modules, records),
  };
}
