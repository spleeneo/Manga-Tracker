"use client";

import { useState } from "react";
import { ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface MangaSourceListSource {
  id: string;
  sourceName: string;
  sourceUrl: string;
  isDisabled: boolean;
}

interface MangaSourceListProps {
  slug: string;
  sources: MangaSourceListSource[];
}

export function MangaSourceList({ slug, sources }: MangaSourceListProps) {
  const [localSources, setLocalSources] = useState(sources);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const { showToast } = useToast();

  const setSourceDisabled = async (sourceId: string, disabled: boolean) => {
    setPendingSourceId(sourceId);
    const previousSources = localSources;
    setLocalSources((currentSources) => currentSources.map((source) => (
      source.id === sourceId ? { ...source, isDisabled: disabled } : source
    )));

    try {
      const res = await fetch(`/api/manga/${slug}/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled }),
      });

      if (!res.ok) throw new Error(`Failed to update source: ${res.status}`);

      showToast({
        type: "success",
        title: disabled ? "Source disabled" : "Source enabled",
      });
      window.location.reload();
    } catch (error) {
      console.error(error);
      setLocalSources(previousSources);
      showToast({
        type: "error",
        title: "Source was not updated",
        description: "Please try again.",
      });
    } finally {
      setPendingSourceId(null);
    }
  };

  if (localSources.length === 0) {
    return <p className="text-sm text-muted-foreground">No sources linked yet.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2 md:block md:space-y-2">
      {localSources.map((source) => {
        const isPending = pendingSourceId === source.id;
        const ToggleIcon = source.isDisabled ? Eye : EyeOff;

        return (
          <li key={source.id} className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 md:w-full">
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                source.isDisabled ? "text-muted-foreground/70 line-through" : "text-muted-foreground"
              }`}
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{source.sourceName}</span>
            </a>
            <button
              type="button"
              onClick={() => void setSourceDisabled(source.id, !source.isDisabled)}
              disabled={isPending}
              className="ui-icon-button h-7 w-7 shrink-0"
              aria-label={`${source.isDisabled ? "Enable" : "Disable"} ${source.sourceName}`}
              title={`${source.isDisabled ? "Enable" : "Disable"} ${source.sourceName}`}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ToggleIcon className="h-3.5 w-3.5" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
