"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api, errorMessageFrom } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/magang/ui";
import { IconChevronDown, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { IKON_PLATFORM, KUNCI_IKON, geserUrutan, type KunciIkon } from "@/lib/services/magang/konten";
import { PilihWarna } from "@/components/magang/konten/SetelanKonten";
import { ChipPlatform, IkonPlatform } from "@/components/magang/konten/IkonPlatform";
import { FOKUS, type PlatformJson } from "@/components/magang/konten/tipe";

type Draf = { nama: string; warna: string; ikon: KunciIkon | null };
type Balasan = { platform: PlatformJson[] };

const DASAR = "/api/magang/konten/platform";
const tglPendek = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/**
 * "Kelola platform": tambah, ganti nama, warna & ikon, naik/turun, arsipkan/buka arsip, hapus. Hapus platform yang
 * sudah punya baris jadwal ditolak server (409 + jumlah) → dialog menawarkan "Arsipkan saja".
 */
export function DialogPlatform({ platform: awal, onClose, onUbah }: { platform: PlatformJson[]; onClose: () => void; onUbah: (daftar: PlatformJson[]) => void }) {
  const [daftar, setDaftar] = useState(awal);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [galat, setGalat] = useState("");
  const [sunting, setSunting] = useState<number | null>(null);
  const [tanyaHapus, setTanyaHapus] = useState<number | null>(null);
  const [tawarArsip, setTawarArsip] = useState<{ id: number; dipakai: number } | null>(null);

  async function jalan(kunci: string, fn: () => Promise<Balasan>, pesan: string): Promise<boolean> {
    setSibuk(kunci);
    setGalat("");
    setNotice("");
    try {
      const r = await fn();
      setDaftar(r.platform);
      setNotice(pesan);
      onUbah(r.platform);
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setSibuk(null);
    }
  }
  const kirim = (url: string, method: string, body?: unknown) => api<Balasan>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  async function hapus(p: PlatformJson) {
    setSibuk(`hapus-${p.id}`);
    setGalat("");
    setNotice("");
    try {
      const res = await fetch(`${DASAR}/${p.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof body?.dipakai === "number") {
        setTanyaHapus(null);
        setTawarArsip({ id: p.id, dipakai: body.dipakai });
        return;
      }
      if (!res.ok) throw new Error(errorMessageFrom(body, res.status));
      setDaftar((body as Balasan).platform);
      setTanyaHapus(null);
      setNotice(`Platform ${p.nama} dihapus.`);
      onUbah((body as Balasan).platform);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSibuk(null);
    }
  }

  const ids = daftar.map((p) => p.id);
  const geser = (p: PlatformJson, arah: -1 | 1) =>
    jalan(`urut-${p.id}`, () => kirim(`${DASAR}/urutan`, "PUT", { urutan: geserUrutan(ids, p.id, arah) }), `${p.nama} dipindah ${arah < 0 ? "naik" : "turun"}.`);

  return (
    <Modal title="Kelola platform" size="xl" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Platform = akun/brand tempat konten diposting. Tiap platform punya jadwal, brief, dan giliran kode anak sendiri. Konsep, status, grup, kode anak & pola hari berlaku
          untuk semua platform. Urutan di sini = urutan tab.
        </p>

        <div aria-live="polite" className={`space-y-2 ${notice || galat ? "sticky top-0 z-10 -mx-1 rounded-xl bg-bg p-1 shadow-sm" : ""}`}>
          {notice && (
            <div role="status">
              <Pesan jenis="ok">{notice}</Pesan>
            </div>
          )}
          {galat && (
            <div role="alert">
              <Pesan jenis="galat">{galat}</Pesan>
            </div>
          )}
        </div>

        {daftar.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-subtle">Belum ada platform. Tambahkan di bawah.</p>
        ) : (
          <ol className="space-y-2" aria-label="Daftar platform">
            {daftar.map((p, i) => (
              <li key={p.id} className={`rounded-xl border border-border p-3 ${p.aktif ? "" : "bg-surface-2"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-center text-xs font-bold tabular text-muted" aria-label={`Urutan ${i + 1}`}>
                    {i + 1}
                  </span>
                  <ChipPlatform p={p} />
                  <span className="text-xs text-muted">
                    {p.dipakai} baris jadwal · {p.aktif ? "aktif" : `diarsipkan${p.diarsipkanAt ? ` ${tglPendek(p.diarsipkanAt)}` : ""}`}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-1">
                    <button type="button" className={`btn-ghost h-11 w-11 justify-center p-0 ${FOKUS}`} aria-label={`Naikkan ${p.nama}`} title="Naik" disabled={i === 0 || sibuk !== null} onClick={() => geser(p, -1)}>
                      <IconChevronDown className="rotate-180 text-[18px]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-11 w-11 justify-center p-0 ${FOKUS}`}
                      aria-label={`Turunkan ${p.nama}`}
                      title="Turun"
                      disabled={i === daftar.length - 1 || sibuk !== null}
                      onClick={() => geser(p, 1)}
                    >
                      <IconChevronDown className="text-[18px]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`}
                      aria-expanded={sunting === p.id}
                      disabled={sibuk !== null}
                      onClick={() => setSunting(sunting === p.id ? null : p.id)}
                    >
                      <IconPencil className="text-[15px]" aria-hidden="true" /> Ubah
                    </button>
                    {p.aktif ? (
                      <button
                        type="button"
                        className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`}
                        disabled={sibuk !== null}
                        onClick={() => jalan(`arsip-${p.id}`, () => kirim(`${DASAR}/${p.id}/arsip`, "POST"), `${p.nama} diarsipkan (jadwalnya tetap ada).`)}
                      >
                        {sibuk === `arsip-${p.id}` ? "Mengarsipkan…" : "Arsipkan"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`}
                        disabled={sibuk !== null}
                        onClick={() => jalan(`buka-${p.id}`, () => kirim(`${DASAR}/${p.id}/buka-arsip`, "POST"), `Arsip ${p.nama} dibuka.`)}
                      >
                        {sibuk === `buka-${p.id}` ? "Membuka…" : "Buka arsip"}
                      </button>
                    )}
                    {tanyaHapus !== p.id && (
                      <button
                        type="button"
                        className={`btn-ghost h-11 px-3 text-sm text-danger ${FOKUS}`}
                        aria-label={`Hapus platform ${p.nama}`}
                        disabled={sibuk !== null}
                        onClick={() => {
                          setTawarArsip(null);
                          setTanyaHapus(p.id);
                        }}
                      >
                        <IconTrash className="text-[15px]" aria-hidden="true" /> Hapus
                      </button>
                    )}
                  </div>
                </div>

                {tanyaHapus === p.id && <KonfirmasiHapus nama={p.nama} sibuk={sibuk === `hapus-${p.id}`} onYa={() => hapus(p)} onBatal={() => setTanyaHapus(null)} />}

                {tawarArsip?.id === p.id && (
                  <div role="alert" className="mt-3 space-y-2 rounded-xl px-3 py-2.5 text-fg" style={{ background: "color-mix(in oklab, var(--warning) 16%, transparent)" }}>
                    <p>
                      <b>{p.nama}</b> tidak bisa dihapus karena dipakai <b>{tawarArsip.dipakai} baris jadwal</b>.{" "}
                      {p.aktif
                        ? "Arsipkan saja: platform disembunyikan dari tab, jadwal lamanya tetap tersimpan dan bisa dibuka lagi."
                        : "Platform ini sudah diarsipkan — jadwal lamanya tetap tersimpan dan tidak tampil di tab."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {p.aktif && (
                        <button
                          type="button"
                          className={`btn-primary h-11 px-4 text-sm ${FOKUS}`}
                          disabled={sibuk !== null}
                          onClick={async () => {
                            if (await jalan(`arsip-${p.id}`, () => kirim(`${DASAR}/${p.id}/arsip`, "POST"), `${p.nama} diarsipkan (jadwalnya tetap ada).`)) setTawarArsip(null);
                          }}
                        >
                          {sibuk === `arsip-${p.id}` ? "Mengarsipkan…" : "Arsipkan saja"}
                        </button>
                      )}
                      <button type="button" className={`btn-ghost h-11 px-4 text-sm ${FOKUS}`} onClick={() => setTawarArsip(null)}>
                        Tutup
                      </button>
                    </div>
                  </div>
                )}

                {sunting === p.id && (
                  <FormPlatform
                    awal={{ nama: p.nama, warna: p.warna, ikon: (p.ikon as KunciIkon | null) ?? null }}
                    label="Simpan"
                    sibuk={sibuk === `ubah-${p.id}`}
                    nonaktif={sibuk !== null}
                    onBatal={() => setSunting(null)}
                    onSimpan={async (d) => {
                      // Hanya kolom yang berubah yang dikirim (PATCH sebagian).
                      const ubah: Partial<Draf> = {};
                      if (d.nama.trim() !== p.nama) ubah.nama = d.nama.trim();
                      if (d.warna !== p.warna) ubah.warna = d.warna;
                      if (d.ikon !== p.ikon) ubah.ikon = d.ikon;
                      if (Object.keys(ubah).length === 0) return setSunting(null);
                      if (await jalan(`ubah-${p.id}`, () => kirim(`${DASAR}/${p.id}`, "PATCH", ubah), `Platform ${d.nama.trim()} disimpan.`)) setSunting(null);
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        <section aria-labelledby="platform-baru" className="rounded-xl border border-dashed border-border-strong p-3">
          <h3 id="platform-baru" className="font-semibold text-fg">
            Tambah platform
          </h3>
          <FormPlatform
            key={daftar.length}
            awal={{ nama: "", warna: "putih", ikon: null }}
            label="Tambah platform"
            sibuk={sibuk === "baru"}
            nonaktif={sibuk !== null}
            onSimpan={(d) => jalan("baru", () => kirim(DASAR, "POST", { nama: d.nama.trim(), warna: d.warna, ikon: d.ikon }), `Platform ${d.nama.trim()} ditambahkan.`)}
          />
        </section>
      </div>
    </Modal>
  );
}

function KonfirmasiHapus({ nama, sibuk, onYa, onBatal }: { nama: string; sibuk: boolean; onYa: () => void; onBatal: () => void }) {
  const batal = useRef<HTMLButtonElement>(null);
  useEffect(() => batal.current?.focus(), []);
  return (
    <div role="group" aria-label={`Konfirmasi hapus platform ${nama}`} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
      <span className="font-semibold text-fg">Hapus “{nama}”? Hanya bisa bila belum ada jadwal.</span>
      <button type="button" className={`btn-ghost h-11 px-3 text-sm text-danger ${FOKUS}`} disabled={sibuk} onClick={onYa}>
        {sibuk ? "Menghapus…" : "Ya, hapus"}
      </button>
      <button ref={batal} type="button" className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`} disabled={sibuk} onClick={onBatal}>
        Batal
      </button>
    </div>
  );
}

function FormPlatform({
  awal,
  label,
  sibuk,
  nonaktif,
  onSimpan,
  onBatal,
}: {
  awal: Draf;
  label: string;
  sibuk: boolean;
  nonaktif: boolean;
  onSimpan: (d: Draf) => void;
  onBatal?: () => void;
}) {
  const id = useId();
  const [d, setD] = useState(awal);
  const salahNama = d.nama.trim().length > 0 && d.nama.trim().length < 2;
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.nama.trim().length >= 2) onSimpan(d);
      }}
    >
      <div>
        <label htmlFor={`${id}-n`} className="text-sm font-semibold text-fg">
          Nama platform
        </label>
        <input
          id={`${id}-n`}
          className={`input mt-1.5 h-11 ${salahNama ? "border-danger" : ""}`}
          value={d.nama}
          maxLength={80}
          placeholder="mis. Voliko Sport"
          aria-invalid={salahNama}
          aria-describedby={salahNama ? `${id}-g` : undefined}
          onChange={(e) => setD({ ...d, nama: e.target.value })}
        />
        {salahNama && (
          <p id={`${id}-g`} className="mt-1 text-xs text-danger">
            Nama minimal 2 huruf.
          </p>
        )}
      </div>
      <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
      <PilihIkon nilai={d.ikon} onPilih={(ikon) => setD({ ...d, ikon })} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`btn-primary h-11 px-4 text-sm ${FOKUS}`} disabled={nonaktif || d.nama.trim().length < 2}>
          {!onBatal && <IconPlus className="text-[16px]" aria-hidden="true" />} {sibuk ? "Menyimpan…" : label}
        </button>
        {onBatal && (
          <button type="button" className={`btn-ghost h-11 px-4 text-sm ${FOKUS}`} disabled={sibuk} onClick={onBatal}>
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

/** Pilihan ikon ala radio (panah untuk berpindah); "Tanpa ikon" = null. Nama ikon tertulis. */
function PilihIkon({ nilai, onPilih }: { nilai: KunciIkon | null; onPilih: (v: KunciIkon | null) => void }) {
  const id = useId();
  const opsi: (KunciIkon | null)[] = [null, ...KUNCI_IKON];
  const idx = opsi.indexOf(nilai);
  function tombol(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = opsi.length;
    const ke = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : -1;
    if (ke < 0) return;
    e.preventDefault();
    onPilih(opsi[ke]);
    (e.currentTarget.parentElement?.children[ke] as HTMLElement | undefined)?.focus();
  }
  return (
    <div>
      <span id={id} className="text-sm font-semibold text-fg">
        Ikon <span className="text-xs font-normal text-muted">(hiasan, boleh tanpa ikon)</span>
      </span>
      <div role="radiogroup" aria-labelledby={id} className="mt-1.5 flex flex-wrap gap-1">
        {opsi.map((k, i) => {
          const pilih = k === nilai;
          const nama = k ? IKON_PLATFORM[k] : "Tanpa ikon";
          return (
            <button
              key={k ?? "tanpa"}
              type="button"
              role="radio"
              aria-checked={pilih}
              tabIndex={(idx < 0 ? i === 0 : pilih) ? 0 : -1}
              onClick={() => onPilih(k)}
              onKeyDown={(e) => tombol(e, i)}
              className={`flex h-11 items-center gap-1.5 rounded-lg border-2 px-2.5 text-xs font-medium text-fg transition ${FOKUS} ${pilih ? "border-fg bg-surface-2" : "border-transparent hover:bg-surface-2"}`}
            >
              {k ? <IkonPlatform ikon={k} className="text-[16px]" /> : <span className="h-4 w-4 rounded-full border border-dashed border-border-strong" aria-hidden="true" />}
              {nama}
            </button>
          );
        })}
      </div>
    </div>
  );
}
