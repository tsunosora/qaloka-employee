-- Izin 10 Nov 2026: lampiran pengajuan izin/sakit (foto surat dokter atau PDF), maks 3 per pengajuan.
-- Berkasnya di storage/izin; tabel ini hanya catatannya. Hanya MENAMBAH satu tabel.

-- CreateTable
CREATE TABLE `LeaveLampiran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveRequestId` INTEGER NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `nama` VARCHAR(150) NOT NULL,
    `tipe` VARCHAR(50) NOT NULL,
    `ukuran` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeaveLampiran_leaveRequestId_idx`(`leaveRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaveLampiran` ADD CONSTRAINT `LeaveLampiran_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `LeaveRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
