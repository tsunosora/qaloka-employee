"use client";

import { longDate, shortDate } from "@/components/portal/ui";
import { tglPendek } from "@/components/magang/ui";
import { teksKehadiran } from "./BagianAnak";
import { STATUS_HARI, STATUS_IZIN, type DetailAnak, type KepalaPantau } from "./tipe";

const sel = "border border-border px-1.5 py-1 text-left align-top";

/**
 * Rekap satu anak untuk DICETAK (browser → simpan PDF). Semua bagian terbuka, tanpa foto & tombol,
 * warna terang (blok @media print di app/globals.css). Dipakai cetak satu anak & cetak satu sekolah.
 */
export function RekapCetak({ d, kepala }: { d: DetailAnak; kepala: KepalaPantau }) {
  return (
    <article className="space-y-4 text-[12px] leading-snug text-fg">
      <header className="border-b border-border pb-2">
        <p className="text-[11px] uppercase tracking-wide text-muted">
          Rekap magang{kepala.usaha ? ` · ${kepala.usaha}` : ""} · {kepala.sekolah}
        </p>
        <h2 className="font-display text-lg font-bold">{d.anak.namaLengkap}</h2>
        <p className="text-muted">
          {d.anak.jurusan ? `${d.anak.jurusan} · ` : ""}Masa magang {longDate(d.anak.mulai)}
          {d.anak.selesai ? ` – ${longDate(d.anak.selesai)}` : ""} · Periode rekap {longDate(d.rentang.dari)} – {longDate(d.rentang.sampai)}
        </p>
      </header>

      <section>
        <h3 className="font-bold">Ringkasan</h3>
        <p>
          Kehadiran {d.anak.kehadiran.persen == null ? "—" : `${d.anak.kehadiran.persen}%`} ({teksKehadiran(d.anak.kehadiran)}). Jurnal {d.anak.jurnal.terisi}/
          {d.anak.jurnal.dari} hari. Side quest {d.sideQuest.selesai}/{d.sideQuest.total}. Nilai akhir sementara {d.rapor.nilaiAkhir ?? "—"} ({d.rapor.predikat}).
          {d.anak.posIni ? ` Pos minggu ini: ${d.anak.posIni.nama}${d.anak.posIni.lokasi ? ` (${d.anak.posIni.lokasi})` : ""}.` : ""}
        </p>
      </section>

      {d.rapor.perPos.length > 0 && (
        <section>
          <h3 className="font-bold">Nilai per pos</h3>
          <table className="mt-1 w-full border-collapse">
            <thead>
              <tr>
                <th className={sel}>Pos</th>
                <th className={sel}>Mulai</th>
                <th className={sel}>Minggu</th>
                <th className={sel}>Nilai</th>
                <th className={sel}>Predikat</th>
              </tr>
            </thead>
            <tbody>
              {d.rapor.perPos.map((b, i) => (
                <tr key={i}>
                  <td className={sel}>{b.pos}</td>
                  <td className={sel}>{tglPendek(b.mulai)}</td>
                  <td className={sel}>{b.minggu}</td>
                  <td className={sel}>{b.nilai ?? "—"}</td>
                  <td className={sel}>{b.predikat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3 className="font-bold">Absensi</h3>
        {d.absensi.length === 0 ? (
          <p className="text-muted">Belum ada data.</p>
        ) : (
          <table className="mt-1 w-full border-collapse">
            <thead>
              <tr>
                <th className={sel}>Tanggal</th>
                <th className={sel}>Masuk</th>
                <th className={sel}>Pulang</th>
                <th className={sel}>Status</th>
                <th className={sel}>Sumber</th>
              </tr>
            </thead>
            <tbody>
              {d.absensi.map((h) => (
                <tr key={h.tanggal} style={{ breakInside: "avoid" }}>
                  <td className={sel}>{shortDate(h.tanggal)}</td>
                  <td className={sel}>{h.masuk ?? "—"}</td>
                  <td className={sel}>{h.pulang ?? "—"}</td>
                  <td className={sel}>
                    {STATUS_HARI[h.status].label}
                    {h.terlambatMenit ? ` (${h.terlambatMenit} mnt)` : ""}
                    {h.keterangan ? ` — ${h.keterangan}` : ""}
                  </td>
                  <td className={sel}>{[...new Set(h.scan.map((s) => (s.sumber === "HP" ? `HP${s.lokasi ? ` ${s.lokasi}` : ""}` : "Mesin")))].join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="font-bold">Jurnal harian</h3>
        {d.jurnal.length === 0 ? (
          <p className="text-muted">Belum ada jurnal.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {d.jurnal.map((j) => (
              <li key={j.id} style={{ breakInside: "avoid" }}>
                <b>{shortDate(j.tanggal)}</b>
                {j.pos ? ` · ${j.pos}` : ""} — {j.kegiatan}
                {j.kendala ? ` Kendala: ${j.kendala}` : ""}
                {j.komentarPembimbing ? ` Komentar pembimbing: ${j.komentarPembimbing}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-bold">Izin & sakit</h3>
        {d.izin.length === 0 ? (
          <p className="text-muted">Tidak ada.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {d.izin.map((l) => (
              <li key={l.id}>
                <b>{l.jenis}</b> {tglPendek(l.mulai)}
                {l.mulai !== l.sampai ? ` – ${tglPendek(l.sampai)}` : ""} · {STATUS_IZIN[l.status]?.label ?? l.status} — {l.alasan}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-bold">Jadwal pos</h3>
        <p>{d.jadwal.length ? d.jadwal.map((b) => `${b.pos} (${tglPendek(b.mulai)}–${tglPendek(b.sampai)})`).join(" · ") : "Belum disusun."}</p>
      </section>

      <section>
        <h3 className="font-bold">Tugas mengingat mingguan</h3>
        {d.tugas.length === 0 ? (
          <p className="text-muted">Belum ada.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {d.tugas.map((t) => (
              <li key={t.senin}>
                Minggu {tglPendek(t.senin)}
                {t.pos ? ` · ${t.pos}` : ""}: {t.dinilai ? `${t.nilai ?? "—"} (${t.predikat})` : "belum dinilai"}
                {t.terlambat ? " · terlambat" : ""}
                {t.catatanPembimbing ? ` — ${t.catatanPembimbing}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-bold">Side quest</h3>
        <p>{d.sideQuest.kategori.map((k) => `${k.label} ${k.selesai}/${k.total}`).join(" · ") || "Belum ada."}</p>
        {d.sideQuest.disetujui.length > 0 && <p className="text-muted">Selesai: {d.sideQuest.disetujui.map((m) => m.judul).join("; ")}</p>}
      </section>
    </article>
  );
}
