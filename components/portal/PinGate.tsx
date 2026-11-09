"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconAttendance } from "@/components/ui/icons";
import { PinStrengthMeter } from "./PinStrengthMeter";
import type { PortalEmployeeInfo } from "./types";
import { labelHalaman, subjudulPortal } from "@/lib/services/portal/tab-portal";

/** Layar PIN: membuat PIN pertama kali, atau masuk dengan PIN yang sudah ada. */
export function PinGate({
  token,
  employee,
  pinSet,
  posproPin,
  onSuccess,
  jalurSesi,
  magang = false,
}: {
  token: string;
  employee: PortalEmployeeInfo;
  pinSet: boolean;
  /** PIN PosPro tersedia — karyawan boleh masuk memakai PIN itu. */
  posproPin: boolean;
  onSuccess: () => void;
  /** Alamat sesi PIN; bawaan portal. Halaman absen HP memakai jalurnya sendiri (gerbang lisensinya beda). */
  jalurSesi?: string;
  /** Peserta magang aktif → label "Halaman Peserta Magang" / "Peserta magang" (bukan "Karyawan"). */
  magang?: boolean;
}) {
  // Layar "masuk" bila sudah ada PIN mana pun; "buat PIN" hanya bila belum punya keduanya.
  const canLogin = pinSet || posproPin;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (!pin.trim()) return setError("Masukkan PIN.");
    if (!canLogin && pin !== confirm) return setError("Konfirmasi PIN tidak sama.");

    setBusy(true);
    try {
      await api(jalurSesi ?? `/api/public/portal/${token}/session`, {
        method: "POST",
        body: JSON.stringify(canLogin ? { pin } : { pin, confirm }),
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk.");
      setPin("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-2 relative z-10 w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 text-on-primary shadow-lg shadow-primary/30">
          <IconAttendance className="text-[22px]" />
        </span>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {labelHalaman(magang)}
        </div>
        <h1 className="mt-2 font-display text-xl font-bold text-fg">{employee.fullName}</h1>
        <p className="text-sm text-muted">{subjudulPortal({ magang, position: employee.position, department: employee.department })}</p>
      </div>

      {error && (
        <div
          className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger"
          style={{ background: "color-mix(in oklab, var(--danger) 16%, transparent)" }}
        >
          <IconAlert className="text-[16px] shrink-0" /> {error}
        </div>
      )}

      {!canLogin && (
        <p className="mb-4 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          Ini pertama kalinya halaman ini dibuka. Buat <b className="text-fg">PIN 4–8 angka</b> untuk
          mengunci data absensi &amp; penilaian Anda. Jangan bagikan PIN ini ke siapa pun.
        </p>
      )}

      {canLogin && posproPin && (
        <p className="mb-4 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          {pinSet
            ? "Bisa pakai PIN halaman ini, atau PIN Qaloka POS Anda (PIN piket/desainer) — keduanya diterima."
            : "Masukkan PIN Qaloka POS Anda — PIN yang biasa dipakai di halaman piket/desainer."}
        </p>
      )}

      <label className="mb-3 block space-y-1.5 text-sm">
        <span className="font-medium text-muted">{canLogin ? "PIN" : "PIN baru"}</span>
        <input
          className="input h-12 text-center text-xl tracking-[0.4em]"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && canLogin && submit()}
        />
        {!canLogin && <PinStrengthMeter pin={pin} />}
      </label>

      {!canLogin && (
        <label className="mb-3 block space-y-1.5 text-sm">
          <span className="font-medium text-muted">Ulangi PIN</span>
          <input
            className="input h-12 text-center text-xl tracking-[0.4em]"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
      )}

      <button onClick={submit} disabled={busy} className="btn-primary mt-2 h-11 w-full">
        {busy ? "Memproses…" : canLogin ? "Masuk" : "Simpan PIN & Masuk"}
      </button>

      {canLogin && (
        <p className="mt-4 text-center text-xs text-subtle">
          Lupa PIN? Minta admin/owner mereset PIN Anda dari menu Direktori.
        </p>
      )}
    </div>
  );
}
