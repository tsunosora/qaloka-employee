-- CreateTable
CREATE TABLE `MagangPos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(80) NOT NULL,
    `deskripsi` TEXT NULL,
    `durasiMinggu` INTEGER NOT NULL DEFAULT 1,
    `kapasitas` INTEGER NOT NULL DEFAULT 1,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `pembimbingId` INTEGER NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `MagangPos_pembimbingId_idx`(`pembimbingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangSoal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `posId` INTEGER NOT NULL,
    `pertanyaan` TEXT NOT NULL,
    `pilihan` JSON NOT NULL,
    `benar` INTEGER NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangSoal_posId_idx`(`posId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangPeserta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `sekolah` VARCHAR(150) NULL,
    `jurusan` VARCHAR(100) NULL,
    `mulai` DATETIME(3) NOT NULL,
    `selesai` DATETIME(3) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `catatan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangPeserta_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangPenugasan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pesertaId` INTEGER NOT NULL,
    `posId` INTEGER NOT NULL,
    `mulai` DATETIME(3) NOT NULL,
    `minggu` INTEGER NOT NULL,
    `berbagi` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MagangPenugasan_pesertaId_mulai_idx`(`pesertaId`, `mulai`),
    INDEX `MagangPenugasan_posId_idx`(`posId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangTugas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pesertaId` INTEGER NOT NULL,
    `senin` DATETIME(3) NOT NULL,
    `posId` INTEGER NULL,
    `ingatan` TEXT NOT NULL,
    `jawabanKuis` JSON NOT NULL,
    `skorKuis` INTEGER NULL,
    `terlambat` BOOLEAN NOT NULL DEFAULT false,
    `dikirimAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nilaiIngatan` INTEGER NULL,
    `ketelitian` INTEGER NULL,
    `kecepatan` INTEGER NULL,
    `inisiatif` INTEGER NULL,
    `sikap` INTEGER NULL,
    `nilai` INTEGER NULL,
    `catatanPembimbing` TEXT NULL,
    `dinilaiOlehId` INTEGER NULL,
    `dinilaiAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangTugas_posId_idx`(`posId`),
    INDEX `MagangTugas_dinilaiAt_idx`(`dinilaiAt`),
    UNIQUE INDEX `MagangTugas_pesertaId_senin_key`(`pesertaId`, `senin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MagangPos` ADD CONSTRAINT `MagangPos_pembimbingId_fkey` FOREIGN KEY (`pembimbingId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangSoal` ADD CONSTRAINT `MagangSoal_posId_fkey` FOREIGN KEY (`posId`) REFERENCES `MagangPos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangPeserta` ADD CONSTRAINT `MagangPeserta_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangPenugasan` ADD CONSTRAINT `MagangPenugasan_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangPenugasan` ADD CONSTRAINT `MagangPenugasan_posId_fkey` FOREIGN KEY (`posId`) REFERENCES `MagangPos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangTugas` ADD CONSTRAINT `MagangTugas_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangTugas` ADD CONSTRAINT `MagangTugas_posId_fkey` FOREIGN KEY (`posId`) REFERENCES `MagangPos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangTugas` ADD CONSTRAINT `MagangTugas_dinilaiOlehId_fkey` FOREIGN KEY (`dinilaiOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

