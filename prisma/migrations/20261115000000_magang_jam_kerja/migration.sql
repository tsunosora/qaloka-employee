-- Magang 15 Nov 2026: jam kerja khusus anak magang — per sekolah (tabel baru MagangJamSekolah) + pengecualian per anak
-- (3 kolom NULLABLE baru di MagangPeserta). Hanya MENAMBAH; data lama tidak disentuh, tanpa data bawaan.
-- Semua kolom baru NULL = perilaku lama (jam toko & toleransi umum) — karyawan biasa tidak terpengaruh.
-- Jam Voliko diisi skrip tools/magang/voliko-jam-kerja.ts (langkah terpisah).

-- AlterTable
ALTER TABLE `MagangPeserta` ADD COLUMN `jamMasuk` VARCHAR(5) NULL,
    ADD COLUMN `jamPulang` VARCHAR(5) NULL,
    ADD COLUMN `toleransiMenit` INTEGER NULL;

-- CreateTable
CREATE TABLE `MagangJamSekolah` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sekolahKunci` VARCHAR(150) NOT NULL,
    `sekolahLabel` VARCHAR(150) NOT NULL,
    `jamMasuk` VARCHAR(5) NOT NULL,
    `jamPulang` VARCHAR(5) NOT NULL,
    `toleransiMenit` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangJamSekolah_sekolahKunci_key`(`sekolahKunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
