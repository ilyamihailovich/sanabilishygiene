-- Время повторного визита для события в календаре пациента
ALTER TABLE "Visit" ADD COLUMN "nextVisitTime" TEXT;
