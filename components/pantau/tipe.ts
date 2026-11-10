/** Bentuk data API pantauan guru (lib/services/magang/pantau.ts — serializer). Tipe saja, aman untuk klien. */

export type Kehadiran = { hariKerja: number; hadir: number; izin: number; alpa: number; persen: number | null };

export type AnakRingkas = {
  id: number;
  nama: string;
  namaLengkap: string;
  jurusan: string | null;
  mulai: string;
  selesai: string | null;
  aktif: boolean;
  posIni: { nama: string; lokasi: string | null } | null;
  kehadiran: Kehadiran;
  jurnal: { terisi: number; dari: number };
  sideQuest: { selesai: number; total: number } | null;
};

export type StatusHari = "hadir" | "terlambat" | "izin" | "sakit" | "alpa" | "libur";

export type HariAbsen = {
  tanggal: string;
  masuk: string | null;
  pulang: string | null;
  status: StatusHari;
  terlambatMenit: number;
  keterangan: string | null;
  scan: { jam: string; sumber: "HP" | "Mesin"; lokasi: string | null; jarakM: number | null; fotoUrl: string | null }[];
};

export type DetailAnak = {
  anak: AnakRingkas;
  rentang: { dari: string; sampai: string };
  absensi: HariAbsen[];
  jurnal: { id: number; tanggal: string; pos: string | null; kegiatan: string; kendala: string | null; komentarPembimbing: string | null; dicek: boolean; foto: string[] }[];
  izin: {
    id: number;
    jenis: string;
    mulai: string;
    sampai: string;
    alasan: string;
    status: string;
    keputusan: string | null;
    jumlahLampiran: number;
    lampiran: { id: number; nama: string; tipe: string; url: string }[];
  }[];
  jadwal: { mulai: string; sampai: string; minggu: number; pos: string; lokasi: string | null; sekarang: boolean }[];
  tugas: { senin: string; pos: string | null; dikirim: string; terlambat: boolean; dinilai: boolean; nilai: number | null; predikat: string; catatanPembimbing: string | null }[];
  konten?: { selesai: number; terjadwal: number };
  sideQuest: {
    selesai: number;
    total: number;
    kategori: { kunci: string; label: string; selesai: number; menunggu: number; total: number }[];
    disetujui: { judul: string; kategori: string; tanggal: string | null }[];
  };
  rapor: {
    nilaiAkhir: number | null;
    predikat: string;
    tugasDikirim: number;
    tugasTerlambat: number;
    mingguBerjalan: number;
    perPos: { pos: string; mulai: string; minggu: number; nilai: number | null; predikat: string; tugasDikirim: number }[];
  };
};

export type KepalaPantau = { sekolah: string; usaha: string | null; hariIni: string; awalMagang: string; tampilLampiranIzin: boolean };

export const STATUS_HARI: Record<StatusHari, { label: string; warna: string }> = {
  hadir: { label: "Hadir", warna: "var(--success)" },
  terlambat: { label: "Terlambat", warna: "var(--warning)" },
  izin: { label: "Izin", warna: "var(--info)" },
  sakit: { label: "Sakit", warna: "var(--info)" },
  alpa: { label: "Tanpa keterangan", warna: "var(--danger)" },
  libur: { label: "Libur", warna: "var(--fg-subtle)" },
};

export const STATUS_IZIN: Record<string, { label: string; warna: string }> = {
  pending: { label: "Menunggu persetujuan", warna: "var(--warning)" },
  approved: { label: "Disetujui", warna: "var(--success)" },
  rejected: { label: "Ditolak", warna: "var(--danger)" },
  cancelled: { label: "Dibatalkan", warna: "var(--fg-subtle)" },
};
