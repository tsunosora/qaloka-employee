"use client";

import { longDate } from "@/components/portal/ui";
import { ASPEK_PRAKTIK, SKALA, type AspekKey } from "@/lib/services/magang/nilai";
import { angkaId } from "@/lib/services/magang/rapor";
import type { ProgresMisi } from "@/lib/services/magang/misi";
import type { TugasAdmin } from "@/components/magang/NilaiTugas";
import type { JurnalAdmin } from "@/components/magang/DaftarJurnal";
import { tglPendek, warnaNilai } from "@/components/magang/ui";

type Baris = {
  posId: number;
  nama: string;
  mulai: string;
  minggu: number;
  tugasDikirim: number;
  nilai: number | null;
  predikat: string;
  praktik: Record<AspekKey, number | null>;
  deskripsi: string | null;
  pembimbing: string | null;
};

/** Bentuk GET /api/magang/peserta/<id>/rapor. */
export type RaporPayload = {
  peserta: {
    id: number;
    nama: string;
    panggilan: string | null;
    sekolah: string | null;
    jurusan: string | null;
    guruPembimbing: string | null;
    kontakGuru: string | null;
    mulai: string;
    selesai: string | null;
    catatan: string | null;
  };
  rapor: {
    baris: Baris[];
    nilaiAkhir: number | null;
    predikat: string;
    praktik: Record<AspekKey, number | null>;
    rataKuis: number | null;
    tugasDikirim: number;
    tugasTerlambat: number;
    mingguBerjalan: number;
    jumlahPos: number;
  };
  tugas: Omit<TugasAdmin, "nama">[];
  jurnal: { terisi: number; dari: number; persen: number | null };
  daftarJurnal: JurnalAdmin[];
  usaha: string | null;
  sideQuest: {
    progres: ProgresMisi | null;
    disetujui: { id: number; judul: string; kategori: string; kategoriLabel: string; poin: number; tanggal: string | null }[];
  };
};

/** 3.4 → "Bisa sendiri" (label skala terdekat ke bawah). */
function labelSkala(n: number | null): string {
  if (n == null) return "—";
  const s = [...SKALA].reverse().find((x) => n >= x.nilai - 0.25) ?? SKALA[0];
  return s.label;
}

/** Tanggal hari ini (zona lokal browser) "YYYY-MM-DD" untuk tanggal tanda tangan. */
function hariIniLokal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Baris target "- poin" → daftar poin tanpa tanda. */
function poin(deskripsi: string | null): string[] {
  return (deskripsi ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Isi rapor satu anak (kop s.d. tanda tangan). Dipakai /magang/rapor/<id> dan cetak per sekolah
 * (/magang/rapor/sekolah) supaya keduanya selalu sama. `onNilai` diisi → tombol Nilai/Ubah nilai
 * tampil di layar (tidak ikut tercetak).
 */
export function RaporIsi({ data, onNilai, className = "" }: { data: RaporPayload; onNilai?: (t: TugasAdmin) => void; className?: string }) {
  const { peserta: p, rapor: r } = data;
  const sq = data.sideQuest;
  const guru = [p.guruPembimbing, p.kontakGuru].filter(Boolean).join(" · ");

  return (
    <article className={`glass space-y-6 rounded-2xl p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rapor magang{data.usaha ? ` · ${data.usaha}` : ""}</p>
          <h1 className="font-display text-2xl font-bold text-fg">{p.nama}</h1>
          <p className="text-sm text-muted">{[p.sekolah, p.jurusan].filter(Boolean).join(" · ")}</p>
          {guru && <p className="text-sm text-muted">Guru pembimbing: {guru}</p>}
          <p className="text-sm text-muted">
            {longDate(p.mulai)} – {p.selesai ? longDate(p.selesai) : "sekarang"} · {r.mingguBerjalan} minggu · {r.jumlahPos} pos kerja
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold leading-none" style={{ color: warnaNilai(r.nilaiAkhir) }}>
            {r.nilaiAkhir ?? "—"}
          </p>
          <p className="text-sm font-semibold text-fg">{r.predikat}</p>
          <p className="text-xs text-muted">
            Kuis rata-rata {angkaId(r.rataKuis)} · {r.tugasDikirim} tugas{r.tugasTerlambat ? `, ${r.tugasTerlambat} terlambat` : ""}
          </p>
          <p className="text-xs text-muted">
            Jurnal harian terisi <b className="text-fg">{data.jurnal.terisi}</b> dari {data.jurnal.dari} hari kerja
            {data.jurnal.persen != null && ` (${data.jurnal.persen}%)`}
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-bold text-fg">Sikap & cara kerja (rata-rata semua pos)</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ASPEK_PRAKTIK.map((a) => (
            <div key={a.key} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted">{a.label}</p>
              <p className="font-display text-lg font-bold text-fg">
                {angkaId(r.praktik[a.key])}
                <span className="text-xs font-normal text-subtle"> / 4</span>
              </p>
              <p className="text-xs text-muted">{labelSkala(r.praktik[a.key])}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-fg">Pengalaman per pos kerja</h2>
        {r.baris.length === 0 ? (
          <p className="text-sm text-subtle">Belum ada pos yang dijalani.</p>
        ) : (
          <ol className="space-y-3">
            {r.baris.map((b, i) => (
              <li key={`${b.posId}-${b.mulai}`} className="break-inside-avoid rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-fg">
                      {i + 1}. {b.nama}
                    </h3>
                    <p className="text-xs text-muted">
                      {tglPendek(b.mulai)} · {b.minggu} minggu{b.pembimbing ? ` · pembimbing ${b.pembimbing}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold" style={{ color: warnaNilai(b.nilai) }}>
                      {b.nilai ?? "—"}
                    </p>
                    <p className="text-xs text-muted">{b.predikat}</p>
                  </div>
                </div>
                {poin(b.deskripsi).length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-fg">
                    {poin(b.deskripsi).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="break-inside-avoid">
        <h2 className="text-sm font-bold text-fg">Side Quest</h2>
        <p className="mb-2 text-xs text-muted">
          Misi tambahan di luar pos{sq.progres && sq.progres.kategori.length > 0 ? ` (${sq.progres.kategori.map((k) => k.label).join(", ")})` : ""}. Tidak mengubah nilai
          akhir.
        </p>
        {!sq.progres || sq.progres.total === 0 ? (
          <p className="text-sm text-subtle">Belum ada misi side quest yang diberikan.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {sq.progres.kategori.map((k) => (
              <div key={k.kategori} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted">{k.label}</p>
                <p className="font-display text-lg font-bold text-fg">
                  {k.selesai}
                  <span className="text-xs font-normal text-subtle"> / {k.total} misi</span>
                </p>
                <p className="text-xs text-muted">
                  {k.poin} dari {k.poinMaks} poin
                </p>
              </div>
            ))}
          </div>
        )}
        {sq.disetujui.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
            {sq.disetujui.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
                <span className="text-fg">{m.judul}</span>
                <span className="text-xs text-muted">
                  {m.kategoriLabel} · {m.poin} poin{m.tanggal ? ` · disetujui ${longDate(m.tanggal)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-fg">Catatan pembimbing per minggu</h2>
        {data.tugas.length === 0 ? (
          <p className="text-sm text-subtle">Belum ada tugas mingguan.</p>
        ) : (
          <ul className="space-y-2">
            {data.tugas.map((t) => (
              <li key={t.id} className="break-inside-avoid rounded-xl bg-surface-2 p-3 text-sm print:border print:border-border print:bg-transparent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-fg">
                    Minggu {tglPendek(t.senin)} · {t.pos}
                  </p>
                  <p className="text-xs text-muted">
                    Kuis {t.skorKuis ?? "—"} · Nilai <b style={{ color: warnaNilai(t.nilai) }}>{t.nilai ?? "belum dinilai"}</b>
                    {onNilai && (
                      <button className="ml-2 font-semibold text-primary hover:underline print:hidden" onClick={() => onNilai({ ...t, nama: p.panggilan || p.nama })}>
                        {t.dinilaiAt ? "Ubah nilai" : "Nilai"}
                      </button>
                    )}
                  </p>
                </div>
                {t.catatanPembimbing && <p className="mt-1 whitespace-pre-wrap text-fg">{t.catatanPembimbing}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kolom tanda tangan — rapor diserahkan ke sekolah & dipakai melamar kerja. */}
      <section className="break-inside-avoid border-t border-border pt-5">
        <p className="text-right text-sm text-muted">{longDate(hariIniLokal())}</p>
        <div className="mt-2 grid grid-cols-2 gap-8 text-center text-sm text-fg">
          {["Pembimbing", data.usaha ? `Pimpinan ${data.usaha}` : "Pimpinan"].map((jabatan) => (
            <div key={jabatan}>
              <p>{jabatan}</p>
              <div className="mx-auto mt-16 w-48 border-b border-border-strong" />
              <p className="mt-1 text-xs text-muted">nama &amp; tanda tangan</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
