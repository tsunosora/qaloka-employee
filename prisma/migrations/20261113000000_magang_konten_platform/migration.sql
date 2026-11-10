-- Magang 13 Nov 2026: jadwal konten multi-platform. Tabel MagangKontenPlatform + MagangKonten.platformId (wajib).
-- Data lama TIDAK dihapus/diubah selain mengisi platformId: semua baris yang ada menjadi milik platform
-- "Voliko Print" (kunci 'voliko-print'). Brief lama (Setting `magang_konten_brief`) DISALIN ke brief platform itu;
-- baris Setting-nya DIBIARKAN sebagai cadangan (tidak dibaca aplikasi lagi). Tanpa DELETE / DROP.
-- Langkah data aman diulang: INSERT IGNORE per kunci unik, UPDATE hanya baris yang masih NULL.

-- CreateTable
CREATE TABLE IF NOT EXISTS `MagangKontenPlatform` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(80) NOT NULL,
    `kunci` VARCHAR(60) NOT NULL,
    `warna` VARCHAR(20) NOT NULL DEFAULT 'putih',
    `ikon` VARCHAR(40) NULL,
    `brief` JSON NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `diarsipkanAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangKontenPlatform_kunci_key`(`kunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Platform pertama: semua jadwal yang sudah ada adalah jadwal Voliko Print.
INSERT IGNORE INTO `MagangKontenPlatform` (`nama`, `kunci`, `warna`, `ikon`, `urutan`, `aktif`, `updatedAt`) VALUES
    ('Voliko Print', 'voliko-print', 'putih', 'instagram', 1, true, CURRENT_TIMESTAMP(3));

-- Salin brief lama (JSON di Setting.value) ke brief Voliko Print — hanya bila brief platform masih kosong
-- dan isi Setting JSON yang sah. Setting tidak dihapus.
UPDATE `MagangKontenPlatform` p
    JOIN `Setting` s ON s.`key` = 'magang_konten_brief'
SET p.`brief` = s.`value`
WHERE p.`kunci` = 'voliko-print' AND p.`brief` IS NULL AND s.`value` IS NOT NULL AND JSON_VALID(s.`value`);

-- AlterTable: kolom dulu boleh NULL → isi → baru NOT NULL.
ALTER TABLE `MagangKonten` ADD COLUMN `platformId` INTEGER NULL;

UPDATE `MagangKonten`
SET `platformId` = (SELECT `id` FROM `MagangKontenPlatform` WHERE `kunci` = 'voliko-print')
WHERE `platformId` IS NULL;

ALTER TABLE `MagangKonten` MODIFY `platformId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `MagangKonten_platformId_tanggal_idx` ON `MagangKonten`(`platformId`, `tanggal`);

-- AddForeignKey
ALTER TABLE `MagangKonten` ADD CONSTRAINT `MagangKonten_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `MagangKontenPlatform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
