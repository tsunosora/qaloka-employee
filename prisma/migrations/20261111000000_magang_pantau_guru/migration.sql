-- Magang 11 Nov 2026: pantauan guru sekolah — tautan hanya-baca + PIN per sekolah (/pantau/<token>).
-- Hanya MENAMBAH satu tabel. kunciAktif (unik, NULL sesudah dicabut) = satu tautan aktif per sekolah.

-- CreateTable
CREATE TABLE `MagangPantau` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sekolahKunci` VARCHAR(150) NOT NULL,
    `sekolahLabel` VARCHAR(150) NOT NULL,
    `kunciAktif` VARCHAR(150) NULL,
    `token` VARCHAR(64) NOT NULL,
    `pinHash` VARCHAR(100) NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `kedaluwarsa` DATETIME(3) NULL,
    `tampilLampiranIzin` BOOLEAN NOT NULL DEFAULT false,
    `terakhirDibukaAt` DATETIME(3) NULL,
    `dibukaKali` INTEGER NOT NULL DEFAULT 0,
    `dicabutAt` DATETIME(3) NULL,
    `dibuatOlehId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangPantau_kunciAktif_key`(`kunciAktif`),
    UNIQUE INDEX `MagangPantau_token_key`(`token`),
    INDEX `MagangPantau_sekolahKunci_idx`(`sekolahKunci`),
    INDEX `MagangPantau_dibuatOlehId_idx`(`dibuatOlehId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MagangPantau` ADD CONSTRAINT `MagangPantau_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
