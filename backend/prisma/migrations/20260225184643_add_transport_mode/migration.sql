-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('CAB', 'BIKE', 'AUTO', 'METRO');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "transportMode" "TransportMode" NOT NULL DEFAULT 'CAB';
