-- Pembimbing menilai tugas & mengecek jurnal dari halaman pribadinya (/me/<token>).
-- Hanya MENAMBAH kolom nullable + indeks + FK; data lama tidak berubah.

-- AlterTable
ALTER TABLE `MagangTugas` ADD COLUMN `dinilaiOlehKaryawanId` INTEGER NULL;

-- AlterTable
ALTER TABLE `MagangJurnal` ADD COLUMN `dicekOlehKaryawanId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `MagangTugas_dinilaiOlehKaryawanId_idx` ON `MagangTugas`(`dinilaiOlehKaryawanId`);

-- CreateIndex
CREATE INDEX `MagangJurnal_dicekOlehKaryawanId_idx` ON `MagangJurnal`(`dicekOlehKaryawanId`);

-- AddForeignKey
ALTER TABLE `MagangTugas` ADD CONSTRAINT `MagangTugas_dinilaiOlehKaryawanId_fkey` FOREIGN KEY (`dinilaiOlehKaryawanId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangJurnal` ADD CONSTRAINT `MagangJurnal_dicekOlehKaryawanId_fkey` FOREIGN KEY (`dicekOlehKaryawanId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
