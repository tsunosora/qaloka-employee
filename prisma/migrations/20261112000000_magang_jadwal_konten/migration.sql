-- Magang 12 Nov 2026: jadwal konten (meniru sheet pembina) — konsep, status, grup konten + anggota, baris
-- jadwal, dan kode anak (MagangPeserta.kodeKonten). Hanya MENAMBAH: 5 tabel baru + 1 kolom nullable unik.
-- Data lama tidak diubah. 4 status bawaan diisi INSERT IGNORE (aman bila diulang / kunci sudah ada).

-- AlterTable
ALTER TABLE `MagangPeserta` ADD COLUMN `kodeKonten` INTEGER NULL;

-- CreateTable
CREATE TABLE `MagangKontenKonsep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kunci` VARCHAR(40) NOT NULL,
    `nama` VARCHAR(60) NOT NULL,
    `sub` VARCHAR(60) NULL,
    `warna` VARCHAR(20) NOT NULL DEFAULT 'putih',
    `referensi` JSON NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangKontenKonsep_kunci_key`(`kunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangKontenStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kunci` VARCHAR(40) NOT NULL,
    `nama` VARCHAR(60) NOT NULL,
    `warna` VARCHAR(20) NOT NULL DEFAULT 'abu',
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `anakBoleh` BOOLEAN NOT NULL DEFAULT false,
    `final` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangKontenStatus_kunci_key`(`kunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangKontenGrup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(60) NOT NULL,
    `warna` VARCHAR(20) NOT NULL DEFAULT 'merah',
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangKontenGrupAnggota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grupId` INTEGER NOT NULL,
    `pesertaId` INTEGER NOT NULL,

    INDEX `MagangKontenGrupAnggota_pesertaId_idx`(`pesertaId`),
    UNIQUE INDEX `MagangKontenGrupAnggota_grupId_pesertaId_key`(`grupId`, `pesertaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangKonten` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL,
    `konsepId` INTEGER NOT NULL,
    `pesertaId` INTEGER NULL,
    `grupId` INTEGER NULL,
    `statusId` INTEGER NOT NULL,
    `judul` VARCHAR(200) NULL,
    `ref` VARCHAR(500) NULL,
    `caption` TEXT NULL,
    `linkFootage` VARCHAR(500) NULL,
    `linkEkspor` VARCHAR(500) NULL,
    `catatan` TEXT NULL,
    `usulan` BOOLEAN NOT NULL DEFAULT false,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `diubahOlehId` INTEGER NULL,
    `diubahOlehKaryawanId` INTEGER NULL,
    `selesaiAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangKonten_tanggal_idx`(`tanggal`),
    INDEX `MagangKonten_pesertaId_idx`(`pesertaId`),
    INDEX `MagangKonten_grupId_idx`(`grupId`),
    INDEX `MagangKonten_konsepId_idx`(`konsepId`),
    INDEX `MagangKonten_statusId_idx`(`statusId`),
    INDEX `MagangKonten_diubahOlehId_idx`(`diubahOlehId`),
    INDEX `MagangKonten_diubahOlehKaryawanId_idx`(`diubahOlehKaryawanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `MagangPeserta_kodeKonten_key` ON `MagangPeserta`(`kodeKonten`);

-- AddForeignKey
ALTER TABLE `MagangKontenGrupAnggota` ADD CONSTRAINT `MagangKontenGrupAnggota_grupId_fkey` FOREIGN KEY (`grupId`) REFERENCES `MagangKontenGrup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKontenGrupAnggota` ADD CONSTRAINT `MagangKontenGrupAnggota_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_konsepId_fkey` FOREIGN KEY (`konsepId`) REFERENCES `MagangKontenKonsep`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_grupId_fkey` FOREIGN KEY (`grupId`) REFERENCES `MagangKontenGrup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `MagangKontenStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_diubahOlehId_fkey` FOREIGN KEY (`diubahOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_diubahOlehKaryawanId_fkey` FOREIGN KEY (`diubahOlehKaryawanId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Status bawaan (anakBoleh = anak boleh memilih dari HP; final = hanya pembina, dihitung selesai).
INSERT IGNORE INTO `MagangKontenStatus` (`kunci`, `nama`, `warna`, `urutan`, `aktif`, `anakBoleh`, `final`, `updatedAt`) VALUES
    ('belum-take', 'Belum take', 'abu', 1, true, true, false, CURRENT_TIMESTAMP(3)),
    ('sudah-take', 'Sudah take', 'biru', 2, true, true, false, CURRENT_TIMESTAMP(3)),
    ('editing', 'Editing', 'kuning', 3, true, true, false, CURRENT_TIMESTAMP(3)),
    ('selesai', 'Selesai / Diposting', 'hijau', 4, true, false, true, CURRENT_TIMESTAMP(3));
