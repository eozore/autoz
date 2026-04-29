-- CreateTable
CREATE TABLE "appointment_services" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_ownership_history" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_ownership_history_pkey" PRIMARY KEY ("id")
);

-- AlterTable: appointments - add vehicle_id and quilometragem
ALTER TABLE "appointments" ADD COLUMN "vehicle_id" TEXT;
ALTER TABLE "appointments" ADD COLUMN "quilometragem" INTEGER;

-- AlterTable: appointments - make service_id nullable
ALTER TABLE "appointments" ALTER COLUMN "service_id" DROP NOT NULL;

-- AlterTable: vehicles - add quilometragem and cor
ALTER TABLE "vehicles" ADD COLUMN "quilometragem" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "cor" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointment_services_appointment_id_service_id_key" ON "appointment_services"("appointment_id", "service_id");

-- CreateIndex
CREATE INDEX "appointment_services_appointment_id_idx" ON "appointment_services"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_services_service_id_idx" ON "appointment_services"("service_id");

-- CreateIndex
CREATE INDEX "vehicle_ownership_history_vehicle_id_idx" ON "vehicle_ownership_history"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_ownership_history_client_id_idx" ON "vehicle_ownership_history"("client_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
