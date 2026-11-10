"use client";

import { useCallback, useState } from "react";
import { IconChevronDown } from "@/components/ui/icons";
import { longDate, shortDate, soft } from "@/components/portal/ui";
import { tglPendek, warnaNilai } from "@/components/magang/ui";
import { GambarMini, Lightbox } from "./Lightbox";
import { STATUS_HARI, STATUS_IZIN, type AnakRingkas, type DetailAnak, type StatusHari } from "./tipe";

export function Chip({ label, warna }: { label: string; warna: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ ...soft(warna, 18), color: warna }}>
      {label}
    </span>
  );
}

export function ChipStatusHari({ status }: { status: StatusHari }) {
  const s = STATUS_HARI[status];
  return <Chip label={s.label} warna={s.warna} />;
}

/** Bilah kemajuan + angka (warna bukan satu-satunya penanda: angkanya selalu tertulis). */
export function Bilah({ persen, warna = "var(--primary)", label }: { persen: number | null; warna?: string; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={persen ?? 0}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, persen ?? 0))}%`, background: warna }} />
    </div>
  );
}

export function warnaHadir(p: number | null): string {
  if (p == null) return "var(--fg-subtle)";
  if (p >= 90) return "var(--success)";
  if (p >= 75) return "var(--info)";
  if (p >= 60) return "var(--warning)";
  return "var(--danger)";
}

export function teksKehadiran(k: AnakRingkas["kehadiran"]): string {
  if (!k.hariKerja) return "Belum ada hari kerja di rentang ini";
  return `Hadir ${k.hadir} dari ${k.hariKerja} hari kerja${k.izin ? ` · izin/sakit ${k.izin}` : ""}${k.alpa ? ` · tanpa keterangan ${k.alpa}` : ""}`;
}

/** Bagian yang bisa dilipat (progressive disclosure). Ringkasan terbuka sejak awal. */
function Bagian({ judul, ringkas, awalBuka = false, children }: { judul: string; ringkas?: string; awalBuka?: boolean; children: React.ReactNode }) {
  const [buka, setBuka] = useState(awalBuka);
  return (
    <section className="glass rounded-2xl">
      <h3>
        <button
          type="button"
          aria-expanded={buka}
          onClick={() => setBuka(!buka)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
        >
          <span>
            <span className="block font-display text-base font-bold text-fg">{judul}</span>
            {ringkas && <span className="block text-xs text-muted">{ringkas}</span>}
          </span>
          <IconChevronDown aria-hidden="true" className={`shrink-0 text-[18px] text-muted transition-transform ${buka ? "rotate-180" : ""}`} />
        </button>
      </h3>
      {buka && <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </section>
  );
}

function Kosong({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-subtle">{children}</p>;
}

/** Isi detail satu anak di layar (cetak memakai RekapCetak). */
export function BagianAnak({ d }: { d: DetailAnak }) {
  const [besar, setBesar] = useState<{ src: string; alt: string } | null>(null);
  const buka = (src: string, alt: string) => setBesar({ src, alt });
  const tutup = useCallback(() => setBesar(null), []);
  const k = d.anak.kehadiran;
  const terlambat = d.absensi.filter((x) => x.status === "terlambat").length;

  return (
    <div className="space-y-3">
      <Bagian judul="Ringkasan" awalBuka>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-medium text-muted">Kehadiran</dt>
            <dd className="tabular font-display text-2xl font-extrabold" style={{ color: warnaHadir(k.persen) }}>
              {k.persen == null ? "—" : `${k.persen}%`}
            </dd>
            <dd className="text-xs text-muted">{teksKehadiran(k)}{terlambat ? ` · terlambat ${terlambat}×` : ""}</dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-medium text-muted">Nilai akhir sementara</dt>
            <dd className="tabular font-display text-2xl font-extrabold" style={{ color: warnaNilai(d.rapor.nilaiAkhir) }}>
              {d.rapor.nilaiAkhir ?? "—"}
            </dd>
            <dd className="text-xs text-muted">
              {d.rapor.predikat} · {d.rapor.tugasDikirim} tugas mingguan dikirim{d.rapor.tugasTerlambat ? `, ${d.rapor.tugasTerlambat} terlambat` : ""}
            </dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-medium text-muted">Jurnal harian</dt>
            <dd className="tabular font-display text-xl font-bold text-fg">
              {d.anak.jurnal.terisi} / {d.anak.jurnal.dari} hari
            </dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-medium text-muted">Side quest selesai</dt>
            <dd className="tabular font-display text-xl font-bold text-fg">
              {d.sideQuest.selesai} / {d.sideQuest.total} misi
            </dd>
          </div>
          {d.konten && d.konten.terjadwal > 0 && (
            <div className="rounded-xl border border-border p-3">
              <dt className="text-xs font-medium text-muted">Jadwal konten</dt>
              <dd className="tabular font-display text-xl font-bold text-fg">
                {d.konten.selesai} / {d.konten.terjadwal}
              </dd>
              <dd className="text-xs text-muted">
                Konten: {d.konten.selesai} selesai dari {d.konten.terjadwal} terjadwal
              </dd>
            </div>
          )}
        </dl>
        {d.anak.posIni && (
          <p className="mt-3 text-sm text-fg">
            Pos minggu ini: <b>{d.anak.posIni.nama}</b>
            {d.anak.posIni.lokasi && <span className="text-muted"> · {d.anak.posIni.lokasi}</span>}
          </p>
        )}
        {d.rapor.perPos.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Nilai per pos</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 pr-2 font-medium">Pos</th>
                  <th className="py-1.5 pr-2 font-medium">Mulai</th>
                  <th className="py-1.5 pr-2 font-medium">Nilai</th>
                  <th className="py-1.5 font-medium">Predikat</th>
                </tr>
              </thead>
              <tbody>
                {d.rapor.perPos.map((b, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 pr-2 text-fg">{b.pos}</td>
                    <td className="py-1.5 pr-2 text-muted">{tglPendek(b.mulai)}</td>
                    <td className="tabular py-1.5 pr-2 font-semibold" style={{ color: warnaNilai(b.nilai) }}>
                      {b.nilai ?? "—"}
                    </td>
                    <td className="py-1.5 text-muted">{b.predikat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>

      <Bagian judul="Absensi" ringkas={`${d.absensi.length} hari tercatat`}>
        {d.absensi.length === 0 ? (
          <Kosong>Belum ada data absensi di rentang ini.</Kosong>
        ) : (
          <ul className="divide-y divide-border">
            {d.absensi.map((h) => (
              <li key={h.tanggal} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{shortDate(h.tanggal)}</span>
                  <span className="flex items-center gap-2">
                    {h.terlambatMenit > 0 && <span className="text-xs text-muted">{h.terlambatMenit} mnt</span>}
                    <ChipStatusHari status={h.status} />
                  </span>
                </div>
                {(h.masuk || h.pulang) && (
                  <p className="tabular mt-0.5 text-sm text-muted">
                    Masuk {h.masuk ?? "—"} · Pulang {h.pulang ?? "—"}
                  </p>
                )}
                {h.keterangan && <p className="mt-0.5 text-sm text-muted">{h.keterangan}</p>}
                {h.scan.length > 0 && (
                  <ul className="mt-1.5 space-y-1.5">
                    {h.scan.map((s, i) => (
                      <li key={i} className="flex items-center gap-3 text-xs text-muted">
                        {s.fotoUrl && <GambarMini src={s.fotoUrl} alt={`Foto absen ${shortDate(h.tanggal)} jam ${s.jam}`} onBuka={buka} />}
                        <span>
                          <span className="tabular font-semibold text-fg">{s.jam}</span> · {s.sumber === "HP" ? "Absen HP" : "Mesin sidik jari"}
                          {s.lokasi && ` · ${s.lokasi}`}
                          {s.jarakM != null && ` (${s.jarakM} m dari titik lokasi)`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      <Bagian judul="Jurnal harian" ringkas={`${d.jurnal.length} jurnal`}>
        {d.jurnal.length === 0 ? (
          <Kosong>Belum ada jurnal di rentang ini.</Kosong>
        ) : (
          <ul className="space-y-3">
            {d.jurnal.map((j) => (
              <li key={j.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">
                    {shortDate(j.tanggal)}
                    {j.pos && <span className="font-normal text-muted"> · {j.pos}</span>}
                  </span>
                  <Chip label={j.dicek ? "Sudah dicek pembimbing" : "Belum dicek"} warna={j.dicek ? "var(--success)" : "var(--fg-subtle)"} />
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-fg">{j.kegiatan}</p>
                {j.kendala && (
                  <p className="mt-1.5 text-sm text-muted">
                    <b className="text-fg">Kendala:</b> {j.kendala}
                  </p>
                )}
                {j.komentarPembimbing && (
                  <p className="mt-1.5 rounded-lg bg-surface-2 p-2 text-sm text-fg">
                    <b>Komentar pembimbing:</b> {j.komentarPembimbing}
                  </p>
                )}
                {j.foto.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {j.foto.map((f, n) => (
                      <GambarMini key={f} src={f} alt={`Foto jurnal ${shortDate(j.tanggal)} ke-${n + 1}`} onBuka={buka} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      <Bagian judul="Izin & sakit" ringkas={`${d.izin.length} pengajuan`}>
        {d.izin.length === 0 ? (
          <Kosong>Tidak ada pengajuan izin/sakit di rentang ini.</Kosong>
        ) : (
          <ul className="space-y-3">
            {d.izin.map((l) => {
              const st = STATUS_IZIN[l.status] ?? { label: l.status, warna: "var(--fg-subtle)" };
              return (
                <li key={l.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-fg">
                      {l.jenis} · {l.mulai === l.sampai ? longDate(l.mulai) : `${tglPendek(l.mulai)} – ${longDate(l.sampai)}`}
                    </span>
                    <Chip label={st.label} warna={st.warna} />
                  </div>
                  <p className="mt-1 text-sm text-fg">{l.alasan}</p>
                  {l.keputusan && <p className="mt-1 text-sm text-muted">Catatan keputusan: {l.keputusan}</p>}
                  {l.lampiran.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {l.lampiran.map((x) =>
                        x.tipe.startsWith("image/") ? (
                          <GambarMini key={x.id} src={x.url} alt={`Lampiran: ${x.nama}`} onBuka={buka} />
                        ) : (
                          <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className="btn-ghost h-11 px-3 text-sm">
                            Buka {x.nama}
                          </a>
                        )
                      )}
                    </div>
                  ) : (
                    l.jumlahLampiran > 0 && <p className="mt-1 text-xs text-subtle">Ada {l.jumlahLampiran} lampiran (tidak dibagikan ke guru).</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Bagian>

      <Bagian judul="Pos & jadwal" ringkas={`${d.jadwal.length} blok rotasi`}>
        {d.jadwal.length === 0 ? (
          <Kosong>Jadwal pos belum disusun.</Kosong>
        ) : (
          <ol className="space-y-2">
            {d.jadwal.map((b, i) => (
              <li key={i} className={`rounded-xl border p-3 text-sm ${b.sekarang ? "border-primary" : "border-border"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-fg">{b.pos}</span>
                  {b.sekarang && <Chip label="Minggu ini" warna="var(--primary)" />}
                </div>
                <p className="text-muted">
                  {tglPendek(b.mulai)} – {tglPendek(b.sampai)} · {b.minggu} minggu{b.lokasi ? ` · ${b.lokasi}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Bagian>

      <Bagian judul="Tugas mengingat mingguan" ringkas={`${d.tugas.length} minggu dikirim`}>
        {d.tugas.length === 0 ? (
          <Kosong>Belum ada tugas mingguan yang dikirim di rentang ini.</Kosong>
        ) : (
          <ul className="space-y-2">
            {d.tugas.map((t) => (
              <li key={t.senin} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-fg">
                    Minggu {tglPendek(t.senin)}
                    {t.pos && <span className="font-normal text-muted"> · {t.pos}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {t.terlambat && <Chip label="Terlambat" warna="var(--warning)" />}
                    {t.dinilai ? (
                      <span className="tabular font-display text-lg font-bold" style={{ color: warnaNilai(t.nilai) }}>
                        {t.nilai ?? "—"}
                      </span>
                    ) : (
                      <Chip label="Belum dinilai" warna="var(--fg-subtle)" />
                    )}
                  </span>
                </div>
                {t.dinilai && <p className="text-muted">{t.predikat}</p>}
                {t.catatanPembimbing && <p className="mt-1 text-fg">Catatan pembimbing: {t.catatanPembimbing}</p>}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      <Bagian judul="Side quest" ringkas={`${d.sideQuest.selesai} dari ${d.sideQuest.total} misi selesai`}>
        {d.sideQuest.kategori.length === 0 ? (
          <Kosong>Belum ada side quest.</Kosong>
        ) : (
          <ul className="space-y-3">
            {d.sideQuest.kategori.map((k) => (
              <li key={k.kunci}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-fg">{k.label}</span>
                  <span className="tabular text-muted">
                    {k.selesai}/{k.total}
                    {k.menunggu ? ` · ${k.menunggu} menunggu diperiksa` : ""}
                  </span>
                </div>
                <Bilah persen={k.total ? (k.selesai / k.total) * 100 : 0} label={`${k.label}: ${k.selesai} dari ${k.total}`} />
              </li>
            ))}
          </ul>
        )}
        {d.sideQuest.disetujui.length > 0 && (
          <>
            <h4 className="mt-4 text-sm font-semibold text-fg">Misi yang sudah disetujui</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {d.sideQuest.disetujui.map((m, i) => (
                <li key={i}>
                  <span className="text-fg">{m.judul}</span> · {m.kategori}
                  {m.tanggal ? ` · ${tglPendek(m.tanggal)}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </Bagian>

      {besar && <Lightbox src={besar.src} alt={besar.alt} onTutup={tutup} />}
    </div>
  );
}
