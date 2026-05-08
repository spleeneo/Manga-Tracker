"use client";

import { useState } from "react";
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
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-5 text-sm font-bold uppercase tracking-widest text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
            >
                <Plus className="h-4 w-4" />
                <span>Add Source Provider</span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={() => setIsOpen(false)}
            />

            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="relative border-b bg-muted px-6 py-5">
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-lg shadow-primary/20">
                                <Link2 className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Add Source</h2>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-90"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    <div className="space-y-6">
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                                Provider Name
                            </label>
                            <div className="group relative">
                                <input
                                    required
                                    value={formData.sourceName}
                                    onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                                    placeholder="e.g. MangaDex or NeloManga"
                                    className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 pl-11 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0 placeholder:text-muted-foreground/40"
                                />
                                <Globe className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                                Source URL
                            </label>
                            <input
                                required
                                type="url"
                                value={formData.sourceUrl}
                                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0 placeholder:text-muted-foreground/40"
                            />
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                                Supported: MangaDex, NeloManga, MangaPlus, Webtoon, Manganato
                            </p>
                        </div>
                    </div>

                    <div className="mt-10 flex items-center justify-end gap-3 border-t pt-8">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-xl px-8 py-3 text-sm font-bold tracking-wide text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold tracking-wide text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:translate-y-[-2px] disabled:opacity-70"
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
