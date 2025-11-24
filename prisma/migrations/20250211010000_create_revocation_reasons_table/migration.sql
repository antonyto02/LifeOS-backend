-- CreateTable
CREATE TABLE "revocation_reasons" (
    "id" UUID NOT NULL,
    "reason_code" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revocation_reasons_pkey" PRIMARY KEY ("id")
);
