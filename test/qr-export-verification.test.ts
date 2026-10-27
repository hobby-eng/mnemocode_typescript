import QRCode from "qrcode";
import { PNG } from "pngjs";
import { join } from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportQrPayload } from "../src/export/qr-image.js";
import { decodeQrPngFile } from "../src/cli/qr-input.js";
import { saveQrInside } from "../src/cli/qr-export.js";
import { questionsOnPrivateScreen, seen, terminal } from "./helpers/question-terminal.js";
import { testFolder } from "./helpers/test-folders.js";

const harness = await vi.hoisted(async () => import("./helpers/question-terminal.js"));
vi.mock("node:tty", async (original) => harness.replacedTty(await original()));
vi.mock("../src/cli/terminal-input.js", async (original) =>
  harness.replacedTerminalInput(await original()),
);

questionsOnPrivateScreen();
afterEach(() => vi.restoreAllMocks());

const PAYLOAD = "public expected QR payload";
const OTHER_PAYLOAD = "public wrong QR payload";

describe("automatic QR verification", () => {
  it.each(["wrong", "unreadable"] as const)(
    "refuses a %s QR image without publishing it or exposing its payload",
    async (kind) => {
      const folder = await testFolder("mnemocode-qr-verify-");
      const png =
        kind === "wrong" ? await QRCode.toBuffer(OTHER_PAYLOAD) : Buffer.from("broken PNG");
      vi.spyOn(QRCode, "toBuffer").mockImplementationOnce(async () => png);
      const failure = exportQrPayload(PAYLOAD, join(folder, "qr.png"));
      await expect(failure).rejects.toMatchObject({
        code: "export.qr-image.qr-verification-failed",
      });
      await expect(failure).rejects.toThrow("QR verification failed");
      await expect(failure).rejects.not.toThrow(PAYLOAD);
      await expect(failure).rejects.not.toThrow(OTHER_PAYLOAD);
      expect(png.every((byte) => byte === 0)).toBe(true);
      expect(await readdir(folder)).toEqual([]);
    },
  );

  it("offers to regenerate a mismatching image and reports verification only after success", async () => {
    const folder = await testFolder("mnemocode-qr-retry-");
    const wrong = await QRCode.toBuffer(OTHER_PAYLOAD);
    const draw = vi.spyOn(QRCode, "toBuffer").mockImplementationOnce(async () => wrong);
    terminal.choices = ["Try again"];
    const path = await saveQrInside(PAYLOAD, folder);
    expect(path).toBe(join(folder, "qr.png"));
    expect(draw).toHaveBeenCalledTimes(2);
    expect(await decodeQrPngFile(join(folder, "qr.png"))).toBe(PAYLOAD);
    expect(seen.notices.join("\n")).toContain("QR verification failed");
    expect(seen.notices.join("\n")).toContain("QR code verified");
    expect(seen.notices.join("\n")).not.toContain(OTHER_PAYLOAD);
  });

  it("never reports verification when the failed image is skipped", async () => {
    const folder = await testFolder("mnemocode-qr-skip-");
    const wrong = await QRCode.toBuffer(OTHER_PAYLOAD);
    vi.spyOn(QRCode, "toBuffer").mockImplementationOnce(async () => wrong);
    terminal.choices = ["Skip"];
    expect(await saveQrInside(PAYLOAD, folder)).toBeUndefined();
    expect(seen.notices.join("\n")).not.toContain("QR code verified");
    expect(await readdir(folder)).toEqual([]);
  });
});

describe("the saved QR image", () => {
  it("leaves the quiet zone of ISO/IEC 18004, four modules, on every side", async () => {
    const path = join(await testFolder("mnemocode-qr-quiet-"), "qr.png");
    await exportQrPayload(PAYLOAD, path);
    expect(await decodeQrPngFile(path)).toBe(PAYLOAD);
    const image = PNG.sync.read(await readFile(path));
    // The dark pixels span the whole symbol: its finder patterns fill three of its corners.
    let [left, right, top, bottom] = [image.width, 0, image.height, 0];
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++)
        if (image.data[(y * image.width + x) * 4]! < 128) {
          [left, right] = [Math.min(left, x), Math.max(right, x)];
          [top, bottom] = [Math.min(top, y), y];
        }
    const modules = QRCode.create(PAYLOAD, { errorCorrectionLevel: "M" }).modules.size;
    const modulePixels = (right - left + 1) / modules;
    const quiet = [left, image.width - 1 - right, top, image.height - 1 - bottom].map((pixels) =>
      Math.round(pixels / modulePixels),
    );
    expect(quiet).toEqual([4, 4, 4, 4]);
  });

  it("still reads an image with the one-module quiet zone that MnemoCode 0.1.0 saved", async () => {
    const path = join(await testFolder("mnemocode-qr-former-"), "qr.png");
    const former = { errorCorrectionLevel: "M", margin: 1, type: "png", width: 720 } as const;
    await writeFile(path, await QRCode.toBuffer(PAYLOAD, former));
    expect(await decodeQrPngFile(path)).toBe(PAYLOAD);
  });
});
