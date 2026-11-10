import { describe, it, expect } from "vitest";
import {
  kunciBocor,
  serialAnakRingkas,
  serialHariAbsen,
  serialIzinGuru,
  serialJurnalGuru,
  serialRaporRingkas,
  serialScan,
  serialSideQuest,
  serialTugasGuru,
  serialHarianGuru,
} from "@/lib/services/magang/pantau";

/** Kunci terlarang yang diminta (brief): dicek tanpa peduli huruf besar. */
const TERLARANG = ["hp", "phone", "publicToken", "portalPin", "pin", "machinePin", "salary", "upah", "poin", "lat", "lng", "latitude", "longitude", "catatan"];

function semuaKunci(v: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => semuaKunci(x, acc));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      acc.add(k.toLowerCase());
      semuaKunci(x, acc);
    }
  }
  return acc;
}

function aman(nilai: unknown) {
  const kunci = semuaKunci(JSON.parse(JSON.stringify(nilai)));
  for (const k of TERLARANG) expect(kunci.has(k.toLowerCase()), `kunci terlarang "${k}"`).toBe(false);
  expect(kunciBocor(nilai)).toEqual([]);
}

// Masukan sengaja MEMBAWA kolom rahasia (seperti baris Prisma lengkap) — keluaran tidak boleh menyalinnya.
const employeeLengkap = {
  fullName: "Anak Uji Satu",
  nickname: "Satu",
  isActive: true,
  phone: "0800000000",
  publicToken: "tok-rahasia",
  portalPin: "$2a$hash",
  machinePin: "123",
  employeeCode: "EMP-1",
  salary: 1000000,
  upahHarian: 50000,
};

describe("serializer guru tidak membocorkan data", () => {
  it("kartu anak", () => {
    const out = serialAnakRingkas({
      peserta: { id: 1, jurusan: "DKV", mulai: "2026-11-09", selesai: null, aktif: true, employee: employeeLengkap, catatan: "internal", kontakGuru: "08xx", hp: "08yy" } as never,
      posIni: { nama: "Produksi", lokasi: "Gudang", lat: -7.8, lng: 110.3 } as never,
      kehadiran: { hariKerja: 5, hadir: 4, izin: 0, alpa: 1, persen: 80 },
      jurnal: { terisi: 3, dari: 5, persen: 60 } as never,
      sideQuest: { selesai: 2, total: 10, poin: 20, poinMaks: 100 } as never,
    });
    aman(out);
    expect(out.nama).toBe("Satu");
    expect(out.sideQuest).toEqual({ selesai: 2, total: 10 });
  });

  it("scan HP: nama lokasi + jarak + URL foto, tanpa koordinat/perangkat/akurasi", () => {
    const s = serialScan(
      { scanDate: new Date("2026-11-09T07:58:00"), machineName: "hp" },
      { id: 9, jarakM: 23, lokasi: { nama: "Toko Pusat" }, lat: -7.8, lng: 110.3, perangkat: "abc", akurasiM: 12 } as never,
      (id) => `/x/${id}`
    );
    expect(s).toEqual({ jam: "07:58", sumber: "HP", lokasi: "Toko Pusat", jarakM: 23, fotoUrl: "/x/9" });
    aman(serialHariAbsen({ tanggal: "2026-11-09", masuk: "07:58", pulang: null, status: "hadir", terlambatMenit: 0, keterangan: null, scan: [s] }));
    const mesin = serialScan({ scanDate: new Date("2026-11-09T16:00:00"), machineName: "Mesin Toko" }, null, (id) => `/x/${id}`);
    expect(mesin).toEqual({ jam: "16:00", sumber: "Mesin", lokasi: null, jarakM: null, fotoUrl: null });
  });

  it("jurnal, izin (lampiran mengikuti setelan), tugas, side quest, rapor", () => {
    aman(serialJurnalGuru({ id: 1, tanggal: "2026-11-09", pos: "A", kegiatan: "x", kendala: null, komentar: "bagus", dicek: true, jumlahFoto: 2, foto: ["a/b.jpg"] } as never, (j, n) => `/j/${j}/${n}`));
    const izin = { id: 3, type: "Sakit", startDate: "2026-11-10", endDate: "2026-11-10", reason: "demam", status: "approved", decisionNote: null, lampiran: [{ id: 4, nama: "surat.pdf", tipe: "application/pdf", path: "2026-11/x.pdf" }] };
    const tanpa = serialIzinGuru(izin as never, false, (a, b) => `/l/${a}/${b}`);
    expect(tanpa.lampiran).toEqual([]);
    expect(tanpa.jumlahLampiran).toBe(1);
    const dengan = serialIzinGuru(izin as never, true, (a, b) => `/l/${a}/${b}`);
    expect(dengan.lampiran).toEqual([{ id: 4, nama: "surat.pdf", tipe: "application/pdf", url: "/l/3/4" }]);
    aman([tanpa, dengan]);
    expect(JSON.stringify(dengan)).not.toContain("2026-11/x.pdf");
    aman(
      serialTugasGuru({ senin: "2026-11-09", pos: "A", dikirimAt: "2026-11-14T10:00:00.000Z", terlambat: false, nilai: 80, predikat: "Baik", catatanPembimbing: "ok", dinilaiAt: "x", ingatan: "tulisan anak", kuis: [{ jawab: 1 }] } as never)
    );
    const sq = serialSideQuest(
      { kategori: [{ kategori: "cs", label: "CS", selesai: 1, menunggu: 0, total: 3, poin: 10, poinMaks: 30 }] as never, selesai: 1, total: 3, poin: 10 } as never,
      [{ judul: "Misi", kategoriLabel: "CS", tanggal: null, poin: 10 } as never]
    );
    aman(sq);
    aman(serialRaporRingkas({ nilaiAkhir: 80, predikat: "Baik", tugasDikirim: 2, tugasTerlambat: 0, mingguBerjalan: 2, baris: [{ nama: "A", mulai: "2026-11-09", minggu: 2, nilai: 80, predikat: "Baik", tugasDikirim: 2, posId: 1 } as never] }));
  });

  it("tugas harian: tanpa catatan pembina / id pengecualian", () => {
    const h = { pesertaId: 1, tanggal: "2026-11-10", keadaan: "tugas", tugas: "konten", tugasPola: "produksi", rekanId: 2, rekan: "Dua", sendiri: false, libur: false, sumber: "pengecualian", tingkat: "pasangan", pengecualianId: 7, pasanganId: 3, catatan: "internal" } as const;
    const out = serialHarianGuru([h]);
    aman(out);
    expect(out).toEqual([{ tanggal: "2026-11-10", keadaan: "tugas", tugas: "konten", rekan: "Dua", sendiri: false }]);
  });

  it("pendeteksi kunci terlarang memang menangkap kebocoran (kontrol)", () => {
    expect(kunciBocor({ a: [{ b: { phone: "x" } }], lat: 1 })).toEqual(expect.arrayContaining(["phone", "lat"]));
  });
});
