"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconCopy } from "@/components/ui/icons";
import { PinStrengthMeter } from "@/components/portal/PinStrengthMeter";
import { longDate, soft } from "@/components/portal/ui";

/** `sekolah` terisi = tautan khusus satu sekolah: kolom sekolah terkunci (server juga memakai sekolah tautan). */
type Info = { label: string; sekolah: string | null; berlakuSampai: string; mulaiMagang: string | null; selesaiMagang: string | null };
type Form = {
  namaLengkap: string;
  panggilan: string;
  hp: string;
  sekolah: string;
  jurusan: string;
  guruPembimbing: string;
  kontakGuru: string;
  mulai: string;
  selesai: string;
  pin: string;
  confirm: string;
};

/** PUBLIK — anak magang mendaftar sendiri lewat tautan dari pengawas. Hasilnya menunggu persetujuan. */
export default function DaftarMagangPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [form, setForm] = useState<Form>({
    namaLengkap: "",
    panggilan: "",
    hp: "",
    sekolah: "",
    jurusan: "",
    guruPembimbing: "",
    kontakGuru: "",
    mulai: "", selesai: "", pin: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [selesai, setSelesai] = useState<{ token: string; nama: string } | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    let hidup = true;
    api<Info>(`/api/public/daftar-magang/${kode}`).then(
      (d) => {
        if (!hidup) return;
        setInfo(d);
        setForm((f) => ({ ...f, sekolah: d.sekolah ?? f.sekolah, mulai: d.mulaiMagang ?? "", selesai: d.selesaiMagang ?? "" }));
      },
      (e) => hidup && setGalatMuat(e instanceof Error ? e.message : "Tautan tidak bisa dibuka.")
    );
    return () => {
      hidup = false;
    };
  }, [kode]);

  const ubah = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const siap =
    form.namaLengkap.trim().length >= 3 && form.hp.trim().length >= 8 && form.sekolah.trim().length >= 2 && !!form.mulai && form.pin.length >= 4 && form.pin === form.confirm;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!siap) return;
    setBusy(true);
    setGalat("");
    try {
      const r = await api<{ token: string; nama: string }>(`/api/public/daftar-magang/${kode}`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          selesai: form.selesai || null,
          panggilan: form.panggilan || null,
          jurusan: form.jurusan || null,
          guruPembimbing: form.guruPembimbing.trim() || null,
          kontakGuru: form.kontakGuru.trim() || null,
        }),
      });
      setSelesai(r);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Pendaftaran gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }

  const tautanHp = selesai && typeof window !== "undefined" ? `${window.location.origin}/me/${selesai.token}` : "";

  return (
    <main className="ambient relative flex min-h-screen justify-center bg-bg p-4">
      <div className="glass-2 relative z-10 my-4 w-full max-w-md self-start rounded-3xl p-6 shadow-2xl">
        {galatMuat ? (
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-danger" style={soft("var(--danger)")}>
              <IconAlert className="text-[26px]" />
            </span>
            <p className="text-sm text-muted">{galatMuat}</p>
          </div>
        ) : !info ? (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-primary" />
        ) : selesai ? (
          <div className="space-y-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl text-success" style={soft("var(--success)")}>
              <IconCheck className="text-[26px]" />
            </span>
            <h1 className="font-display text-xl font-bold text-fg">Pendaftaran terkirim, {selesai.nama}!</h1>
            <p className="text-sm text-muted">
              Pengawas akan memeriksa datamu. Setelah disetujui, buka <b className="text-fg">halaman pribadimu</b> di bawah ini dan masuk dengan PIN yang
              barusan kamu buat.
            </p>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="break-all text-sm font-semibold text-fg">{tautanHp}</p>
              <button
                type="button"
                className="btn-ghost mt-2 h-11 text-xs"
                onClick={() => navigator.clipboard.writeText(tautanHp).then(() => setDisalin(true), () => undefined)}
              >
                <IconCopy /> {disalin ? "Tersalin" : "Salin tautan"}
              </button>
            </div>
            <p className="text-xs text-subtle">Simpan tautan ini (tandai/bookmark atau kirim ke WhatsApp-mu sendiri). Jangan bagikan ke orang lain.</p>
          </div>
        ) : (
          <form onSubmit={kirim} className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pendaftaran magang</p>
              <h1 className="font-display text-xl font-bold text-fg">{info.label}</h1>
              <p className="text-xs text-subtle">Tautan berlaku sampai {longDate(info.berlakuSampai)}.</p>
            </div>
            <Medan label="Nama lengkap" wajib>
              <input className="input" value={form.namaLengkap} onChange={ubah("namaLengkap")} maxLength={150} autoComplete="name" />
            </Medan>
            <Medan label="Nama panggilan">
              <input className="input" value={form.panggilan} onChange={ubah("panggilan")} maxLength={50} />
            </Medan>
            <Medan label="Nomor HP / WhatsApp" wajib>
              <input className="input" value={form.hp} onChange={ubah("hp")} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="08…" />
            </Medan>
            {info.sekolah ? (
              <Medan label="Sekolah / kampus" bantu="Sudah diisi dari tautan ini — tidak perlu diubah.">
                <input className="input cursor-not-allowed opacity-80" value={info.sekolah} readOnly aria-readonly />
              </Medan>
            ) : (
              <Medan label="Sekolah / kampus" wajib>
                <input className="input" value={form.sekolah} onChange={ubah("sekolah")} maxLength={150} />
              </Medan>
            )}
            <Medan label="Jurusan">
              <input className="input" value={form.jurusan} onChange={ubah("jurusan")} maxLength={100} />
            </Medan>
            <Medan label="Guru pembimbing dari sekolah" bantu="Boleh dikosongkan.">
              <input className="input" value={form.guruPembimbing} onChange={ubah("guruPembimbing")} maxLength={150} />
            </Medan>
            <Medan label="Nomor HP / WA guru pembimbing" bantu="Boleh dikosongkan.">
              <input className="input" value={form.kontakGuru} onChange={ubah("kontakGuru")} inputMode="tel" maxLength={60} />
            </Medan>
            <div className="grid grid-cols-2 gap-3">
              <Medan label="Mulai magang" wajib>
                <input type="date" className="input" value={form.mulai} onChange={ubah("mulai")} />
              </Medan>
              <Medan label="Selesai magang">
                <input type="date" className="input" value={form.selesai} min={form.mulai} onChange={ubah("selesai")} />
              </Medan>
            </div>
            <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold text-fg">Buat PIN untuk masuk</legend>
              <p className="text-xs text-muted">4–8 angka. Dipakai setiap membuka halaman pribadimu — jangan beri tahu orang lain.</p>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                aria-label="PIN"
                placeholder="PIN"
                value={form.pin}
                maxLength={8}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
              />
              <PinStrengthMeter pin={form.pin} />
              <input
                className="input"
                type="password"
                inputMode="numeric"
                aria-label="Ulangi PIN"
                placeholder="Ulangi PIN"
                value={form.confirm}
                maxLength={8}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value.replace(/\D/g, "") }))}
              />
              {form.confirm && form.confirm !== form.pin && <p className="text-xs text-danger">PIN belum sama.</p>}
            </fieldset>
            {galat && (
              <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
                <IconAlert className="shrink-0" /> {galat}
              </p>
            )}
            <button type="submit" className="btn-primary h-11 w-full text-sm" disabled={!siap || busy}>
              {busy ? "Mengirim…" : "Daftar"}
            </button>
            <p className="text-center text-xs text-subtle">Data dipakai pengawas magang untuk jadwal & penilaianmu.</p>
          </form>
        )}
      </div>
    </main>
  );
}

function Medan({ label, wajib, bantu, children }: { label: string; wajib?: boolean; bantu?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-fg">
        {label} {wajib && <span className="text-danger" aria-hidden>*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {bantu && <span className="mt-1 block text-xs text-muted">{bantu}</span>}
    </label>
  );
}
