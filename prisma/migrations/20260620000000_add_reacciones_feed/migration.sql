-- CreateTable
CREATE TABLE "reacciones_feed" (
    "id" TEXT NOT NULL,
    "feed_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reacciones_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reacciones_feed_feed_item_id_idx" ON "reacciones_feed"("feed_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "reacciones_feed_feed_item_id_user_id_key" ON "reacciones_feed"("feed_item_id", "user_id");

-- AddForeignKey
ALTER TABLE "reacciones_feed" ADD CONSTRAINT "reacciones_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
