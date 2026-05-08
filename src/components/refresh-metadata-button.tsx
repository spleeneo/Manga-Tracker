"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface RefreshMetadataButtonProps {
    slug: string;
}

export function RefreshMetadataButton({ slug }: RefreshMetadataButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/manga/${slug}/refresh-metadata`, {
                method: "POST"
            });
            if (res.ok) {
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to refresh metadata:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={loading}
            className="ui-button ui-button-secondary"
        >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Info'}
        </button>
    );
}
