"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdateLibraryButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const updateLibrary = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/manga/updates", {
                method: "POST",
            });
            if (!res.ok) throw new Error(`Library update failed: ${res.status}`);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to update your library");
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
