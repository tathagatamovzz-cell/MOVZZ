-- CreateTable
CREATE TABLE "ProviderMetricsCache" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderMetricsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLTrainingData" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "hourOfDay" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "surgeMultiplier" DOUBLE PRECISION,
    "predictedScore" DOUBLE PRECISION,
    "actualOutcome" TEXT NOT NULL,
    "timeToConfirmSec" INTEGER,
    "orchestrationStrategy" TEXT,
    "contextSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLTrainingData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderMetricsCache_cacheKey_key" ON "ProviderMetricsCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ProviderMetricsCache_providerId_idx" ON "ProviderMetricsCache"("providerId");

-- CreateIndex
CREATE INDEX "ProviderMetricsCache_expiresAt_idx" ON "ProviderMetricsCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MLTrainingData_bookingId_key" ON "MLTrainingData"("bookingId");

-- CreateIndex
CREATE INDEX "MLTrainingData_providerId_idx" ON "MLTrainingData"("providerId");

-- CreateIndex
CREATE INDEX "MLTrainingData_actualOutcome_idx" ON "MLTrainingData"("actualOutcome");

-- CreateIndex
CREATE INDEX "MLTrainingData_transportMode_idx" ON "MLTrainingData"("transportMode");

-- CreateIndex
CREATE INDEX "MLTrainingData_createdAt_idx" ON "MLTrainingData"("createdAt");

-- AddForeignKey
ALTER TABLE "ProviderMetricsCache" ADD CONSTRAINT "ProviderMetricsCache_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
