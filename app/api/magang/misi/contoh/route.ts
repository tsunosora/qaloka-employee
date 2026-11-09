import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { CONTOH_MISI } from "@/lib/services/magang/contoh-misi";
import { gabungBukti } from "@/lib/services/magang/misi";
import { pastikanKategoriAwal } from "@/lib/services/magang/misi-db";

/** Isi bank side quest awal. Hanya bila BELUM ada misi sama sekali (tidak menimpa). */
export const POST = route(async () => {
  await requireManager();
  const sudah = await prisma.magangMisi.count({ where: { deletedAt: null } });
  if (sudah > 0) {
    return NextResponse.json({ message: "Sudah ada misi — bank awal hanya dipakai saat daftar misi masih kosong." }, { status: 409 });
  }
  // Misi contoh merujuk kategori bawaan (cs/desain/marketing) lewat FOREIGN KEY → pastikan ada dulu.
  // Hanya INSERT biasa (bukan DDL), kategori yang sudah ada tidak diubah.
  await pastikanKategoriAwal(prisma);
  await prisma.magangMisi.createMany({
    data: CONTOH_MISI.map((m, i) => ({ ...m, bukti: gabungBukti(m.bukti), urutan: i + 1 })),
  });
  return json({ ok: true, dibuat: CONTOH_MISI.length }, { status: 201 });
});
