"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { MachineEnrollmentsModal } from "@/components/settings/MachineEnrollmentsModal";
import { MachineInfoModal } from "@/components/settings/MachineInfoModal";
import { IconTrash } from "@/components/ui/icons";

type Dept = { id: number; name: string; _count?: { employees: number } };
type Pos = { id: number; name: string; department?: { name: string } | null };
type Holiday = { id: number; date: string; name: string };
type Machine = { id: number; sn: string; name: string; mode: string; ip: string | null; port: number | null; autoPull: boolean; pullIntervalMinutes: number; online: boolean; lastSeenAt: string | null; employees: number; attendances: number };
type Settings = Record<string, string | null>;

function softChip(c: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${c} 16%, transparent)`, color: c };
}

export default function SettingsPage() {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [enrollMachine, setEnrollMachine] = useState<number | null>(null);
  const [infoMachine, setInfoMachine] = useState<number | null>(null);
  const [employeeList, setEmployeeList] = useState<{ id: number; name: string }[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [msg, setMsg] = useState("");

  const [newDept, setNewDept] = useState("");
  const [newPos, setNewPos] = useState("");
  const [newPosDept, setNewPosDept] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  const loadAll = useCallback(async () => {
    const [d, p, h, s, mc] = await Promise.all([
      api<Dept[]>("/api/departments"),
      api<Pos[]>("/api/positions"),
      api<Holiday[]>("/api/holidays"),
      api<Settings>("/api/settings"),
      api<Machine[]>("/api/machines").catch(() => [] as Machine[]),
    ]);
    setDepartments(d);
    setPositions(p);
    setHolidays(h);
    setSettings(s);
    setMachines(mc);
  }, []);

  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [newMachine, setNewMachine] = useState({ name: "", mode: "cloud", sn: "", ip: "", port: "5005" });
  const [machineMsg, setMachineMsg] = useState("");

  async function renameMachine(id: number, name: string) {
    await api(`/api/machines/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    loadAll();
  }
  async function deleteMachine(id: number) {
    if (!confirm("Hapus mesin ini? Absensi tetap ada, tapi tak lagi terhubung ke mesin.")) return;
    await api(`/api/machines/${id}`, { method: "DELETE" });
    loadAll();
  }
  async function addMachine() {
    setMachineMsg("");
    try {
      const b: Record<string, unknown> = { name: newMachine.name.trim(), mode: newMachine.mode };
      if (newMachine.sn.trim()) b.sn = newMachine.sn.trim();
      if (newMachine.mode === "lan") { b.ip = newMachine.ip.trim(); b.port = Number(newMachine.port) || 5005; }
      await api("/api/machines", { method: "POST", body: JSON.stringify(b) });
      setNewMachine({ name: "", mode: "cloud", sn: "", ip: "", port: "5005" });
      setAddMachineOpen(false);
      loadAll();
    } catch (e) {
      setMachineMsg((e as Error).message);
    }
  }
  async function pullMachine(id: number, users: boolean) {
    setMachineMsg("Memproses…");
    try {
      const r = await api<{ machineName: string; synced?: number; total?: number; created?: number; renamed?: number }>(
        `/api/machines/${id}/pull`,
        { method: "POST", body: JSON.stringify({ users }) }
      );
      setMachineMsg(users
        ? `${r.machineName}: ${r.created} karyawan baru, ${r.renamed} nama diperbarui (dari ${r.total}).`
        : `${r.machineName}: ${r.synced} absensi baru (dari ${r.total} record).`);
      loadAll();
    } catch (e) {
      setMachineMsg("Gagal: " + (e as Error).message);
    }
  }
  async function testMachine(id: number) {
    setMachineMsg("Menguji koneksi…");
    try {
      const r = await api<{ message: string }>(`/api/machines/${id}/pull`, { method: "POST", body: JSON.stringify({ test: true }) });
      setMachineMsg(r.message);
      loadAll();
    } catch (e) {
      setMachineMsg("Gagal: " + (e as Error).message);
    }
  }
  async function patchMachine(id: number, data: Record<string, unknown>) {
    await api(`/api/machines/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    loadAll();
  }
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadEmployeeList().catch(() => setEmployeeList([]));
  }, []);

  async function loadEmployeeList() {
    const r = await api<{ data: { id: number; fullName: string }[] }>("/api/employees?page=1&per_page=200");
    setEmployeeList(r.data.map((e) => ({ id: e.id, name: e.fullName })));
  }

  async function addDept() {
    if (!newDept.trim()) return;
    await api("/api/departments", { method: "POST", body: JSON.stringify({ name: newDept }) });
    setNewDept("");
    loadAll();
  }
  async function delDept(id: number) {
    try {
      await api(`/api/departments/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function addPos() {
    if (!newPos.trim()) return;
    await api("/api/positions", {
      method: "POST",
      body: JSON.stringify({ name: newPos, departmentId: newPosDept ? Number(newPosDept) : null }),
    });
    setNewPos("");
    setNewPosDept("");
    loadAll();
  }
  async function delPos(id: number) {
    try {
      await api(`/api/positions/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function addHoliday() {
    if (!holidayDate || !holidayName.trim()) return;
    await api("/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: holidayDate, name: holidayName }),
    });
    setHolidayDate("");
    setHolidayName("");
    loadAll();
  }
  async function delHoliday(id: number) {
    await api(`/api/holidays/${id}`, { method: "DELETE" });
    loadAll();
  }
  async function saveSettings() {
    const updated = await api<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    setSettings(updated);
    setMsg("Pengaturan tersimpan.");
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Pengaturan</h1>
          <p className="mt-0.5 text-sm text-muted">Departemen, posisi, hari libur, shift &amp; integrasi.</p>
        </div>
        {msg && <span className="text-sm text-success">{msg}</span>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Departemen">
          <div className="mb-3 flex gap-2">
            <input
              className="input"
              placeholder="Nama departemen"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            />
            <button onClick={addDept} className="btn-primary">
              Tambah
            </button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span className="text-fg">
                  {d.name}
                  {d._count && (
                    <span className="ml-2 text-xs text-subtle">
                      ({d._count.employees} karyawan)
                    </span>
                  )}
                </span>
                <DeleteLink onClick={() => delDept(d.id)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Posisi / Jabatan">
          <div className="mb-3 flex gap-2">
            <input
              className="input"
              placeholder="Nama posisi"
              value={newPos}
              onChange={(e) => setNewPos(e.target.value)}
            />
            <select
              className="input max-w-[40%]"
              value={newPosDept}
              onChange={(e) => setNewPosDept(e.target.value)}
            >
              <option value="">Dept…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button onClick={addPos} className="btn-primary">
              Tambah
            </button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {positions.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="text-fg">
                  {p.name}
                  {p.department && (
                    <span className="ml-2 text-xs text-subtle">{p.department.name}</span>
                  )}
                </span>
                <DeleteLink onClick={() => delPos(p.id)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Hari Libur">
          <div className="mb-3 flex gap-2">
            <input
              type="date"
              className="input"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
            />
            <input
              className="input"
              placeholder="Keterangan"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
            <button onClick={addHoliday} className="btn-primary">
              Tambah
            </button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2">
                <span className="text-fg">
                  {new Date(h.date).toLocaleDateString("id-ID")} — {h.name}
                </span>
                <DeleteLink onClick={() => delHoliday(h.id)} />
              </li>
            ))}
          </ul>
        </Card>

        <ChangePasswordCard />

        <Card title="Sistem & Integrasi">
          <div className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-muted">Nama usaha</span>
              <input
                className="input"
                maxLength={120}
                placeholder="Contoh: CV Maju Bersama"
                value={settings.nama_usaha ?? ""}
                onChange={(e) => setSettings({ ...settings, nama_usaha: e.target.value })}
              />
              <span className="block text-xs text-subtle">Tercetak di kop slip upah. Kosong = slip tanpa nama usaha.</span>
            </label>
            <label className="space-y-1">
              <span className="text-muted">Engine perhitungan lembur</span>
              <select
                className="input"
                value={settings.overtime_engine_context ?? "default"}
                onChange={(e) =>
                  setSettings({ ...settings, overtime_engine_context: e.target.value })
                }
              >
                <option value="default">Standard</option>
                <option value="rate_my_staff_custom">Qaloka (kustom)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                className="accent-[color:var(--primary)]"
                checked={settings.auto_sunday_holiday === "true"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    auto_sunday_holiday: e.target.checked ? "true" : "false",
                  })
                }
              />
              Minggu otomatis hari libur
            </label>
            <p className="text-xs text-subtle">
              Pengaturan mesin absensi (tambah/atur cloud & LAN, tarik, status) ada di
              kartu <b>Mesin Absensi (Cabang)</b> di bawah.
            </p>
            <button onClick={saveSettings} className="btn-primary">
              Simpan pengaturan
            </button>
          </div>
        </Card>

        <Card title="Mesin Absensi (Cabang)">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Mode <b>Cloud</b>: mesin push ke server (otomatis muncul). Mode <b>LAN</b>: server
              menarik dari IP mesin (server harus satu jaringan). PIN unik per mesin.
            </p>
            <button onClick={() => setAddMachineOpen((v) => !v)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
              {addMachineOpen ? "Tutup" : "+ Tambah Mesin"}
            </button>
          </div>

          {addMachineOpen && (
            <div className="mb-3 space-y-2 rounded-xl border border-border p-3 text-sm">
              <input className="input" placeholder="Nama cabang (mis. Pusat, Cabang Bantul)"
                value={newMachine.name} onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })} />
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={newMachine.mode === "cloud"} onChange={() => setNewMachine({ ...newMachine, mode: "cloud" })} /> Cloud (push)
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={newMachine.mode === "lan"} onChange={() => setNewMachine({ ...newMachine, mode: "lan" })} /> LAN (tarik IP)
                </label>
              </div>
              {newMachine.mode === "lan" ? (
                <div className="grid grid-cols-3 gap-2">
                  <input className="input col-span-2" placeholder="IP mesin (192.168.1.160)"
                    value={newMachine.ip} onChange={(e) => setNewMachine({ ...newMachine, ip: e.target.value })} />
                  <input className="input" placeholder="Port (5005)"
                    value={newMachine.port} onChange={(e) => setNewMachine({ ...newMachine, port: e.target.value })} />
                </div>
              ) : (
                <p className="text-xs text-subtle">
                  Arahkan mesin (menu Web/Server) ke <b>absensi.volikoprint.com</b> port <b>80</b>,
                  Domain Name ON, HTTPS OFF. Mesin akan muncul otomatis saat push pertama.
                </p>
              )}
              <input className="input" placeholder="SN mesin (opsional — dari label mesin)"
                value={newMachine.sn} onChange={(e) => setNewMachine({ ...newMachine, sn: e.target.value })} />
              <button onClick={addMachine} disabled={!newMachine.name.trim()} className="btn-primary disabled:opacity-40">
                Daftarkan mesin
              </button>
            </div>
          )}

          {machineMsg && <p className={`mb-2 text-xs ${machineMsg.startsWith("Gagal") ? "text-danger" : "text-primary"}`}>{machineMsg}</p>}

          {machines.length === 0 ? (
            <p className="text-sm text-subtle">Belum ada mesin. Tambahkan atau tunggu mesin push otomatis.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {machines.map((m) => (
                <MachineRow key={m.id} machine={m} onRename={renameMachine} onDelete={deleteMachine} onPull={pullMachine} onTest={testMachine} onPatch={patchMachine} onEnroll={setEnrollMachine} onInfo={setInfoMachine} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Jam Toko & Shift">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-muted">Buka toko / shift pagi mulai</span>
              <input
                type="time"
                className="input"
                value={settings.store_open_time ?? "08:00"}
                onChange={(e) => setSettings({ ...settings, store_open_time: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Tutup toko / shift siang selesai</span>
              <input
                type="time"
                className="input"
                value={settings.store_close_time ?? "21:00"}
                onChange={(e) => setSettings({ ...settings, store_close_time: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Shift pagi selesai</span>
              <input
                type="time"
                className="input"
                value={settings.shift_morning_end ?? "16:00"}
                onChange={(e) => setSettings({ ...settings, shift_morning_end: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Shift siang mulai (batas pagi/siang)</span>
              <input
                type="time"
                className="input"
                value={settings.shift_afternoon_start ?? "13:00"}
                onChange={(e) => setSettings({ ...settings, shift_afternoon_start: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Longshift bila masuk pagi & pulang ≥</span>
              <input
                type="time"
                className="input"
                value={settings.longshift_min_out ?? "20:00"}
                onChange={(e) => setSettings({ ...settings, longshift_min_out: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Toleransi telat (menit)</span>
              <input
                type="number"
                min={0}
                className="input"
                value={settings.shift_late_tolerance ?? "15"}
                onChange={(e) => setSettings({ ...settings, shift_late_tolerance: e.target.value })}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Shift dideteksi otomatis dari jam scan: masuk sebelum &quot;shift siang mulai&quot; = pagi;
            masuk pagi lalu pulang ≥ ambang longshift = longshift. Lembur = menit kerja melebihi jam
            selesai shift (pagi: shift pagi selesai; siang/longshift: tutup toko).
          </p>
          <button onClick={saveSettings} className="btn-primary mt-3">
            Simpan pengaturan
          </button>
        </Card>

        <Card title="Poin Karyawan">
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Poin dikumpulkan karyawan dari omzet, pekerjaan, task, dan kedisiplinan, lalu bisa
            ditukar hadiah di <b className="text-fg">Penilaian &rarr; Poin &amp; Hadiah</b>.
            Kosongkan untuk memakai nilai bawaan.
          </p>
          <label className="mb-3 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="accent-[color:var(--primary)]"
              checked={settings.points_enabled !== "false"}
              onChange={(e) =>
                setSettings({ ...settings, points_enabled: e.target.checked ? "true" : "false" })
              }
            />
            Nyalakan sistem poin
          </label>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-muted">Omzet per 1 poin (Rp)</span>
              <input type="number" min={1} step={1000} className="input" placeholder="10000"
                value={settings.points_omzet_per_point ?? ""}
                onChange={(e) => setSettings({ ...settings, points_omzet_per_point: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per nota / closing</span>
              <input type="number" min={0} className="input" placeholder="5"
                value={settings.points_per_transaction ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_transaction: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per layout materi</span>
              <input type="number" min={0} className="input" placeholder="10"
                value={settings.points_per_design_job ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_design_job: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Nilai jasa desain per 1 poin (Rp)</span>
              <input type="number" min={1} step={1000} className="input" placeholder="1000"
                value={settings.points_design_value_per_point ?? ""}
                onChange={(e) => setSettings({ ...settings, points_design_value_per_point: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per kartu produksi</span>
              <input type="number" min={0} className="input" placeholder="10"
                value={settings.points_per_operator_job ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_operator_job: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per task tepat waktu</span>
              <input type="number" min={0} className="input" placeholder="20"
                value={settings.points_per_task_ontime ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_task_ontime: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per task terlambat</span>
              <input type="number" min={0} className="input" placeholder="5"
                value={settings.points_per_task_late ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_task_late: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Poin per hari hadir tepat waktu</span>
              <input type="number" min={0} className="input" placeholder="10"
                value={settings.points_per_ontime_day ?? ""}
                onChange={(e) => setSettings({ ...settings, points_per_ontime_day: e.target.value })} />
            </label>
          </div>
          <p className="mt-3 text-xs text-subtle">
            Bawaan: Rp1 juta = 100 poin, sehingga kasir beromzet besar tidak otomatis
            mengalahkan operator &amp; orang yang rajin mengerjakan task. Jasa desain di PosPro
            berjenjang — dengan bawaan Rp1.000/poin, desain <b className="text-fg">Hard</b> (Rp200rb)
            bernilai 200 poin sedangkan <b className="text-fg">Easy A</b> (Rp15rb) 15 poin. Angka ini
            sengaja besar karena mendesain itu kerja terampil, sedangkan layout materi jumlahnya ratusan.
          </p>
        </Card>

        <Card title="Tarif Lembur & Struk">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-muted">Lembur Harian (per hari longshift)</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="20000"
                value={settings.receipt_rate_daily ?? ""}
                onChange={(e) => setSettings({ ...settings, receipt_rate_daily: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Lembur Libur (per hari libur masuk)</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="70000"
                value={settings.receipt_rate_holiday ?? ""}
                onChange={(e) => setSettings({ ...settings, receipt_rate_holiday: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Lembur Cetak (per jam)</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="10000"
                value={settings.receipt_rate_cetak ?? ""}
                onChange={(e) => setSettings({ ...settings, receipt_rate_cetak: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Perhitungan jam lembur</span>
              <select
                className="input"
                value={settings.overtime_rounding ?? "hour"}
                onChange={(e) => setSettings({ ...settings, overtime_rounding: e.target.value })}
              >
                <option value="hour">Per jam penuh (buang sisa menit)</option>
                <option value="decimal">Desimal (menit dihitung)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-muted">Uang makan (jam masuk bebas, di atas 10 jam)</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="10000"
                value={settings.flex_meal_allowance ?? ""}
                onChange={(e) => setSettings({ ...settings, flex_meal_allowance: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted">Lembur hari libur / Minggu per jam (jam masuk bebas)</span>
              <input
                type="number"
                min={0}
                step={1000}
                className="input"
                placeholder="= tarif lembur biasa"
                value={settings.flex_holiday_rate_per_hour ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, flex_holiday_rate_per_hour: e.target.value })
                }
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Tarif kosong memakai default (20.000 / 70.000 / 10.000) atau nilai dari kategori lembur.
            Mode <strong>per jam penuh</strong>: lembur hanya dihitung tiap 1 jam — sisa menit di
            bawah 60 (mis. 30 atau 50 menit) tidak dihitung.{" "}
            <strong>Uang makan</strong> hanya berlaku untuk jadwal “jam masuk bebas” dan dibayar flat
            sekali per hari bila durasi kerja melewati 10 jam (lemburnya dihitung per-menit). Kosong =
            default Rp10.000.{" "}
            <strong>Lembur hari libur / Minggu</strong> (jadwal “jam masuk bebas”): di hari libur
            terdaftar atau Minggu (bila “Minggu otomatis hari libur” aktif), <em>seluruh</em> jam kerja
            dihitung lembur memakai tarif ini — bukan hanya jam di atas 8. Kosong = memakai tarif
            lembur biasa jadwal.
          </p>

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-muted">Ubah istilah di struk</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-muted">Istilah “Lembur Harian”</span>
                <input
                  className="input"
                  placeholder="Lembur Harian"
                  value={settings.label_lembur_harian ?? ""}
                  onChange={(e) => setSettings({ ...settings, label_lembur_harian: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Istilah “Lembur Libur”</span>
                <input
                  className="input"
                  placeholder="Lembur Libur"
                  value={settings.label_lembur_libur ?? ""}
                  onChange={(e) => setSettings({ ...settings, label_lembur_libur: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Istilah “Lembur Cetak”</span>
                <input
                  className="input"
                  placeholder="Lembur Cetak"
                  value={settings.label_lembur_cetak ?? ""}
                  onChange={(e) => setSettings({ ...settings, label_lembur_cetak: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Istilah lembur “jam masuk bebas”</span>
                <input
                  className="input"
                  placeholder="Lembur (per jam)"
                  value={settings.label_lembur_flex ?? ""}
                  onChange={(e) => setSettings({ ...settings, label_lembur_flex: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Istilah lembur libur “jam masuk bebas”</span>
                <input
                  className="input"
                  placeholder="Lembur Libur (per jam)"
                  value={settings.label_lembur_flex_libur ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, label_lembur_flex_libur: e.target.value })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Istilah “Uang Makan”</span>
                <input
                  className="input"
                  placeholder="Uang Makan"
                  value={settings.label_uang_makan ?? ""}
                  onChange={(e) => setSettings({ ...settings, label_uang_makan: e.target.value })}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-subtle">
              Kosongkan untuk memakai istilah bawaan. Perubahan berlaku di struk (layar, PDF, Excel).
            </p>
          </div>

          <button onClick={saveSettings} className="btn-primary mt-3">
            Simpan pengaturan
          </button>
        </Card>
      </div>

      {enrollMachine !== null && (
        <MachineEnrollmentsModal
          machineId={enrollMachine}
          employees={employeeList}
          onClose={() => setEnrollMachine(null)}
          onChanged={loadAll}
        />
      )}
      {infoMachine !== null && (
        <MachineInfoModal machineId={infoMachine} onClose={() => setInfoMachine(null)} />
      )}
    </div>
  );
}

function DeleteLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
    >
      <IconTrash className="text-[13px]" /> Hapus
    </button>
  );
}

function MachineRow({
  machine, onRename, onDelete, onPull, onTest, onPatch, onEnroll, onInfo,
}: {
  machine: Machine;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onPull: (id: number, users: boolean) => void;
  onTest: (id: number) => void;
  onPatch: (id: number, data: Record<string, unknown>) => void;
  onEnroll: (id: number) => void;
  onInfo: (id: number) => void;
}) {
  const [name, setName] = useState(machine.name);
  const [interval, setIntervalMin] = useState(String(machine.pullIntervalMinutes));
  const dirty = name.trim() !== machine.name && name.trim() !== "";
  const lastSeen = machine.lastSeenAt ? new Date(machine.lastSeenAt).toLocaleString("id-ID") : "belum pernah";
  const modeBadge = machine.mode === "lan"
    ? { label: `LAN ${machine.ip ?? ""}:${machine.port ?? 5005}`, c: "var(--warning)" }
    : { label: "Cloud", c: "var(--primary)" };
  const status = machine.online
    ? { label: "● Terhubung", c: "var(--success)" }
    : { label: "● Tidak terhubung", c: "var(--danger)" };
  return (
    <li className="space-y-1.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input h-9 w-40" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={() => onRename(machine.id, name.trim())} disabled={!dirty} className="btn-ghost h-9 px-3 text-xs disabled:opacity-40">Simpan</button>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={softChip(status.c)}>{status.label}</span>
        <span className="rounded-md px-2 py-0.5 text-[11px]" style={softChip(modeBadge.c)}>{modeBadge.label}</span>
        <button onClick={() => onInfo(machine.id)} className="btn-ghost h-9 px-2.5 text-xs">Info Mesin</button>
        <button onClick={() => onEnroll(machine.id)} className="btn-ghost h-9 px-2.5 text-xs">Kelola PIN</button>
        <button onClick={() => onDelete(machine.id)} className="btn-ghost h-9 px-2.5 text-xs text-danger">Hapus</button>
      </div>
      {machine.mode === "lan" && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onTest(machine.id)} className="btn-ghost h-8 px-2.5 text-xs">Test Koneksi</button>
          <button onClick={() => onPull(machine.id, false)} className="btn-ghost h-8 px-2.5 text-xs">Tarik Absensi</button>
          <button onClick={() => onPull(machine.id, true)} className="btn-ghost h-8 px-2.5 text-xs">Sinkron Karyawan</button>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              className="accent-[color:var(--primary)]"
              checked={machine.autoPull}
              onChange={(e) => onPatch(machine.id, { autoPull: e.target.checked })}
            />
            Tarik otomatis tiap
          </label>
          <input
            className="input h-8 w-16 text-xs"
            value={interval}
            onChange={(e) => setIntervalMin(e.target.value.replace(/\D/g, ""))}
            onBlur={() => { const n = Number(interval) || 15; if (n !== machine.pullIntervalMinutes) onPatch(machine.id, { pullIntervalMinutes: n }); }}
          />
          <span className="text-xs text-muted">menit</span>
        </div>
      )}
      {machine.mode !== "lan" && (
        <span className="block text-xs text-subtle">
          Mesin mode cloud mendorong sendiri datanya ke server — tak perlu &quot;tarik&quot;. Yang perlu
          diatur hanyalah pemetaan PIN → karyawan lewat <b className="text-muted">Kelola PIN</b>.
        </span>
      )}
      <span className="block text-xs text-subtle">
        SN {machine.sn} · {machine.employees} karyawan · {machine.attendances} absensi · terakhir aktif: {lastSeen}
      </span>
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-3 text-lg font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setMsg("");
    setErr("");
    if (next !== confirm) {
      setErr("Konfirmasi password tidak cocok.");
      return;
    }
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setMsg("Password berhasil diganti.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Card title="Ganti Password">
      <div className="space-y-3 text-sm">
        {msg && (
          <div className="rounded-xl px-3 py-2 text-success" style={softChip("var(--success)")}>
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded-xl px-3 py-2 text-danger" style={softChip("var(--danger)")}>
            {err}
          </div>
        )}
        <input type="password" className="input" placeholder="Password saat ini" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input type="password" className="input" placeholder="Password baru (min 6)" value={next} onChange={(e) => setNext(e.target.value)} />
        <input type="password" className="input" placeholder="Konfirmasi password baru" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button onClick={submit} className="btn-primary">
          Simpan password
        </button>
      </div>
    </Card>
  );
}
