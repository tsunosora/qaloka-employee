/**
 * Nama sekolah diketik anak sendiri → satu sekolah bisa tertulis "SMK Negeri 2 X", "Smk negeri 2 x",
 * "SMK NEGERI 2 X". Saringan & cetak per sekolah mengelompokkan dengan kunci yang sama (huruf kecil,
 * spasi dirapatkan). MySQL (collation *_ci) juga membandingkan tanpa peduli huruf besar, jadi
 * `where: { sekolah: <salah satu tulisan> }` sudah mencakup semua variannya. MURNI.
 */

export function kunciSekolah(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function sekolahSama(a: string | null | undefined, b: string | null | undefined): boolean {
  return kunciSekolah(a) === kunciSekolah(b);
}

/**
 * Daftar sekolah unik untuk pilihan saringan: satu entri per kunci, tulisan yang paling sering dipakai
 * (seri → yang muncul pertama) sebagai label, plus jumlah anaknya. Kosong dilewati. Urut abjad.
 */
export function daftarSekolah(nilai: readonly (string | null | undefined)[]): { kunci: string; label: string; jumlah: number }[] {
  const grup = new Map<string, Map<string, number>>();
  for (const v of nilai) {
    const k = kunciSekolah(v);
    if (!k) continue;
    const tulisan = (v ?? "").trim().replace(/\s+/g, " ");
    const g = grup.get(k) ?? new Map<string, number>();
    g.set(tulisan, (g.get(tulisan) ?? 0) + 1);
    grup.set(k, g);
  }
  return [...grup.entries()]
    .map(([kunci, g]) => {
      const [label] = [...g.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
      return { kunci, label, jumlah: [...g.values()].reduce((s, n) => s + n, 0) };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}
