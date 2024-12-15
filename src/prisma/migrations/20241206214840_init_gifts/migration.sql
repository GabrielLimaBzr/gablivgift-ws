-- CreateTable
CREATE TABLE "Gifts" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" BYTEA NOT NULL,
    "estimatedPrice" DOUBLE PRECISION NOT NULL,
    "category" INTEGER NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gifts_pkey" PRIMARY KEY ("id")
);
