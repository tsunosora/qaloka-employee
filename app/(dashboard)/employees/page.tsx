"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmployeeLinksModal } from "@/components/employees/EmployeeLinksModal";
import { StatusMesin } from "@/components/employees/StatusMesin";
import { useLisensi } from "@/components/lisensi/Lisensi";
import { namaUnik, kunciNama } from "@/lib/services/upah-tarif/aturan";
import {
  IconPlus,
  IconSearch,
  IconPencil,
  IconTrash,
  IconQr,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
} from "@/components/ui/icons";

type Ref = { id: number; name: string };
type PosproStaff = { userId: number; name: string; isActive: boolean };
type Employee = {
  id: number;
  employeeCode: string;
  machinePin: string | null;
  publicToken: string | null;
  portalPinSetAt: string | null;
  posproUserId: number | null;
  fullName: string;
  nickname: string | null;
  isActive: boolean;
  // Absen tim (18 Okt 2026): freelance yang didaftarkan PIC berlabel "baru" sampai diperiksa.
  jenis?: string;
  perluDiperiksa?: boolean;
  departmentId: number | null;
  positionId: number | null;
  workScheduleId: number | null;
  joinDate?: string | null;
  salary?: string | number | null;
  email?: string | null;
  phone?: string | null;
  department: { id: number; name: string } | null;
  position: { id: number; name: string } | null;
  // Upah tukang (hr.upah) & tim (hr.absen_hp). Decimal datang sebagai string.
  upahHarian?: string | number | null;
  upahLemburPerJam?: string | number | null;
  kotaBawaan?: string | null;
  divisiBawaan?: string | null;
  timId?: number | null;
  tim?: { id: number; nama: string; warna: string } | null;
};

type TimPilihan = { id: number; nama: string; aktif: boolean };
type TarifRingkas = { kota: string; divisi: string; upahHarian: number; lemburPerJam: number; aktif: boolean };

type FormState = {
  fullName: string;
  nickname: string;
  machinePin: string;
  departmentId: string;
  positionId: string;
  workScheduleId: string;
  joinDate: string;
  salary: string;
  email: string;
  phone: string;
  posproUserId: string;
  isActive: boolean;
  upahHarian: string;
  upahLemburPerJam: string;
  kotaBawaan: string;
  divisiBawaan: string;
  timId: string;
};

const emptyForm: FormState = {
  fullName: "",
  nickname: "",
  machinePin: "",
  departmentId: "",
  positionId: "",
  workScheduleId: "",
  joinDate: "",
  salary: "",
  email: "",
  phone: "",
  posproUserId: "",
  isActive: true,
  upahHarian: "",
  upahLemburPerJam: "",
  kotaBawaan: "",
  divisiBawaan: "",
  timId: "",
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const teksAngka = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
/** "YYYY-MM-DD" menurut jam peramban (WIB). Tanggal masuk tersimpan sebagai tengah malam UTC
 *  (dari form) atau tengah malam WIB (data lama); keduanya jatuh di tanggal yang benar di WIB,
 *  sementara memotong teks ISO memundurkan yang kedua satu hari. */
function tanggalLokal(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Request gagal");
  }
  return res.json();
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
function softChip(color: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${color} 16%, transparent)`, color };
}

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const [departments, setDepartments] = useState<Ref[]>([]);
  const [positions, setPositions] = useState<Ref[]>([]);
  const [schedules, setSchedules] = useState<Ref[]>([]);

  const [modal, setModal] = useState<null | "add" | "edit" | "delete" | "qr">(null);
  const [posproStaff, setPosproStaff] = useState<PosproStaff[] | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");

  // Bagian "Upah tukang" di form: rupiah butuh hr.upah, kota/divisi/tim butuh hr.absen_hp.
  // Gagal-terbuka seperti sidebar: tanpa kunci lisensi atau saat hanya-baca, semuanya tampil.
  const lisensi = useLisensi();
  const punya = (kode: string) => !lisensi.ditegakkan || lisensi.hanyaBaca || lisensi.fitur.includes(kode);
  const bolehUpah = punya("hr.upah");
  const bolehLapangan = punya("hr.absen_hp");
  const [timPilihan, setTimPilihan] = useState<TimPilihan[]>([]);
  const [tarif, setTarif] = useState<TarifRingkas[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (search) q.set("search", search);
    if (deptFilter) q.set("department_id", deptFilter);
    if (statusFilter) q.set("is_active", statusFilter);
    try {
      const res = await api<{ data: Employee[]; total: number }>(
        `/api/employees?${q.toString()}`
      );
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, deptFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ id: number; name: string }[]>("/api/departments").then((d) =>
      setDepartments(d.map((x) => ({ id: x.id, name: x.name })))
    );
    api<{ id: number; name: string }[]>("/api/positions").then((d) =>
      setPositions(d.map((x) => ({ id: x.id, name: x.name })))
    );
    api<{ staff: PosproStaff[] }>("/api/pospro/staff-list")
      .then((d) => setPosproStaff(d.staff))
      .catch(() => setPosproStaff([]));
    api<{ id: number; name: string }[]>("/api/work-schedules").then((d) =>
      setSchedules(d.map((x) => ({ id: x.id, name: x.name })))
    );
  }, []);

  useEffect(() => {
    if (bolehLapangan) {
      api<{ tim: TimPilihan[] }>("/api/tim-kerja")
        .then((d) => setTimPilihan(d.tim))
        .catch(() => setTimPilihan([]));
    }
    // Tarif kota × divisi dipakai sebagai saran isian kota/divisi + petunjuk tarifnya.
    if (bolehUpah) {
      api<TarifRingkas[]>("/api/upah/tarif")
        .then(setTarif)
        .catch(() => setTarif([]));
    }
  }, [bolehLapangan, bolehUpah]);

  function openAdd() {
    setForm(emptyForm);
    setEditing(null);
    setError("");
    setModal("add");
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      fullName: e.fullName,
      nickname: e.nickname ?? "",
      machinePin: e.machinePin ?? "",
      departmentId: e.departmentId ? String(e.departmentId) : "",
      positionId: e.positionId ? String(e.positionId) : "",
      workScheduleId: e.workScheduleId ? String(e.workScheduleId) : "",
      // Diisi dari data tersimpan. Dulu dikosongkan, jadi menyimpan Edit menghapus keempatnya.
      joinDate: tanggalLokal(e.joinDate),
      salary: teksAngka(e.salary),
      email: e.email ?? "",
      phone: e.phone ?? "",
      posproUserId: e.posproUserId ? String(e.posproUserId) : "",
      isActive: e.isActive,
      upahHarian: teksAngka(e.upahHarian),
      upahLemburPerJam: teksAngka(e.upahLemburPerJam),
      kotaBawaan: e.kotaBawaan ?? "",
      divisiBawaan: e.divisiBawaan ?? "",
      timId: e.timId ? String(e.timId) : "",
    });
    setError("");
    setModal("edit");
  }

  function payloadFromForm() {
    return {
      fullName: form.fullName,
      nickname: form.nickname || null,
      machinePin: form.machinePin || null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      positionId: form.positionId ? Number(form.positionId) : null,
      workScheduleId: form.workScheduleId ? Number(form.workScheduleId) : null,
      joinDate: form.joinDate || null,
      salary: form.salary ? Number(form.salary) : null,
      email: form.email || null,
      phone: form.phone || null,
      posproUserId: form.posproUserId ? Number(form.posproUserId) : null,
      isActive: form.isActive,
      // Dikirim hanya kalau bagiannya tampil — server juga menyaringnya per lisensi.
      ...(bolehUpah && {
        upahHarian: form.upahHarian === "" ? null : Number(form.upahHarian),
        upahLemburPerJam: form.upahLemburPerJam === "" ? null : Number(form.upahLemburPerJam),
      }),
      ...(bolehLapangan && {
        kotaBawaan: form.kotaBawaan.trim() || null,
        divisiBawaan: form.divisiBawaan.trim() || null,
        timId: form.timId ? Number(form.timId) : null,
      }),
    };
  }

  async function submitAdd() {
    setError("");
    try {
      await api("/api/employees", { method: "POST", body: JSON.stringify(payloadFromForm()) });
      setModal(null);
      setPage(1);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submitEdit() {
    if (!editing) return;
    setError("");
    try {
      await api(`/api/employees/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(payloadFromForm()),
      });
      setModal(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirmDelete() {
    if (!editing) return;
    await api(`/api/employees/${editing.id}`, { method: "DELETE" });
    setModal(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Direktori</h1>
          <p className="mt-0.5 text-sm text-muted">Kelola data karyawan &amp; PIN mesin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openAdd} className="btn-primary h-10">
            <IconPlus className="text-[17px]" /> Karyawan
          </button>
        </div>
      </div>

      {/* Pendaftaran dari mesin: tombol tarik cuma untuk mesin LAN; mesin cloud mengirim sendiri. */}
      <StatusMesin onBerubah={load} />

      <div className="glass flex flex-wrap gap-3 rounded-2xl p-3">
        <label className="relative flex min-w-56 flex-1 items-center">
          <IconSearch className="pointer-events-none absolute left-3 text-[16px] text-subtle" />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Cari nama / kode…"
            className="input h-10 pl-9"
          />
        </label>
        <select value={deptFilter} onChange={(e) => { setPage(1); setDeptFilter(e.target.value); }} className="input h-10 w-auto">
          <option value="">Semua departemen</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="input h-10 w-auto">
          <option value="">Semua status</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">PIN</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Departemen</th>
                <th className="px-4 py-3 font-medium">Posisi</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-subtle">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-subtle">Belum ada karyawan.</td></tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.id} className="border-t border-border transition hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{e.employeeCode}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.machinePin ?? <span className="text-danger">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-primary" style={softChip("var(--primary)")}>
                          {initials(e.fullName)}
                        </span>
                        <div>
                          <div className="font-medium text-fg">{e.fullName}</div>
                          {e.nickname && <div className="text-xs text-subtle">{e.nickname}</div>}
                          {e.tim && (
                            <span className="badge mt-0.5 mr-1" style={softChip(e.tim.warna)} title="Tim kerja">
                              {e.tim.nama}
                            </span>
                          )}
                          {e.jenis === "freelance" && (
                            <span className="badge mt-0.5" style={softChip("var(--warning)")}>
                              {e.perluDiperiksa ? "Freelance baru — perlu diperiksa" : "Freelance"}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{e.department?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{e.position?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={softChip(e.isActive ? "var(--success)" : "var(--fg-subtle)")}>
                        {e.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <IconBtn label="QR" onClick={() => { setEditing(e); setModal("qr"); }} disabled={!e.publicToken}>
                          <IconQr className="text-[15px]" />
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => openEdit(e)} hover="primary">
                          <IconPencil className="text-[15px]" />
                        </IconBtn>
                        <IconBtn label="Hapus" onClick={() => { setEditing(e); setModal("delete"); }} hover="danger">
                          <IconTrash className="text-[15px]" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
          <span className="tabular">{total} karyawan</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border-strong transition hover:bg-surface-2 disabled:opacity-40">
              <IconChevronLeft className="text-[16px]" />
            </button>
            <span className="tabular px-1">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border-strong transition hover:bg-surface-2 disabled:opacity-40">
              <IconChevronRight className="text-[16px]" />
            </button>
          </div>
        </div>
      </div>

      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Tambah Karyawan" : "Edit Karyawan"} onClose={() => setModal(null)} size="xl">
          {error && <div className="mb-3 rounded-xl px-3 py-2.5 text-sm text-danger" style={softChip("var(--danger)")}>{error}</div>}
          {editing && <div className="mb-3 text-xs text-subtle">Kode: {editing.employeeCode}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama lengkap *" className="col-span-2">
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" />
            </Field>
            <Field label="Nama panggilan">
              <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="input" />
            </Field>
            <Field label="PIN Mesin Absensi" className="col-span-2">
              <input value={form.machinePin} onChange={(e) => setForm({ ...form, machinePin: e.target.value })} className="input" placeholder="Nomor PIN terdaftar di mesin (mis. 5)" />
            </Field>
            <Field label="Departemen">
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="input">
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Posisi">
              <select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })} className="input">
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Jadwal kerja">
              <select value={form.workScheduleId} onChange={(e) => setForm({ ...form, workScheduleId: e.target.value })} className="input">
                <option value="">—</option>
                {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal masuk">
              <input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} className="input" />
            </Field>
            <Field label="Gaji">
              <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="input" />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </Field>
            <Field label="Telepon">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </Field>
            <Field label="Akun PosPro (untuk KPI kinerja)" className="col-span-2">
              <select
                value={form.posproUserId}
                onChange={(e) => setForm({ ...form, posproUserId: e.target.value })}
                className="input"
                disabled={!posproStaff || posproStaff.length === 0}
              >
                <option value="">— tidak dipetakan —</option>
                {(posproStaff ?? []).map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name}
                    {u.isActive ? "" : " (nonaktif)"}
                  </option>
                ))}
              </select>
              <span className="text-xs text-subtle">
                {posproStaff === null
                  ? "Memuat daftar akun PosPro…"
                  : posproStaff.length === 0
                    ? "POS tak bisa dihubungi atau integrasi belum diaktifkan (POSPRO_API_URL dan lisensi Qaloka, usaha harus berlangganan Qaloka POS)."
                    : "Menarik rating pelanggan, tugas/piket, dan penjualan dari PosPro ke halaman karyawan."}
              </span>
            </Field>

            {(bolehUpah || bolehLapangan) && (
              <BagianUpahTukang
                form={form}
                setForm={setForm}
                bolehUpah={bolehUpah}
                bolehLapangan={bolehLapangan}
                timPilihan={timPilihan}
                tarif={tarif}
              />
            )}

            {modal === "edit" && (
              <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" className="accent-[color:var(--primary)]" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Aktif
              </label>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">Batal</button>
            <button onClick={modal === "add" ? submitAdd : submitEdit} className="btn-primary">
              <IconCheck className="text-[16px]" /> Simpan
            </button>
          </div>
        </Modal>
      )}

      {modal === "delete" && editing && (
        <Modal title="Hapus Karyawan" onClose={() => setModal(null)}>
          <p className="text-sm text-muted">
            Yakin menghapus <b className="text-fg">{editing.fullName}</b>? (soft delete)
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">Batal</button>
            <button
              onClick={confirmDelete}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: "var(--danger)" }}
            >
              <IconTrash className="text-[16px]" /> Hapus
            </button>
          </div>
        </Modal>
      )}

      {modal === "qr" && editing?.publicToken && (
        <EmployeeLinksModal
          employeeId={editing.id}
          employeeName={editing.fullName}
          publicToken={editing.publicToken}
          portalPinSetAt={editing.portalPinSetAt}
          onClose={() => setModal(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function IconBtn({
  children, onClick, label, disabled, hover,
}: {
  children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; hover?: "primary" | "danger";
}) {
  const hoverCls =
    hover === "danger"
      ? "hover:border-danger hover:text-danger"
      : hover === "primary"
      ? "hover:border-primary hover:text-primary"
      : "hover:bg-surface-2 hover:text-fg";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-border-strong text-muted transition disabled:opacity-30 ${hoverCls}`}
    >
      {children}
    </button>
  );
}

/**
 * Bagian "Upah tukang" di form karyawan. Tarif per karyawan dipakai PALING AKHIR: tarif proyek
 * menang, lalu tarif kota × divisi (untuk hari tanpa proyek), baru tarif di sini.
 */
function BagianUpahTukang({
  form, setForm, bolehUpah, bolehLapangan, timPilihan, tarif,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  bolehUpah: boolean;
  bolehLapangan: boolean;
  timPilihan: TimPilihan[];
  tarif: TarifRingkas[];
}) {
  const aktif = tarif.filter((t) => t.aktif);
  const saranKota = namaUnik(aktif.map((t) => t.kota));
  // Divisi yang disarankan mengikuti kota yang dipilih; tanpa kota → semua divisi.
  const saranDivisi = namaUnik(
    aktif.filter((t) => !form.kotaBawaan.trim() || kunciNama(t.kota) === kunciNama(form.kotaBawaan)).map((t) => t.divisi)
  );
  const cocok =
    form.kotaBawaan.trim() && form.divisiBawaan.trim()
      ? aktif.find((t) => kunciNama(t.kota) === kunciNama(form.kotaBawaan) && kunciNama(t.divisi) === kunciNama(form.divisiBawaan))
      : undefined;

  return (
    <fieldset className="col-span-2 mt-1 grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-fg">Upah tukang</legend>
      {bolehLapangan && (
        <>
          <Field label="Kota bawaan">
            <input list="saran-kota" value={form.kotaBawaan} onChange={(e) => setForm({ ...form, kotaBawaan: e.target.value })} className="input" placeholder="mis. Jakarta" />
            <datalist id="saran-kota">{saranKota.map((k) => <option key={k} value={k} />)}</datalist>
          </Field>
          <Field label="Divisi bawaan">
            <input list="saran-divisi" value={form.divisiBawaan} onChange={(e) => setForm({ ...form, divisiBawaan: e.target.value })} className="input" placeholder="mis. Tukang" />
            <datalist id="saran-divisi">{saranDivisi.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field label="Tim" className="col-span-2">
            <select value={form.timId} onChange={(e) => setForm({ ...form, timId: e.target.value })} className="input">
              <option value="">— tanpa tim —</option>
              {timPilihan.map((t) => (
                <option key={t.id} value={t.id}>{t.nama}{t.aktif ? "" : " (nonaktif)"}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {bolehUpah && (
        <>
          <Field label="Upah harian (Rp)">
            <input type="number" min={0} inputMode="numeric" value={form.upahHarian} onChange={(e) => setForm({ ...form, upahHarian: e.target.value })} className="input" placeholder="kosong = belum diatur" />
          </Field>
          <Field label="Lembur per jam (Rp)">
            <input type="number" min={0} inputMode="numeric" value={form.upahLemburPerJam} onChange={(e) => setForm({ ...form, upahLemburPerJam: e.target.value })} className="input" placeholder="kosong = belum diatur" />
          </Field>
          <p className="col-span-2 text-xs text-subtle">
            {cocok
              ? `Ada tarif ${cocok.kota} · ${cocok.divisi}: ${rupiah(cocok.upahHarian)}/hari, lembur ${rupiah(cocok.lemburPerJam)}/jam. Tarif itu yang dipakai untuk hari tanpa proyek; upah di sini cadangan.`
              : "Tarif proyek dipakai lebih dulu, lalu tarif kota × divisi, baru upah di sini. Atur tarif di Pengaturan → Tarif Upah."}
          </p>
        </>
      )}
    </fieldset>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-1.5 text-sm ${className ?? ""}`}>
      <span className="font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
