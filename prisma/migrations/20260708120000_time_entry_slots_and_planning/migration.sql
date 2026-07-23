-- Add time entry slot mode and planning support.
ALTER TABLE "TimeEntry" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'TIMER';
ALTER TABLE "TimeEntry" ADD COLUMN "isPlanned" BOOLEAN NOT NULL DEFAULT false;
