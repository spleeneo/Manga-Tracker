"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";

export function UpdateLibraryButton() {
    const [loading, setLoading] = useState(false);
    const { showToast, updateToast } = useToast();

    const updateLibrary = async () => {
        setLoading(true);
        const toastId = showToast({
            type: "loading",
            title: "Library update started",
            description: "Checking providers in the background.",
        });
        try {
            const res = await fetch("/api/manga/updates", {
                method: "POST",
            });
            if (!res.ok) throw new Error(`Library update failed: ${res.status}`);
            const body = await res.json();
            updateToast(toastId, {
                type: "success",
                title: "Library update queued",
                description: `${body.queued ?? 0} manga will refresh in the background.`,
            });
            window.dispatchEvent(new Event("mangateo:library-refresh"));
        } catch (error) {
            console.error(error);
            updateToast(toastId, {
                type: "error",
                title: "Library update failed",
                description: "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={updateLibrary}
            disabled={loading}
            className="ui-button ui-button-secondary"
            title="Check all tracked manga for new chapters"
        >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Updating..." : "Update Library"}
        </button>
    );
}
