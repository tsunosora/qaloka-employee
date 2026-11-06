import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { CONTOH_POS } from "@/lib/services/magang/contoh-pos";

/** Isi contoh 7 pos percetakan + soalnya. Hanya bila BELUM ada pos sama sekali (tidak menimpa). */
export const POST = route(async () => {
  await requireManager();
  const sudah = await prisma.magangPos.count({ where: { deletedAt: null } });
  if (sudah > 0) {
    return NextResponse.json({ message: "Sudah ada pos kerja — contoh hanya dipakai saat daftar pos masih kosong." }, { status: 409 });
  }
  await prisma.$transaction(
    CONTOH_POS.map((p, i) =>
      prisma.magangPos.create({
        data: {
          nama: p.nama,
          deskripsi: p.deskripsi,
          durasiMinggu: p.durasiMinggu,
          urutan: i + 1,
          soal: { create: p.soal.map((s) => ({ pertanyaan: s.pertanyaan, pilihan: s.pilihan, benar: s.benar })) },
        },
      })
    )
  );
  return json({ ok: true, dibuat: CONTOH_POS.length }, { status: 201 });
});
