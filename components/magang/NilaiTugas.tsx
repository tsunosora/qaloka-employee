"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCheck, IconX } from "@/components/ui/icons";
import { ASPEK_PRAKTIK, SKALA, nilaiMinggu, type AspekKey } from "@/lib/services/magang/nilai";
import { PilihSkala, Pesan, tglPendek, warnaNilai } from "./ui";

export type TugasAdmin = {
  id: number;
  senin: string;
  nama: string;
  pos: string;
  posId?: number | null;
  ingatan: string;
  kuis: { soalId: number; pertanyaan: string; pilihan: string[]; benar: number; dipilih: number | null }[];
  skorKuis: number | null;
  terlambat: boolean;
  dikirimAt: string;
  nilaiIngatan: number | null;
  praktik: Record<AspekKey, number | null>;
  nilai: number | null;
  catatanPembimbing: string | null;
  dinilaiAt: string | null;
  dinilaiOleh?: string | null;
};

/**
 * Modal menilai satu tugas mingguan: baca ingatan + hasil kuis, lalu isi rubrik.
 * `apiBase` = awalan rute: dasbor `/api/magang` (login), halaman pribadi pembimbing
 * `/api/public/portal/<token>/bimbingan` (PIN). Keduanya `PATCH <apiBase>/tugas/<id>`.
 */
export function NilaiTugas({
  tugas,
  onClose,
  onSaved,
  apiBase = "/api/magang",
}: {
  tugas: TugasAdmin;
  onClose: () => void;
  onSaved: () => void;
  apiBase?: string;
}) {
  const [ingatan, setIngatan] = useState<number | null>(tugas.nilaiIngatan);
  const [praktik, setPraktik] = useState<Record<AspekKey, number | null>>(tugas.praktik);
  const [catatan, setCatatan] = useState(tugas.catatanPembimbing ?? "");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");

  const lengkap = ingatan != null && ASPEK_PRAKTIK.every((a) => praktik[a.key] != null);
  const perkiraan = nilaiMinggu({ skorKuis: tugas.skorKuis, nilaiIngatan: ingatan, praktik });

  async function simpan() {
    if (!lengkap) return;
    setBusy(true);
    setGalat("");
    try {
      await api(`${apiBase}/tugas/${tugas.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nilaiIngatan: ingatan, ...praktik, catatanPembimbing: catatan || null }),
      });
      onSaved();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan nilai.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Nilai ${tugas.nama} — minggu ${tglPendek(tugas.senin)}`} onClose={onClose} size="xl">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Pos <b className="text-fg">{tugas.pos}</b> · dikirim {new Date(tugas.dikirimAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          {tugas.terlambat && <span className="ml-2 font-semibold text-danger">terlambat</span>}
        </p>

        <section>
          <h3 className="text-sm font-bold text-fg">Yang dia ingat minggu ini</h3>
          <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm text-fg">{tugas.ingatan}</p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-fg">
            Kuis {tugas.skorKuis == null ? <span className="font-normal text-subtle">— pos ini belum punya soal</span> : `— skor ${tugas.skorKuis}`}
          </h3>
          {tugas.kuis.length > 0 && (
            <ol className="mt-1.5 space-y-1.5 text-sm">
              {tugas.kuis.map((k, i) => {
                const betul = k.dipilih === k.benar;
                return (
                  <li key={k.soalId} className="flex gap-2">
                    {betul ? <IconCheck className="mt-0.5 shrink-0 text-success" /> : <IconX className="mt-0.5 shrink-0 text-danger" />}
                    <span>
                      {i + 1}. {k.pertanyaan}
                      <span className="block text-xs text-muted">
                        Jawab: {k.dipilih == null ? "(kosong)" : k.pilihan[k.dipilih]}
                        {!betul && <> · Benar: {k.pilihan[k.benar]}</>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="space-y-4 border-t border-border pt-4">
          <PilihSkala
            label="Isi ingatannya"
            bantu="Apakah yang dia tulis benar, lengkap, dan menunjukkan dia paham alurnya?"
            nilai={ingatan}
            onChange={setIngatan}
            skala={SKALA}
          />
          {ASPEK_PRAKTIK.map((a) => (
            <PilihSkala
              key={a.key}
              label={a.label}
              bantu={a.bantu}
              nilai={praktik[a.key]}
              onChange={(n) => setPraktik((p) => ({ ...p, [a.key]: n }))}
              skala={SKALA}
            />
          ))}
          <label className="block">
            <span className="text-sm font-semibold text-fg">Catatan untuk anak (tampil di HP-nya)</span>
            <textarea
              className="input mt-1.5 min-h-24 py-2"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Apa yang sudah bagus, dan apa yang perlu dilatih minggu depan."
              maxLength={4000}
            />
          </label>
        </section>

        {galat && <Pesan jenis="galat">{galat}</Pesan>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted">
            Nilai minggu ini:{" "}
            <b className="font-display text-lg" style={{ color: warnaNilai(perkiraan) }}>
              {perkiraan ?? "—"}
            </b>
            {!lengkap && <span className="ml-1 text-xs">(isi semua rubrik)</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost h-11 text-sm sm:h-10">
              Batal
            </button>
            <button onClick={simpan} disabled={!lengkap || busy} className="btn-primary h-11 text-sm sm:h-10">
              {busy ? "Menyimpan…" : "Simpan nilai"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
