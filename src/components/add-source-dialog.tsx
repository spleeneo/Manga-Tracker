"use client";

import { useEffect, useState } from "react";
import { Plus, X, Loader2, Link2, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

interface AddSourceDialogProps {
    mangaId: string;
}

export function AddSourceDialog({ mangaId }: AddSourceDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState({
        sourceName: "",
        sourceUrl: "",
    });

    useEffect(() => {
        if (!isOpen) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/source", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mangaId,
                    ...formData,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to add source");
            }

            setIsOpen(false);
            setFormData({ sourceName: "", sourceUrl: "" });
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Failed to add source");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-card/70 py-4 text-sm font-bold uppercase text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
                <Plus className="h-4 w-4" />
                <span>Add Source Provider</span>
            </button>
        );
    }

    return (
        <div className="dialog-overlay">
            <div
                className="absolute inset-0"
                onClick={() => setIsOpen(false)}
            />

            <div className="dialog-panel max-w-md">
                <div className="relative border-b bg-card px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-md bg-primary/10 p-2.5 text-primary">
                                <Link2 className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Add Source</h2>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="ui-icon-button"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                    <div className="space-y-6">
                        <div>
                            <label className="ui-label">
                                Provider Name
                            </label>
                            <div className="group relative">
                                <input
                                    required
                                    value={formData.sourceName}
                                    onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                                    placeholder="e.g. MangaDex or NeloManga"
                                    className="ui-field pl-11"
                                />
                                <Globe className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            </div>
                        </div>

                        <div>
                            <label className="ui-label">
                                Source URL
                            </label>
                            <input
                                required
                                type="url"
                                value={formData.sourceUrl}
                                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                                placeholder="https://..."
                                className="ui-field"
                            />
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                                Supported: MangaDex, NeloManga, MangaPlus, Comikey, VIZ, Urek Mazino, Atsumaru, Webtoon, Manganato
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="ui-button ui-button-ghost"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="ui-button ui-button-primary min-w-[140px]"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "LINK SOURCE"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
