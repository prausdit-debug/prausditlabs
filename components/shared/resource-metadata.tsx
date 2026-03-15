"use client"

import { User, Calendar, Edit3, Sparkles } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface ResourceMetadataProps {
  createdByUserName?: string | null
  createdAt?: string | Date | null
  createdWithAIModel?: string | null
  lastEditedByUserName?: string | null
  lastEditedAt?: string | Date | null
  editedWithAIModel?: string | null
  compact?: boolean
}

export function ResourceMetadata({
  createdByUserName,
  createdAt,
  createdWithAIModel,
  lastEditedByUserName,
  lastEditedAt,
  editedWithAIModel,
  compact = false,
}: ResourceMetadataProps) {
  const hasCreator = createdByUserName || createdAt
  const hasEditor = lastEditedByUserName || lastEditedAt

  if (!hasCreator && !hasEditor) return null

  const formatCreatorText = () => {
    if (!createdByUserName) return null
    if (createdWithAIModel) {
      return `${createdByUserName} using ${createdWithAIModel}`
    }
    return createdByUserName
  }

  const formatEditorText = () => {
    if (!lastEditedByUserName) return null
    if (editedWithAIModel) {
      return `${lastEditedByUserName} using ${editedWithAIModel}`
    }
    return lastEditedByUserName
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {createdByUserName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {formatCreatorText()}
          </span>
        )}
        {createdAt && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(createdAt)}
          </span>
        )}
        {lastEditedByUserName && (
          <span className="flex items-center gap-1">
            <Edit3 className="w-3 h-3" />
            Edited by {formatEditorText()}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 text-[12px] text-muted-foreground border-l-2 border-amber-500/30 pl-3 py-1">
      {createdByUserName && (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-amber-500/70" />
          <span>
            Author: <span className="text-foreground">{formatCreatorText()}</span>
          </span>
          {createdWithAIModel && (
            <Sparkles className="w-3 h-3 text-amber-500" />
          )}
        </div>
      )}
      {createdAt && (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-amber-500/70" />
          <span>
            Created: <span className="text-foreground">{formatDate(createdAt)}</span>
          </span>
        </div>
      )}
      {lastEditedByUserName && (
        <div className="flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 text-amber-500/70" />
          <span>
            Edited by: <span className="text-foreground">{formatEditorText()}</span>
          </span>
          {editedWithAIModel && (
            <Sparkles className="w-3 h-3 text-amber-500" />
          )}
          {lastEditedAt && (
            <span className="text-muted-foreground/70">
              ({formatDate(lastEditedAt)})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
