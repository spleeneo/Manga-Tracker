"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";

export function CheckUpdatesButton({ slug }: { slug: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showToast, updateToast } = useToast();

    const handleCheck = async () => {
        setLoading(true);
        const toastId = showToast({
            type: "loading",
            title: "Manga update queued",
            description: "Checking this manga in the background.",
        });
        try {
            const res = await fetch(`/api/manga/${slug}/check-updates`, {
                method: "POST"
            });

            if (!res.ok) throw new Error("Failed to check updates");

            updateToast(toastId, {
                type: "success",
                title: "Manga update started",
                description: "Refreshes will appear as soon as the sync finishes.",
            });
            router.refresh();
        } catch (error) {
            console.error(error);
            updateToast(toastId, {
                type: "error",
                title: "Update was not started",
                description: "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheck}
            disabled={loading}
            className="ui-button ui-button-secondary"
        >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Sync Manga"}
        </button>
    );
}
