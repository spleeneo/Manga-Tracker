"use client";

import { useState } from "react";

export function MangaDescription({ description }: { description: string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="surface-soft rounded-lg p-4 text-sm leading-7 text-muted-foreground">
            <p className={expanded ? "" : "line-clamp-4 md:line-clamp-none"}>{description}</p>
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="mt-3 text-xs font-bold uppercase text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
                {expanded ? "Show less" : "Read summary"}
            </button>
        </div>
    );
}
