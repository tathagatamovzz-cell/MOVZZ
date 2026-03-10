-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "aiReliabilityScore" DOUBLE PRECISION,
ADD COLUMN     "contextSnapshot" JSONB,
ADD COLUMN     "orchestrationReasoning" TEXT,
ADD COLUMN     "orchestrationStrategy" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "timeToConfirm" INTEGER;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "currentActiveRides" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxCapacity" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePhotoKey" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';
