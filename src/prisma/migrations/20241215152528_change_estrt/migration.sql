-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_coupleId_fkey";

-- AlterTable
ALTER TABLE "Gift" ALTER COLUMN "coupleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;
