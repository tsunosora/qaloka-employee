"use client";

import type { ReactNode } from "react";
import { IconCheck, IconPlus, IconTrash } from "@/components/ui/icons";
import { hexWarna, namaTanggal, susunPekan, warnaSelKode } from "@/lib/services/magang/konten";
import { ChipPlatform } from "@/components/magang/konten/IkonPlatform";
import { Pilihan, SelTautan, SelTeks, denganNilai, latarHex, opsiKonten, patchKode, type PatchBaris, type Saringan } from "@/components/magang/konten/TabelKonten";
import { FOKUS, latarWarna, titikWarna, type BarisJson, type DataKonten } from "@/components/magang/konten/tipe";

const WARNA_KUNING = hexWarna("kuning");

function Medan({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 rounded-xl border border-border">{children}</div>
    </div>
  );
}

/**
 * Tampilan HP (<768 px): satu kartu per baris, dikelompokkan per hari (pemisah kuning tiap Minggu seperti sheet).
 * Semua aksi tabel tersedia: konsep, status, CODE, judul, 3 tautan, caption, catatan, setujui usulan, tambah, hapus —
 * memakai penyunting yang sama dengan tabel, dengan sasaran sentuh ≥44 px.
 */
export function KartuKonten({
  data,
  saring,
  onUbah,
  onTambah,
  onHapus,
}: {
  data: DataKonten;
  saring: Saringan;
  onUbah: (b: BarisJson, patch: PatchBaris) => void;
  onTambah: ((tanggal: string) => void) | null;
  onHapus: (b: BarisJson) => void;
}) {
  const semua = data.platformId == null;
  const platform = new Map(data.platform.map((p) => [p.id, p]));
  const konsep = new Map(data.konsep.map((k) => [k.id, k]));
  const status = new Map(data.status.map((s) => [s.id, s]));
  const grup = new Map(data.grup.map((g) => [g.id, g]));
  const anak = new Map(data.anak.map((a) => [a.pesertaId, a]));
  const libur = new Map(data.libur.map((l) => [l.tanggal, l.nama]));
  const adaSaringan = saring.anak != null || saring.grup != null || saring.status != null;
  const lolos = (b: BarisJson) =>
    (saring.anak == null || b.pesertaId === saring.anak || (b.grupId != null && !!grup.get(b.grupId)?.anggota.includes(saring.anak))) &&
    (saring.grup == null || b.grupId === saring.grup) &&
    (saring.status == null || b.statusId === saring.status);
  const item = susunPekan(data.bulan, data.baris.filter(lolos), libur);
  const opsi = opsiKonten(data);

  const isi: ReactNode[] = [];
  let no = 0;
  for (const it of item) {
    if (it.jenis === "minggu") {
      if (!adaSaringan || it.baris.length)
        isi.push(
          <li key={`m-${it.tanggal}`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-fg" style={latarHex(WARNA_KUNING, 55)}>
            {namaTanggal(it.tanggal)}
          </li>
        );
      continue;
    }
    if (it.baris.length === 0 && adaSaringan) continue;
    const tgl = namaTanggal(it.tanggal);
    isi.push(
      <li key={it.tanggal}>
        <section aria-label={tgl} className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-2 px-1">
            <h3 className="font-display text-sm font-bold text-fg">{tgl}</h3>
            {onTambah && (
              <button type="button" onClick={() => onTambah(it.tanggal)} className={`btn-ghost h-11 shrink-0 px-3 text-xs ${FOKUS}`} aria-label={`Tambah baris ${tgl}`}>
                <IconPlus className="text-[15px]" aria-hidden="true" /> Tambah
              </button>
            )}
          </div>
          {it.baris.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted">
              {it.libur ? <span className="font-semibold text-danger">Libur: {it.libur}</span> : "Belum ada jadwal."}
            </p>
          )}
          {it.baris.map((b) => {
            no++;
            const k = konsep.get(b.konsepId);
            const s = status.get(b.statusId);
            const g = b.grupId != null ? grup.get(b.grupId) : undefined;
            const a = b.pesertaId != null ? anak.get(b.pesertaId) : undefined;
            const pf = platform.get(b.platformId);
            const kode = g ? g.nama : a ? (a.kode != null ? String(a.kode) : "–") : "";
            const nama = g ? g.anggota.map((p) => anak.get(p)?.panggilan).filter(Boolean).join(", ") : (a?.panggilan ?? "");
            const nilaiKode = b.grupId != null ? `g:${b.grupId}` : b.pesertaId != null ? `p:${b.pesertaId}` : "";
            const label = `${tgl}${it.baris.length > 1 ? ` baris ${no}` : ""}`;
            return (
              <article key={b.id} aria-label={`Konten ${label}`} className={`glass space-y-2.5 rounded-2xl p-3 ${s?.final ? "ring-1 ring-success/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold tabular text-muted">#{no}</span>
                  {semua && pf && <ChipPlatform p={pf} kecil />}
                  {b.usulan && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning" style={{ background: "color-mix(in oklab, var(--warning) 18%, transparent)" }}>
                      Usulan
                    </span>
                  )}
                  {s?.final && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <IconCheck className="text-[13px]" aria-hidden="true" /> Selesai
                    </span>
                  )}
                </div>

                <Medan label="Klasifikasi konsep">
                  <div className="rounded-xl" style={latarWarna(k?.warna, 42)}>
                    <Pilihan
                      besar
                      label={`Klasifikasi konsep ${label}`}
                      nilai={String(b.konsepId)}
                      opsi={denganNilai(opsi.konsep, String(b.konsepId), { label: k?.label ?? "?", warna: k?.warna })}
                      onPilih={(v) => onUbah(b, { konsepId: Number(v) })}
                    >
                      <span className="block text-sm font-semibold text-fg">{k?.label ?? "(konsep dihapus)"}</span>
                    </Pilihan>
                  </div>
                </Medan>

                <div className="grid grid-cols-2 gap-2">
                  <Medan label="Status">
                    <Pilihan
                      besar
                      label={`Status ${label}`}
                      nilai={String(b.statusId)}
                      opsi={denganNilai(opsi.status, String(b.statusId), { label: s?.nama ?? "?", warna: s?.warna })}
                      onPilih={(v) => onUbah(b, { statusId: Number(v) })}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={titikWarna(s?.warna)} aria-hidden="true" />
                        <span className="truncate">{s?.nama ?? "?"}</span>
                      </span>
                    </Pilihan>
                  </Medan>
                  <Medan label="Code / grup">
                    <div className="rounded-xl" style={latarHex(warnaSelKode(k?.warna, g ? g.warna : null), 30)}>
                      <Pilihan besar label={`Kode anak atau grup ${label}`} nilai={nilaiKode} opsi={denganNilai(opsi.kode, nilaiKode, { label: kode || "?" })} onPilih={(v) => onUbah(b, patchKode(v))}>
                        <span className="block truncate text-sm text-fg">
                          <b>{kode || "–"}</b>
                          {nama && <span className="font-normal"> · {nama}</span>}
                        </span>
                      </Pilihan>
                    </div>
                  </Medan>
                </div>

                {semua && (
                  <Medan label="Platform">
                    <Pilihan
                      besar
                      label={`Platform ${label}`}
                      nilai={String(b.platformId)}
                      opsi={denganNilai(opsi.platform, String(b.platformId), { label: pf?.nama ?? "?", warna: pf?.warna, keterangan: "Diarsipkan" })}
                      onPilih={(v) => onUbah(b, { platformId: Number(v) })}
                    >
                      <span className="text-sm text-fg">{pf?.nama ?? "?"}</span>
                    </Pilihan>
                  </Medan>
                )}

                <Medan label="Judul postingan">
                  <SelTeks besar label={`Judul postingan ${label}`} nilai={b.judul} maks={200} kosong="Belum diisi" onSimpan={(v) => onUbah(b, { judul: v })} />
                </Medan>
                <Medan label="Referensi">
                  <SelTautan besar label={`Referensi ${label}`} nilai={b.ref} onSimpan={(v) => onUbah(b, { ref: v })} />
                </Medan>
                <div className="grid gap-2">
                  <Medan label="Link folder footage">
                    <SelTautan besar label={`Link folder footage ${label}`} nilai={b.linkFootage} onSimpan={(v) => onUbah(b, { linkFootage: v })} />
                  </Medan>
                  <Medan label="Link ekspor konten">
                    <SelTautan besar label={`Link ekspor konten ${label}`} nilai={b.linkEkspor} onSimpan={(v) => onUbah(b, { linkEkspor: v })} />
                  </Medan>
                </div>
                <Medan label="Caption">
                  <SelTeks besar panjang label={`Caption ${label}`} nilai={b.caption} maks={5000} kosong="Belum diisi (pakai caption brief)" onSimpan={(v) => onUbah(b, { caption: v })} />
                </Medan>
                <Medan label="Catatan pembina">
                  <SelTeks besar panjang label={`Catatan pembina ${label}`} nilai={b.catatan} maks={2000} kosong="Tidak ada catatan" onSimpan={(v) => onUbah(b, { catatan: v })} />
                </Medan>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
                  {b.usulan && (
                    <button type="button" onClick={() => onUbah(b, { usulan: false })} className={`btn-ghost h-11 px-3 text-sm text-success ${FOKUS}`} aria-label={`Setujui usulan ${label}`}>
                      <IconCheck className="text-[15px]" aria-hidden="true" /> Setujui
                    </button>
                  )}
                  <button type="button" onClick={() => onHapus(b)} className={`btn-ghost ml-auto h-11 px-3 text-sm text-danger ${FOKUS}`} aria-label={`Hapus baris ${label}`}>
                    <IconTrash className="text-[15px]" aria-hidden="true" /> Hapus
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </li>
    );
  }

  return (
    <ol className="space-y-3" aria-label={`Jadwal konten ${data.bulan}`}>
      {isi.length ? isi : <li className="glass rounded-2xl px-4 py-10 text-center text-sm text-muted">Tidak ada baris yang cocok dengan saringan.</li>}
    </ol>
  );
}
