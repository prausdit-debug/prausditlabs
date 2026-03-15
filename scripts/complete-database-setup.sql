-- ============================================================
-- Prausdit Research Lab — Complete Database Setup with Author Tracking
-- ============================================================
-- This script creates all tables with project scoping, author tracking,
-- and edit attribution fields.
-- ============================================================

-- ─── ENUMS ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'developer', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocProgress" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DatasetType" AS ENUM ('CODE', 'TEXT', 'INSTRUCTION', 'QA', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PreprocStatus" AS ENUM ('RAW', 'CLEANING', 'CLEANED', 'FORMATTED', 'AUGMENTED', 'READY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExperimentStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuantizationType" AS ENUM ('NONE', 'INT8', 'INT4', 'GPTQ', 'GGUF', 'AWQ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ChatVisibility" AS ENUM ('team', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectType" AS ENUM ('MODEL', 'FRONTEND', 'BACKEND', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── USERS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT        NOT NULL,
    "clerkId"   TEXT        NOT NULL,
    "email"     TEXT        NOT NULL,
    "name"      TEXT,
    "imageUrl"  TEXT,
    "role"      "UserRole"  NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"   ON "User"("email");
CREATE INDEX        IF NOT EXISTS "User_clerkId_idx" ON "User"("clerkId");
CREATE INDEX        IF NOT EXISTS "User_email_idx"   ON "User"("email");
CREATE INDEX        IF NOT EXISTS "User_role_idx"    ON "User"("role");

-- ─── PROJECTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Project" (
    "id"              TEXT         NOT NULL,
    "name"            TEXT         NOT NULL,
    "type"            "ProjectType" NOT NULL,
    "description"     TEXT,
    "config"          JSONB,
    "createdById"     TEXT         NOT NULL,
    "createdByName"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Project_createdById_idx" ON "Project"("createdById");
CREATE INDEX IF NOT EXISTS "Project_type_idx" ON "Project"("type");
CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");

-- ─── ROADMAP ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RoadmapStep" (
    "id"                  TEXT         NOT NULL,
    "phase"               INTEGER      NOT NULL,
    "title"               TEXT         NOT NULL,
    "description"         TEXT         NOT NULL,
    "status"              "StepStatus" NOT NULL DEFAULT 'PENDING',
    "order"               INTEGER      NOT NULL DEFAULT 0,
    "priority"            TEXT,
    "milestone"           TEXT,
    "estimatedCompletion" TIMESTAMP(3),
    "progressPercent"     INTEGER      NOT NULL DEFAULT 0,
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RoadmapStep_phase_idx"  ON "RoadmapStep"("phase");
CREATE INDEX IF NOT EXISTS "RoadmapStep_status_idx" ON "RoadmapStep"("status");
CREATE INDEX IF NOT EXISTS "RoadmapStep_projectId_idx" ON "RoadmapStep"("projectId");

CREATE TABLE IF NOT EXISTS "RoadmapTask" (
    "id"        TEXT         NOT NULL,
    "title"     TEXT         NOT NULL,
    "completed" BOOLEAN      NOT NULL DEFAULT false,
    "stepId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapTask_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "RoadmapTask_stepId_fkey"
        FOREIGN KEY ("stepId") REFERENCES "RoadmapStep"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RoadmapTask_stepId_idx" ON "RoadmapTask"("stepId");

-- ─── DOCUMENTATION ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "DocumentationPage" (
    "id"                  TEXT          NOT NULL,
    "title"               TEXT          NOT NULL,
    "slug"                TEXT          NOT NULL,
    "content"             TEXT          NOT NULL,
    "section"             TEXT          NOT NULL,
    "order"               INTEGER       NOT NULL DEFAULT 0,
    "tags"                TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
    "progress"            "DocProgress" NOT NULL DEFAULT 'NOT_STARTED',
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentationPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentationPage_slug_key"     ON "DocumentationPage"("slug");
CREATE INDEX        IF NOT EXISTS "DocumentationPage_section_idx"  ON "DocumentationPage"("section");
CREATE INDEX        IF NOT EXISTS "DocumentationPage_slug_idx"     ON "DocumentationPage"("slug");
CREATE INDEX        IF NOT EXISTS "DocumentationPage_projectId_idx" ON "DocumentationPage"("projectId");

CREATE TABLE IF NOT EXISTS "DocVersion" (
    "id"        TEXT         NOT NULL,
    "content"   TEXT         NOT NULL,
    "version"   INTEGER      NOT NULL,
    "pageId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocVersion_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "DocVersion_pageId_fkey"
        FOREIGN KEY ("pageId") REFERENCES "DocumentationPage"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DocVersion_pageId_idx" ON "DocVersion"("pageId");

-- ─── DATASETS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Dataset" (
    "id"                  TEXT            NOT NULL,
    "name"                TEXT            NOT NULL,
    "description"         TEXT,
    "sourceUrl"           TEXT,
    "datasetType"         "DatasetType"   NOT NULL,
    "numSamples"          INTEGER,
    "sizeBytes"           BIGINT,
    "preprocessStatus"    "PreprocStatus" NOT NULL DEFAULT 'RAW',
    "tags"                TEXT[]          NOT NULL DEFAULT ARRAY[]::TEXT[],
    "format"              TEXT,
    "license"             TEXT,
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Dataset_datasetType_idx"      ON "Dataset"("datasetType");
CREATE INDEX IF NOT EXISTS "Dataset_preprocessStatus_idx" ON "Dataset"("preprocessStatus");
CREATE INDEX IF NOT EXISTS "Dataset_projectId_idx" ON "Dataset"("projectId");

-- ─── EXPERIMENTS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Experiment" (
    "id"                  TEXT               NOT NULL,
    "name"                TEXT               NOT NULL,
    "description"         TEXT,
    "baseModel"           TEXT               NOT NULL,
    "datasetId"           TEXT,
    "status"              "ExperimentStatus" NOT NULL DEFAULT 'PENDING',
    "method"              TEXT,
    "resultSummary"       TEXT,
    "config"              JSONB,
    "loraRank"            INTEGER,
    "loraAlpha"           INTEGER,
    "batchSize"           INTEGER,
    "learningRate"        DOUBLE PRECISION,
    "epochs"              INTEGER,
    "evalLoss"            DOUBLE PRECISION,
    "evalAccuracy"        DOUBLE PRECISION,
    "bleuScore"           DOUBLE PRECISION,
    "pass1Score"          DOUBLE PRECISION,
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Experiment_datasetId_fkey"
        FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Experiment_status_idx"    ON "Experiment"("status");
CREATE INDEX IF NOT EXISTS "Experiment_datasetId_idx" ON "Experiment"("datasetId");
CREATE INDEX IF NOT EXISTS "Experiment_projectId_idx" ON "Experiment"("projectId");

CREATE TABLE IF NOT EXISTS "ExperimentLog" (
    "id"           TEXT             NOT NULL,
    "experimentId" TEXT             NOT NULL,
    "step"         INTEGER          NOT NULL,
    "loss"         DOUBLE PRECISION,
    "learningRate" DOUBLE PRECISION,
    "message"      TEXT,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExperimentLog_experimentId_fkey"
        FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ExperimentLog_experimentId_idx" ON "ExperimentLog"("experimentId");

-- ─── MODEL VERSIONS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ModelVersion" (
    "id"                  TEXT               NOT NULL,
    "name"                TEXT               NOT NULL,
    "version"             TEXT               NOT NULL,
    "description"         TEXT,
    "parameterCount"      BIGINT,
    "experimentId"        TEXT,
    "quantization"        "QuantizationType",
    "deploymentFormat"    TEXT,
    "bleuScore"           DOUBLE PRECISION,
    "pass1Score"          DOUBLE PRECISION,
    "humanEval"           DOUBLE PRECISION,
    "mmluScore"           DOUBLE PRECISION,
    "fileSizeBytes"       BIGINT,
    "isDeployed"          BOOLEAN            NOT NULL DEFAULT false,
    "notes"               TEXT,
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModelVersion_experimentId_fkey"
        FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ModelVersion_version_idx"      ON "ModelVersion"("version");
CREATE INDEX IF NOT EXISTS "ModelVersion_experimentId_idx" ON "ModelVersion"("experimentId");
CREATE INDEX IF NOT EXISTS "ModelVersion_projectId_idx" ON "ModelVersion"("projectId");

-- ─── AI SETTINGS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AISettings" (
    "id"                       TEXT         NOT NULL,
    "defaultProvider"          TEXT         NOT NULL DEFAULT 'gemini',
    "geminiApiKey"             TEXT,
    "geminiDefaultModel"       TEXT         NOT NULL DEFAULT 'gemini-2.5-flash',
    "openrouterApiKey"         TEXT,
    "selectedOpenRouterModels" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedBy"                TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AISettings_pkey" PRIMARY KEY ("id")
);

-- ─── NOTES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Note" (
    "id"                  TEXT         NOT NULL,
    "title"               TEXT         NOT NULL,
    "content"             TEXT         NOT NULL,
    "tags"                TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "pinned"              BOOLEAN      NOT NULL DEFAULT false,
    "projectId"           TEXT,
    "createdByUserId"     TEXT,
    "createdByUserName"   TEXT,
    "lastEditedByUserId"  TEXT,
    "lastEditedByUserName" TEXT,
    "lastEditedAt"        TIMESTAMP(3),
    "editedWithAIModel"   TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Note_pinned_idx" ON "Note"("pinned");
CREATE INDEX IF NOT EXISTS "Note_projectId_idx" ON "Note"("projectId");

-- ─── CHAT SESSIONS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ChatSession" (
    "id"          TEXT             NOT NULL,
    "title"       TEXT             NOT NULL DEFAULT 'New Chat',
    "creatorId"   TEXT             NOT NULL,
    "creatorName" TEXT,
    "visibility"  "ChatVisibility" NOT NULL DEFAULT 'team',
    "projectId"   TEXT,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChatSession_creatorId_idx"  ON "ChatSession"("creatorId");
CREATE INDEX IF NOT EXISTS "ChatSession_visibility_idx" ON "ChatSession"("visibility");
CREATE INDEX IF NOT EXISTS "ChatSession_updatedAt_idx"  ON "ChatSession"("updatedAt");
CREATE INDEX IF NOT EXISTS "ChatSession_projectId_idx"  ON "ChatSession"("projectId");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id"        TEXT         NOT NULL,
    "sessionId" TEXT         NOT NULL,
    "role"      TEXT         NOT NULL,
    "content"   TEXT         NOT NULL,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatMessage_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- ─── FOREIGN KEYS ───────────────────────────────────────────

DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" 
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "RoadmapStep" ADD CONSTRAINT "RoadmapStep_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "DocumentationPage" ADD CONSTRAINT "DocumentationPage_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── PRISMA MIGRATION TRACKING ──────────────────────────────

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT         NOT NULL,
    "checksum"              TEXT         NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        TEXT         NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- ─── DONE ────────────────────────────────────────────────────
SELECT 'Complete database setup with author tracking and edit attribution complete!' AS status;
