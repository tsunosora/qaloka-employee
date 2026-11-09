-- Magang 9 Nov 2026: side quest (misi CS/Desain/Marketing + bukti anak), sekolah & guru pembimbing per
-- peserta/pendaftar, tautan pendaftaran per sekolah, lokasi pos. Hanya MENAMBAH tabel & kolom nullable.

-- AlterTable
ALTER TABLE `MagangPos` ADD COLUMN `lokasi` VARCHAR(80) NULL;

-- AlterTable
ALTER TABLE `MagangPeserta` ADD COLUMN `guruPembimbing` VARCHAR(150) NULL,
    ADD COLUMN `kontakGuru` VARCHAR(60) NULL;

-- AlterTable
ALTER TABLE `MagangDaftar` ADD COLUMN `sekolah` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `MagangPendaftar` ADD COLUMN `guruPembimbing` VARCHAR(150) NULL,
    ADD COLUMN `kontakGuru` VARCHAR(60) NULL;

-- CreateTable
CREATE TABLE `MagangMisi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kategori` VARCHAR(20) NOT NULL,
    `level` VARCHAR(20) NOT NULL DEFAULT 'dasar',
    `judul` VARCHAR(150) NOT NULL,
    `deskripsi` TEXT NULL,
    `bukti` VARCHAR(30) NOT NULL DEFAULT 'foto',
    `poin` INTEGER NOT NULL DEFAULT 10,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `MagangMisi_kategori_idx`(`kategori`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangMisiKiriman` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `misiId` INTEGER NOT NULL,
    `pesertaId` INTEGER NOT NULL,
    `teks` TEXT NULL,
    `tautan` VARCHAR(500) NULL,
    `foto` JSON NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'menunggu',
    `catatan` TEXT NULL,
    `kirimKe` INTEGER NOT NULL DEFAULT 1,
    `dikirimAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `diputusAt` DATETIME(3) NULL,
    `diputusOlehId` INTEGER NULL,
    `diputusOlehKaryawanId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangMisiKiriman_pesertaId_idx`(`pesertaId`),
    INDEX `MagangMisiKiriman_status_idx`(`status`),
    INDEX `MagangMisiKiriman_diputusOlehId_idx`(`diputusOlehId`),
    INDEX `MagangMisiKiriman_diputusOlehKaryawanId_idx`(`diputusOlehKaryawanId`),
    UNIQUE INDEX `MagangMisiKiriman_misiId_pesertaId_key`(`misiId`, `pesertaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MagangPeserta_sekolah_idx` ON `MagangPeserta`(`sekolah`);

-- AddForeignKey
ALTER TABLE `MagangMisiKiriman` ADD CONSTRAINT `MagangMisiKiriman_misiId_fkey` FOREIGN KEY (`misiId`) REFERENCES `MagangMisi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangMisiKiriman` ADD CONSTRAINT `MagangMisiKiriman_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangMisiKiriman` ADD CONSTRAINT `MagangMisiKiriman_diputusOlehId_fkey` FOREIGN KEY (`diputusOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangMisiKiriman` ADD CONSTRAINT `MagangMisiKiriman_diputusOlehKaryawanId_fkey` FOREIGN KEY (`diputusOlehKaryawanId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

