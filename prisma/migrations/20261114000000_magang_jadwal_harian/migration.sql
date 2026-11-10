-- Magang 14 Nov 2026: jadwal harian berpasangan (KONTEN / PRODUKSI bergantian tiap hari kerja) — pasangan anak +
-- pengecualian per tanggal dari pembina. Hanya MENAMBAH 2 tabel baru; tabel lama dan datanya tidak disentuh.
-- Tanpa data bawaan (pasangan Voliko diisi skrip tools/magang/voliko-jadwal-harian.ts, langkah terpisah).

-- CreateTable
CREATE TABLE `MagangPasangan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(80) NULL,
    `pesertaAId` INTEGER NOT NULL,
    `pesertaBId` INTEGER NULL,
    `patokanTanggal` DATETIME(3) NOT NULL,
    `patokanTugas` VARCHAR(10) NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangPasangan_pesertaAId_idx`(`pesertaAId`),
    INDEX `MagangPasangan_pesertaBId_idx`(`pesertaBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangHarianPengecualian` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL,
    `pasanganId` INTEGER NULL,
    `pesertaId` INTEGER NULL,
    `jenis` VARCHAR(20) NOT NULL,
    `tugas` VARCHAR(10) NULL,
    `pasanganPesertaId` INTEGER NULL,
    `catatan` VARCHAR(200) NULL,
    `dibuatOlehId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangHarianPengecualian_tanggal_idx`(`tanggal`),
    INDEX `MagangHarianPengecualian_pasanganId_idx`(`pasanganId`),
    INDEX `MagangHarianPengecualian_pesertaId_idx`(`pesertaId`),
    INDEX `MagangHarianPengecualian_pasanganPesertaId_idx`(`pasanganPesertaId`),
    INDEX `MagangHarianPengecualian_dibuatOlehId_idx`(`dibuatOlehId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MagangPasangan` ADD CONSTRAINT `MagangPasangan_pesertaAId_fkey` FOREIGN KEY (`pesertaAId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangPasangan` ADD CONSTRAINT `MagangPasangan_pesertaBId_fkey` FOREIGN KEY (`pesertaBId`) REFERENCES `MagangPeserta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangHarianPengecualian` ADD CONSTRAINT `MagangHarianPengecualian_pasanganId_fkey` FOREIGN KEY (`pasanganId`) REFERENCES `MagangPasangan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangHarianPengecualian` ADD CONSTRAINT `MagangHarianPengecualian_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangHarianPengecualian` ADD CONSTRAINT `MagangHarianPengecualian_pasanganPesertaId_fkey` FOREIGN KEY (`pasanganPesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangHarianPengecualian` ADD CONSTRAINT `MagangHarianPengecualian_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

