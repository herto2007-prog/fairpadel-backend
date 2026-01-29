/*
  Warnings:

  - You are about to drop the column `limite_parejas` on the `tournament_categories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tournament_id,category_id]` on the table `tournament_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tournament_id,modalidad]` on the table `tournament_modalidades` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tournament_categories" DROP COLUMN "limite_parejas";

-- CreateIndex
CREATE UNIQUE INDEX "tournament_categories_tournament_id_category_id_key" ON "tournament_categories"("tournament_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_modalidades_tournament_id_modalidad_key" ON "tournament_modalidades"("tournament_id", "modalidad");
