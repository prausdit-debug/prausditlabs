-- Add Projects Table and Project Scoping
-- Migration for Prausdit Research Lab

-- Create ProjectType enum
DO $$ BEGIN
    CREATE TYPE "ProjectType" AS ENUM ('MODEL', 'FRONTEND', 'BACKEND', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Project table
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "description" TEXT,
    "config" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- Add indexes for Project
CREATE INDEX IF NOT EXISTS "Project_createdById_idx" ON "Project"("createdById");
CREATE INDEX IF NOT EXISTS "Project_type_idx" ON "Project"("type");
CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");

-- Add projectId to RoadmapStep
ALTER TABLE "RoadmapStep" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "RoadmapStep_projectId_idx" ON "RoadmapStep"("projectId");

-- Add projectId and author fields to DocumentationPage
ALTER TABLE "DocumentationPage" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "DocumentationPage" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "DocumentationPage" ADD COLUMN IF NOT EXISTS "authorName" TEXT;
CREATE INDEX IF NOT EXISTS "DocumentationPage_projectId_idx" ON "DocumentationPage"("projectId");

-- Add projectId to Dataset
ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Dataset_projectId_idx" ON "Dataset"("projectId");

-- Add projectId to Experiment
ALTER TABLE "Experiment" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Experiment_projectId_idx" ON "Experiment"("projectId");

-- Add projectId to ModelVersion
ALTER TABLE "ModelVersion" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "ModelVersion_projectId_idx" ON "ModelVersion"("projectId");

-- Add projectId to Note
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Note_projectId_idx" ON "Note"("projectId");

-- Add projectId to ChatSession
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "ChatSession_projectId_idx" ON "ChatSession"("projectId");

-- Add foreign key constraints (safe to run multiple times)
DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" 
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "RoadmapStep" ADD CONSTRAINT "RoadmapStep_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "DocumentationPage" ADD CONSTRAINT "DocumentationPage_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Done
SELECT 'Projects table and projectId columns added successfully' AS status;
