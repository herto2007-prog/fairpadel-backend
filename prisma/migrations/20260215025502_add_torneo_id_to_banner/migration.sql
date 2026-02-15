-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "torneo_id" TEXT;

-- CreateIndex
CREATE INDEX "banners_torneo_id_idx" ON "banners"("torneo_id");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
