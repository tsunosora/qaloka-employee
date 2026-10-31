import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { HitunganPeriode } from "./hitung";
import { LABEL_JENIS, LABEL_STATUS, labelSumber, labelTim, tanggalPendek } from "./label";

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
const jam = (n: number) => (n ? `${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })} jam` : "");

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica" },
  usaha: { fontSize: 9, color: "#475569", marginBottom: 2 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: "#334155", marginTop: 2 },
  stempel: { marginTop: 6, fontSize: 9, fontFamily: "Helvetica-Bold" },
  bagian: { marginTop: 14, marginBottom: 4, fontSize: 10, fontFamily: "Helvetica-Bold" },
  head: { flexDirection: "row", backgroundColor: "#e2e8f0", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 3 },
  cTgl: { width: "14%", paddingHorizontal: 3 },
  cStatus: { width: "10%", paddingHorizontal: 3 },
  cTempat: { width: "28%", paddingHorizontal: 3 },
  cLembur: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  cSumber: { width: "16%", paddingHorizontal: 3 },
  cUpah: { width: "22%", paddingHorizontal: 3, textAlign: "right" },
  cJenis: { width: "20%", paddingHorizontal: 3 },
  cCatatan: { width: "44%", paddingHorizontal: 3 },
  sumRow: { flexDirection: "row", paddingVertical: 2 },
  sumLabel: { width: "70%" },
  sumNilai: { width: "30%", textAlign: "right" },
  grand: { flexDirection: "row", marginTop: 4, paddingTop: 5, borderTopWidth: 1, borderTopColor: "#94a3b8" },
  grandLabel: { width: "70%", fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandNilai: { width: "30%", textAlign: "right", fontSize: 12, fontFamily: "Helvetica-Bold" },
  ttd: { flexDirection: "row", marginTop: 34 },
  ttdKol: { width: "50%", alignItems: "center" },
  ttdGaris: { marginTop: 40, width: 150, borderTopWidth: 1, borderTopColor: "#334155" },
  catatan: { marginTop: 18, fontSize: 7, color: "#94a3b8" },
});

export type DataSlip = {
  namaUsaha: string | null;
  karyawan: { nama: string; kode: string; tim: string | null };
  hitungan: HitunganPeriode;
  /** Terisi = slip pembayaran yang sudah terjadi (angkanya salinan saat dibayar). */
  pembayaran: { dibayarAt: string; jumlah: number; oleh: string | null; catatan: string | null } | null;
  dibuatAt: string;
};

function Slip({ d }: { d: DataSlip }) {
  const h = d.hitungan;
  const r = h.ringkas;
  return (
    <Page size="A4" style={s.page}>
      {d.namaUsaha && <Text style={s.usaha}>{d.namaUsaha}</Text>}
      <Text style={s.title}>Slip Upah</Text>
      <Text style={s.sub}>
        {d.karyawan.nama} ({d.karyawan.kode}){d.karyawan.tim ? ` · ${labelTim(d.karyawan.tim)}` : ""}
      </Text>
      <Text style={s.sub}>
        Periode {tanggalPendek(h.dari)} – {tanggalPendek(h.sampai)}
      </Text>
      <Text style={s.stempel}>
        {d.pembayaran
          ? `Dibayar ${new Date(d.pembayaran.dibayarAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}${d.pembayaran.oleh ? ` oleh ${d.pembayaran.oleh}` : ""}`
          : "Belum dibayar — ringkasan perhitungan"}
      </Text>

      <Text style={s.bagian}>Rincian harian</Text>
      <View style={s.head}>
        <Text style={s.cTgl}>Tanggal</Text>
        <Text style={s.cStatus}>Status</Text>
        <Text style={s.cTempat}>Proyek / kota · divisi</Text>
        <Text style={s.cLembur}>Lembur</Text>
        <Text style={s.cSumber}>Tarif dari</Text>
        <Text style={s.cUpah}>Upah</Text>
      </View>
      {h.baris.length === 0 && (
        <View style={s.row}>
          <Text>Tidak ada hari kerja yang disetujui di periode ini.</Text>
        </View>
      )}
      {h.baris.map((b) => (
        <View key={b.id} style={s.row} wrap={false}>
          <Text style={s.cTgl}>{tanggalPendek(b.tanggal)}</Text>
          <Text style={s.cStatus}>{LABEL_STATUS[b.status]}</Text>
          <Text style={s.cTempat}>
            {b.proyek ?? ([b.kota, b.divisi].filter(Boolean).join(" · ") || "-")}
            {b.upahKhusus ? `\n+ upah khusus ${rp(b.upahKhusus)}${b.upahKhususCatatan ? ` (${b.upahKhususCatatan})` : ""}` : ""}
          </Text>
          <Text style={s.cLembur}>{jam(b.lemburJam)}</Text>
          <Text style={s.cSumber}>{labelSumber(b.sumberTarif)}</Text>
          <Text style={s.cUpah}>{rp(b.upah)}</Text>
        </View>
      ))}

      {h.penyesuaian.length > 0 && (
        <>
          <Text style={s.bagian}>Penyesuaian</Text>
          <View style={s.head}>
            <Text style={s.cTgl}>Tanggal</Text>
            <Text style={s.cJenis}>Jenis</Text>
            <Text style={s.cCatatan}>Catatan</Text>
            <Text style={s.cUpah}>Jumlah</Text>
          </View>
          {h.penyesuaian.map((p) => (
            <View key={p.id} style={s.row} wrap={false}>
              <Text style={s.cTgl}>{tanggalPendek(p.tanggal)}</Text>
              <Text style={s.cJenis}>{LABEL_JENIS[p.jenis]}</Text>
              <Text style={s.cCatatan}>{p.catatan ?? "-"}</Text>
              <Text style={s.cUpah}>{rp(p.nilai)}</Text>
            </View>
          ))}
        </>
      )}

      <Text style={s.bagian}>Ringkasan</Text>
      <View style={s.sumRow}>
        <Text style={s.sumLabel}>
          Hadir {r.hadir} hari · ½ hari {r.setengah} · absen {r.absen} · lembur {jam(r.lemburJam) || "0 jam"}
        </Text>
        <Text style={s.sumNilai} />
      </View>
      <View style={s.sumRow}>
        <Text style={s.sumLabel}>Upah pokok</Text>
        <Text style={s.sumNilai}>{rp(r.upahPokok)}</Text>
      </View>
      <View style={s.sumRow}>
        <Text style={s.sumLabel}>Upah lembur</Text>
        <Text style={s.sumNilai}>{rp(r.upahLembur)}</Text>
      </View>
      {r.upahKhusus !== 0 && (
        <View style={s.sumRow}>
          <Text style={s.sumLabel}>Upah khusus</Text>
          <Text style={s.sumNilai}>{rp(r.upahKhusus)}</Text>
        </View>
      )}
      {r.penyesuaian !== 0 && (
        <View style={s.sumRow}>
          <Text style={s.sumLabel}>Penyesuaian</Text>
          <Text style={s.sumNilai}>{rp(r.penyesuaian)}</Text>
        </View>
      )}
      <View style={s.grand}>
        <Text style={s.grandLabel}>{d.pembayaran ? "Total dibayar" : "Total"}</Text>
        <Text style={s.grandNilai}>{rp(d.pembayaran ? d.pembayaran.jumlah : r.total)}</Text>
      </View>
      {d.pembayaran?.catatan && <Text style={s.sub}>Catatan: {d.pembayaran.catatan}</Text>}

      <View style={s.ttd}>
        <View style={s.ttdKol}>
          <Text>Yang menyerahkan</Text>
          <View style={s.ttdGaris} />
        </View>
        <View style={s.ttdKol}>
          <Text>Yang menerima</Text>
          <View style={s.ttdGaris} />
          <Text>{d.karyawan.nama}</Text>
        </View>
      </View>
      <Text style={s.catatan}>Dibuat {d.dibuatAt} · Qaloka Employee</Text>
    </Page>
  );
}

export async function buatSlipPdf(daftar: DataSlip[]): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      {daftar.map((d, i) => (
        <Slip key={i} d={d} />
      ))}
    </Document>,
  );
}
