import { describe, expect, it } from "vitest";
import { progressKey } from "../../src/app/state";
import { countryKey, defaultSettings, normalizeSettings } from "../../src/app/settings";

describe("country preference", () => {
  it("requires an explicit country for new users", () => {
    expect(defaultSettings.country).toBeNull();
  });
  it("preserves Germany and Italy choices", () => {
    expect(normalizeSettings({ country: "DE" }).country).toBe("DE");
    expect(normalizeSettings({ country: "IT" }).country).toBe("IT");
  });
  it("rejects invalid countries", () => {
    expect(normalizeSettings({ country: "XX" }).country).toBeNull();
  });
  it("preserves legacy language settings", () => {
    expect(normalizeSettings({ langMode: "de" }).lang).toBe("de");
  });
  it("keeps progress of Germany and Italy under separate keys", () => {
    expect(progressKey("DE")).toBe("progress");
    expect(progressKey("IT")).not.toBe(progressKey("DE"));
  });
  it("scopes exam and practice resume data per country, Germany keeping the original keys", () => {
    for (const base of ["exam-session", "practice-resume"]) {
      expect(countryKey(base, "DE")).toBe(base);
      expect(countryKey(base, null)).toBe(base);
      expect(countryKey(base, "IT")).not.toBe(base);
    }
  });
});
