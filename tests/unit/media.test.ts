import { describe, expect, it } from "vitest";
import { checkMedia, sniff } from "../../src/lib/shared/media";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const mp4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypmp42")]);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("media intake", () => {
  it("detects types by magic bytes", () => {
    expect(sniff(png)?.mime).toBe("image/png");
    expect(sniff(jpeg)?.mime).toBe("image/jpeg");
    expect(sniff(webp)?.mime).toBe("image/webp");
    expect(sniff(mp4)?.kind).toBe("video");
    expect(sniff(webm)?.mime).toBe("video/webm");
    expect(sniff(svg)).toBeNull();
  });
  it("accepts valid files with a content-addressed key", async () => {
    const r = await checkMedia("sign 01.png", png);
    expect(r.ok).toBe(true);
    expect(r.result!.key).toMatch(/^media\/[0-9a-f]{64}\.png$/);
  });
  it("rejects SVG, disguised files, path tricks and oversized files", async () => {
    expect((await checkMedia("x.svg", svg)).ok).toBe(false);
    expect((await checkMedia("photo.png", jpeg)).errors).toContain("extension does not match content (content is image/jpeg)");
    expect((await checkMedia("../../etc.png", png)).errors).toContain("file name contains unsupported characters");
    const big = new Uint8Array(2 * 1024 * 1024 + 1); big.set(png);
    expect((await checkMedia("big.png", big)).errors).toContain("image larger than 2 MB");
  });
});
