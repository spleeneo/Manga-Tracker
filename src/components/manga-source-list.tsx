"use client";

import { useState } from "react";
import { ExternalLink, Eye, EyeOff, GripVertical, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface MangaSourceListSource {
  id: string;
  sourceName: string;
  sourceUrl: string;
  isDisabled: boolean;
  position: number | null;
}

interface MangaSourceListProps {
  slug: string;
  sources: MangaSourceListSource[];
}

export function MangaSourceList({ slug, sources }: MangaSourceListProps) {
  const [localSources, setLocalSources] = useState(sources);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [draggingSourceId, setDraggingSourceId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
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

  const saveSourceOrder = async (nextSources: MangaSourceListSource[], previousSources: MangaSourceListSource[]) => {
    setIsSavingOrder(true);
    try {
      const res = await fetch(`/api/manga/${slug}/sources`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceIds: nextSources.map((source) => source.id) }),
      });

      if (!res.ok) throw new Error(`Failed to update source order: ${res.status}`);

      showToast({
        type: "success",
        title: "Source order saved",
      });
      window.location.reload();
    } catch (error) {
      console.error(error);
      setLocalSources(previousSources);
      showToast({
        type: "error",
        title: "Source order was not updated",
        description: "Please try again.",
      });
    } finally {
      setIsSavingOrder(false);
      setDraggingSourceId(null);
    }
  };

  const moveSource = (fromSourceId: string, toSourceId: string) => {
    if (fromSourceId === toSourceId || isSavingOrder) return;

    const previousSources = localSources;
    const fromIndex = previousSources.findIndex((source) => source.id === fromSourceId);
    const toIndex = previousSources.findIndex((source) => source.id === toSourceId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextSources = [...previousSources];
    const [movedSource] = nextSources.splice(fromIndex, 1);
    if (!movedSource) return;
    nextSources.splice(toIndex, 0, movedSource);
    const positionedSources = nextSources.map((source, position) => ({ ...source, position }));

    setLocalSources(positionedSources);
    void saveSourceOrder(positionedSources, previousSources);
  };

  if (localSources.length === 0) {
    return <p className="text-sm text-muted-foreground">No sources linked yet.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2 md:block md:space-y-2" aria-busy={isSavingOrder}>
      {localSources.map((source) => {
        const isPending = pendingSourceId === source.id;
        const ToggleIcon = source.isDisabled ? Eye : EyeOff;

        return (
          <li
            key={source.id}
            draggable={!isSavingOrder}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", source.id);
              setDraggingSourceId(source.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const movedSourceId = event.dataTransfer.getData("text/plain") || draggingSourceId;
              if (movedSourceId) moveSource(movedSourceId, source.id);
            }}
            onDragEnd={() => setDraggingSourceId(null)}
            className={`flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 transition-opacity md:w-full ${
              draggingSourceId === source.id ? "opacity-50" : ""
            }`}
          >
            <span
              className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
              aria-hidden="true"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
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
