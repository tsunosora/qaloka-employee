-- Magang 10 Nov 2026: kategori side quest dikelola admin (sebelumnya tetap di kode: cs/desain/marketing).
-- Isi MagangMisi & MagangMisiKiriman TIDAK diubah: kolom MagangMisi.kategori tetap menyimpan kunci yang
-- sama; hanya dilebarkan (20 → 40) dan diberi FOREIGN KEY ke MagangMisiKategori.kunci.

-- CreateTable
CREATE TABLE IF NOT EXISTS `MagangMisiKategori` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kunci` VARCHAR(40) NOT NULL,
    `nama` VARCHAR(80) NOT NULL,
    `ringkas` VARCHAR(200) NULL,
    `prioritas` VARCHAR(30) NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MagangMisiKategori_kunci_key`(`kunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Isi awal: tiga kategori lama dengan label/prioritas/ringkas yang sama seperti di kode sebelumnya.
-- INSERT IGNORE = idempoten: aman dijalankan ulang, kategori yang sudah ada (kunci sama) tidak disentuh.
INSERT IGNORE INTO `MagangMisiKategori` (`kunci`, `nama`, `ringkas`, `prioritas`, `urutan`, `aktif`, `updatedAt`) VALUES
    ('cs', 'Customer Service', 'Penjualan, komunikasi efektif, solutif & persuasif', 'Menengah', 1, true, CURRENT_TIMESTAMP(3)),
    ('desain', 'Desain Grafis', 'Canva, CorelDraw, pola & pattern jersey', 'Menengah', 2, true, CURRENT_TIMESTAMP(3)),
    ('marketing', 'Digital Marketing', 'Remarketing, Meta Ads, Shopee Ads', 'Rendah', 3, true, CURRENT_TIMESTAMP(3));

-- Kunci lain yang sudah dipakai misi (data lama/manual) ikut dibuatkan kategori (nama = kuncinya) supaya
-- FOREIGN KEY di bawah tidak gagal. Juga INSERT IGNORE → idempoten. Admin bisa mengganti namanya nanti.
INSERT IGNORE INTO `MagangMisiKategori` (`kunci`, `nama`, `urutan`, `aktif`, `updatedAt`)
    SELECT DISTINCT `kategori`, `kategori`, 99, true, CURRENT_TIMESTAMP(3) FROM `MagangMisi`;

-- AlterTable (hanya melebarkan kolom; nilainya tetap)
ALTER TABLE `MagangMisi` MODIFY `kategori` VARCHAR(40) NOT NULL;

-- AddForeignKey (indeks `MagangMisi_kategori_idx` sudah ada sejak 20261109000000 dan dipakai FK ini)
ALTER TABLE `MagangMisi` ADD CONSTRAINT `MagangMisi_kategori_fkey` FOREIGN KEY (`kategori`) REFERENCES `MagangMisiKategori`(`kunci`) ON DELETE RESTRICT ON UPDATE CASCADE;
