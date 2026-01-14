"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckUpdatesButton({ slug }: { slug: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCheck = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/manga/${slug}/check-updates`, {
                method: "POST"
            });

            if (!res.ok) throw new Error("Failed to check updates");

            const data = await res.json();
            console.log("Update results:", data);

            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to check for updates");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Checking..." : "Check Updates"}
        </button>
    );
}
