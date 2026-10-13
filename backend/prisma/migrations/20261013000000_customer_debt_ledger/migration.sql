-- CreateEnum
CREATE TYPE "DebtMovementType" AS ENUM ('INCREASE', 'PAYMENT');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "currentDebt" DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CustomerDebtMovement" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" "DebtMovementType" NOT NULL,
    "amount" DECIMAL(18, 2) NOT NULL,
    "balanceAfter" DECIMAL(18, 2) NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDebtMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerDebtMovement_customerId_createdAt_idx" ON "CustomerDebtMovement"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerDebtMovement_employeeId_createdAt_idx" ON "CustomerDebtMovement"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerDebtMovement" ADD CONSTRAINT "CustomerDebtMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDebtMovement" ADD CONSTRAINT "CustomerDebtMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
