-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "dailyLimit" SET DEFAULT 5000.00;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "signature" TEXT;

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "receiverIban" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "stepUpThreshold" DECIMAL(65,30) NOT NULL DEFAULT 1000.00,
    "minDailyLimit" DECIMAL(65,30) NOT NULL DEFAULT 100.00,
    "maxDailyLimit" DECIMAL(65,30) NOT NULL DEFAULT 50000.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

