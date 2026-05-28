-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Sales', 'Front Office', 'Admin');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('Enquiry', 'Tentative', 'Confirmed', 'Completed', 'Lost', 'Cancelled');

-- CreateEnum
CREATE TYPE "PricingRowType" AS ENUM ('sun-thu', 'fri', 'sat', 'fri-sat', 'custom');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('Conference Room', 'Seminar Room', 'Garden Venue', 'Event Place');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('Tentative', 'Confirmed');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('Available', 'Partially Used', 'Fully Used');

-- CreateEnum
CREATE TYPE "UpgradeKind" AS ENUM ('complimentary', 'paid');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('standard', 'special');

-- CreateEnum
CREATE TYPE "CancellationResolution" AS ENUM ('refund', 'credit-note');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "weekdayDiscount" DOUBLE PRECISION NOT NULL,
    "fridayDiscount" DOUBLE PRECISION NOT NULL,
    "weekendDiscount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RoomMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomInventoryItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "blockedReason" TEXT,

    CONSTRAINT "RoomInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "guest" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "rex" TEXT NOT NULL,
    "checkin" TEXT NOT NULL,
    "checkout" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "kidsAbove10" INTEGER NOT NULL,
    "kids6to10" INTEGER NOT NULL,
    "kids2to6" INTEGER NOT NULL,
    "infantsBelow2" INTEGER NOT NULL,
    "seniors" INTEGER NOT NULL,
    "pets" INTEGER NOT NULL,
    "mealOn" BOOLEAN NOT NULL,
    "mealTotal" DOUBLE PRECISION NOT NULL,
    "mealGst" DOUBLE PRECISION NOT NULL,
    "petTotal" DOUBLE PRECISION NOT NULL,
    "petGst" DOUBLE PRECISION NOT NULL,
    "driverCount" INTEGER,
    "driverTotal" DOUBLE PRECISION,
    "driverGst" DOUBLE PRECISION,
    "driverMealOn" BOOLEAN,
    "driverMealTotal" DOUBLE PRECISION,
    "driverMealGst" DOUBLE PRECISION,
    "totalRoomCharges" DOUBLE PRECISION NOT NULL,
    "totalMealCharges" DOUBLE PRECISION NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "advance" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "allocatedRooms" TEXT[],
    "lostReason" TEXT,
    "lostNotes" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRow" (
    "id" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rowType" "PricingRowType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "tariff" DOUBLE PRECISION NOT NULL,
    "nights" INTEGER NOT NULL,
    "numRooms" INTEGER NOT NULL,
    "roomCharges" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL,
    "discountAmt" DOUBLE PRECISION NOT NULL,
    "netCharges" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL,
    "gstAmt" DOUBLE PRECISION NOT NULL,
    "totalAmt" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PricingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL,
    "by" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extra" (
    "id" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION,
    "totalPaid" DOUBLE PRECISION,
    "date" TEXT NOT NULL,
    "by" TEXT NOT NULL,

    CONSTRAINT "Extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomNightOverride" (
    "id" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,

    CONSTRAINT "RoomNightOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomNightUpgrade" (
    "id" SERIAL NOT NULL,
    "overrideId" INTEGER NOT NULL,
    "fromCategory" TEXT NOT NULL,
    "fromCategoryName" TEXT NOT NULL,
    "toCategory" TEXT NOT NULL,
    "toCategoryName" TEXT NOT NULL,
    "upgradeDate" TEXT NOT NULL,
    "kind" "UpgradeKind" NOT NULL,
    "extraAmount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "by" TEXT NOT NULL,

    CONSTRAINT "RoomNightUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedCreditNote" (
    "bookingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AppliedCreditNote_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "CancellationDetails" (
    "bookingId" TEXT NOT NULL,
    "cancellationDate" TEXT NOT NULL,
    "daysBeforeCheckin" INTEGER NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "cancellationCharge" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "creditNoteAmount" DOUBLE PRECISION NOT NULL,
    "resolution" "CancellationResolution" NOT NULL,
    "creditNoteCode" TEXT,
    "processedBy" TEXT NOT NULL,

    CONSTRAINT "CancellationDetails_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "code" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestMobile" TEXT NOT NULL,
    "originalBookingId" TEXT NOT NULL,
    "cancellationDate" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "usedAmount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "status" "CreditNoteStatus" NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CreditNoteTransaction" (
    "id" SERIAL NOT NULL,
    "creditNoteCode" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountUsed" DOUBLE PRECISION NOT NULL,
    "remainingAfter" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CreditNoteTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SpecialDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VenueType" NOT NULL,
    "capacity" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueBlock" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "checkin" TEXT NOT NULL,
    "checkout" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BlockStatus",
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "VenueBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRoomBlock" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "checkin" TEXT NOT NULL,
    "checkout" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BlockStatus" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "BulkRoomBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRoomBlockRow" (
    "id" SERIAL NOT NULL,
    "blockId" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "catName" TEXT NOT NULL,
    "roomIds" TEXT[],

    CONSTRAINT "BulkRoomBlockRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "threshold" DOUBLE PRECISION NOT NULL,
    "belowRate" DOUBLE PRECISION NOT NULL,
    "aboveRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GstSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCaps" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "sales" DOUBLE PRECISION NOT NULL,
    "admin" DOUBLE PRECISION,

    CONSTRAINT "DiscountCaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRates" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mealPerAdultPerNight" DOUBLE PRECISION NOT NULL,
    "petPerPetPerNight" DOUBLE PRECISION NOT NULL,
    "driverPerNight" DOUBLE PRECISION NOT NULL,
    "individualBreakfast" DOUBLE PRECISION NOT NULL,
    "individualLunchHighTea" DOUBLE PRECISION NOT NULL,
    "individualOnlyDinner" DOUBLE PRECISION NOT NULL,
    "individualBbqEveningDinner" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PackageRates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,

    CONSTRAINT "CreditNoteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "standardThreshold" INTEGER NOT NULL,
    "specialThreshold" INTEGER NOT NULL,
    "notes" TEXT[],
    "standardAboveChargePct" DOUBLE PRECISION NOT NULL,
    "standardAboveRefundPct" DOUBLE PRECISION,
    "standardAboveCreditNotePct" DOUBLE PRECISION,
    "standardBelowChargePct" DOUBLE PRECISION NOT NULL,
    "standardBelowRefundPct" DOUBLE PRECISION,
    "standardBelowCreditNotePct" DOUBLE PRECISION,
    "specialAboveChargePct" DOUBLE PRECISION NOT NULL,
    "specialAboveRefundPct" DOUBLE PRECISION,
    "specialAboveCreditNotePct" DOUBLE PRECISION,
    "specialBelowChargePct" DOUBLE PRECISION NOT NULL,
    "specialBelowRefundPct" DOUBLE PRECISION,
    "specialBelowCreditNotePct" DOUBLE PRECISION,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomNightUpgrade_overrideId_key" ON "RoomNightUpgrade"("overrideId");

-- AddForeignKey
ALTER TABLE "PricingRow" ADD CONSTRAINT "PricingRow_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extra" ADD CONSTRAINT "Extra_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomNightOverride" ADD CONSTRAINT "RoomNightOverride_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomNightUpgrade" ADD CONSTRAINT "RoomNightUpgrade_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "RoomNightOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedCreditNote" ADD CONSTRAINT "AppliedCreditNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationDetails" ADD CONSTRAINT "CancellationDetails_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteTransaction" ADD CONSTRAINT "CreditNoteTransaction_creditNoteCode_fkey" FOREIGN KEY ("creditNoteCode") REFERENCES "CreditNote"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueBlock" ADD CONSTRAINT "VenueBlock_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkRoomBlockRow" ADD CONSTRAINT "BulkRoomBlockRow_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "BulkRoomBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
