import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Rapor magang (dan halaman lain) dicetak dengan palet terang walau tema layar gelap — tema bawaan aplikasi
 * gelap, dan cetakan berlatar hitam tidak layak diserahkan ke sekolah (temuan simulasi magang 7 Nov 2026).
 */
const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");

function blokCetak(): string {
  const i = css.indexOf("@media print");
  expect(i, "globals.css harus punya @media print").toBeGreaterThanOrEqual(0);
  let d = 0;
  for (let k = css.indexOf("{", i); k < css.length; k++) {
    if (css[k] === "{") d++;
    else if (css[k] === "}" && --d === 0) return css.slice(i, k + 1);
  }
  throw new Error("blok @media print tidak tertutup");
}

describe("cetak selalu terang", () => {
  it("blok @media print menimpa token tema gelap", () => {
    const b = blokCetak();
    expect(b).toMatch(/\.dark/);
    expect(b).toMatch(/color-scheme:\s*light/);
    expect(b).toMatch(/--bg:\s*#ffffff/i);
    expect(b).toMatch(/--fg:\s*#18181b/i);
  });
  it("blok cetak ada SESUDAH token gelap & terang (urutan menentukan yang menang)", () => {
    expect(css.indexOf("@media print")).toBeGreaterThan(css.indexOf(".light {"));
  });
});
