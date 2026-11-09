-- CreateTable
CREATE TABLE `MagangJurnal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pesertaId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `posId` INTEGER NULL,
    `kegiatan` TEXT NOT NULL,
    `kendala` TEXT NULL,
    `foto` JSON NOT NULL,
    `komentar` TEXT NULL,
    `dicekAt` DATETIME(3) NULL,
    `dicekOlehId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MagangJurnal_dicekAt_idx`(`dicekAt`),
    UNIQUE INDEX `MagangJurnal_pesertaId_tanggal_key`(`pesertaId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangDaftar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(36) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `berlakuSampai` DATETIME(3) NOT NULL,
    `mulaiMagang` DATETIME(3) NULL,
    `selesaiMagang` DATETIME(3) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MagangDaftar_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MagangPendaftar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `daftarId` INTEGER NOT NULL,
    `token` VARCHAR(36) NOT NULL,
    `namaLengkap` VARCHAR(150) NOT NULL,
    `panggilan` VARCHAR(50) NULL,
    `hp` VARCHAR(30) NULL,
    `sekolah` VARCHAR(150) NULL,
    `jurusan` VARCHAR(100) NULL,
    `mulai` DATETIME(3) NOT NULL,
    `selesai` DATETIME(3) NULL,
    `pinHash` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'menunggu',
    `alasanTolak` VARCHAR(255) NULL,
    `employeeId` INTEGER NULL,
    `diputusAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MagangPendaftar_token_key`(`token`),
    INDEX `MagangPendaftar_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MagangJurnal` ADD CONSTRAINT `MagangJurnal_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `MagangPeserta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangJurnal` ADD CONSTRAINT `MagangJurnal_posId_fkey` FOREIGN KEY (`posId`) REFERENCES `MagangPos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangJurnal` ADD CONSTRAINT `MagangJurnal_dicekOlehId_fkey` FOREIGN KEY (`dicekOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MagangPendaftar` ADD CONSTRAINT `MagangPendaftar_daftarId_fkey` FOREIGN KEY (`daftarId`) REFERENCES `MagangDaftar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

