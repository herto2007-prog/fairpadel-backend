-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");
