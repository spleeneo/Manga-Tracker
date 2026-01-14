"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2, Sparkles, Image as ImageIcon, Search, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddMangaDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mode, setMode] = useState<"MANUAL" | "SEARCH">("SEARCH");
    const router = useRouter();

    const [formData, setFormData] = useState<{
        title: string;
        slug: string;
        coverUrl: string;
        status: string;
        description: string;
        sourceUrl: string;
        sources: any[];
    }>({
        title: "",
        slug: "",
        coverUrl: "",
        status: "ONGOING",
        description: "",
        sourceUrl: "",
        sources: [],
    });

    // Simple debounce for search
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 3) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/manga/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                console.log("Search API response:", data);
                console.log("Search results:", data.results);
                setSearchResults(data.results || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const selectManga = (manga: any, initialSourceUrl?: string) => {
        setFormData({
            title: manga.title,
            slug: manga.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            coverUrl: manga.coverUrl || "",
            status: manga.status || "ONGOING",
            description: manga.description || "",
            sourceUrl: initialSourceUrl || (manga.sources && manga.sources[0]?.url) || "",
            sources: manga.sources || [],
        });
        setMode("MANUAL");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/manga", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create manga");
            }

            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            slug: "",
            coverUrl: "",
            status: "ONGOING",
            description: "",
            sourceUrl: "",
            sources: [],
        });
        setSearchQuery("");
        setSearchResults([]);
        setMode("SEARCH");
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] active:scale-95"
            >
                <Plus className="h-4 w-4" />
                <span>Track New Manga</span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/80 animate-in fade-in duration-300"
                onClick={() => setIsOpen(false)}
            />

            <div className="relative w-full max-w-xl overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300 sm:max-w-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Add New Manga</h2>
                            <p className="text-xs font-medium text-muted-foreground">Search to track reading progress</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex border-b bg-muted/30">
                    <button
                        onClick={() => setMode("SEARCH")}
                        className={`flex-1 px-4 py-3.5 text-sm font-bold transition-all ${mode === "SEARCH" ? "bg-card text-primary shadow-[inset_0_-2px_0_0_currentColor]" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                    >
                        SEARCH ONLINE
                    </button>
                    <button
                        onClick={() => setMode("MANUAL")}
                        className={`flex-1 px-4 py-3.5 text-sm font-bold transition-all ${mode === "MANUAL" ? "bg-card text-primary shadow-[inset_0_-2px_0_0_currentColor]" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                    >
                        MANUAL ENTRY
                    </button>
                </div>

                <div className="p-8">
                    {mode === "SEARCH" ? (
                        <div className="space-y-6">
                            <div className="relative">
                                <input
                                    autoFocus
                                    placeholder="Search (e.g. Naruto, One Piece...)"
                                    className="w-full rounded-xl border-2 border-muted bg-muted/50 px-5 py-4 pl-12 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0 placeholder:text-muted-foreground/40"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search className="absolute left-4 top-4.5 h-5 w-5 text-muted-foreground" />
                                {isSearching && <Loader2 className="absolute right-4 top-4.5 h-5 w-5 animate-spin text-primary" />}
                            </div>

                            <div className="grid gap-4 max-h-[420px] overflow-y-auto pr-3 custom-scrollbar">
                                {searchResults.length > 0 ? (
                                    searchResults.map((manga, idx) => (
                                        <button
                                            key={manga.title || idx}
                                            onClick={() => selectManga(manga)}
                                            className="group flex flex-col sm:flex-row items-center sm:items-start gap-4 rounded-xl border bg-card p-3 text-left transition-all hover:bg-muted/50 hover:border-primary/50"
                                        >
                                            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-muted border">
                                                {manga.coverUrl ? (
                                                    <img src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 opacity-20" /></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <h3 className="text-base font-bold leading-tight truncate pr-2 group-hover:text-primary transition-colors">{manga.title}</h3>
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-2">{manga.description}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {manga.sources && Array.isArray(manga.sources) && manga.sources.length > 0 ? (
                                                        manga.sources.map((source: any, sourceIdx: number) => (
                                                            <div
                                                                key={source.url || sourceIdx}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    selectManga(manga, source.url);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                                                            >
                                                                {source.name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-red-500">No sources</span>
                                                    )}
                                                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">{manga.status}</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                ) : searchQuery.length >= 3 && !isSearching ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <Search className="h-8 w-8 opacity-20 mb-2" />
                                        <p className="text-sm">No results found</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <Sparkles className="h-8 w-8 opacity-20 mb-2" />
                                        <p className="text-sm">Type to search</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-8 sm:grid-cols-2">
                                <div className="space-y-6">
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Title</label>
                                        <input
                                            required
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="e.g. One Piece"
                                            className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Slug</label>
                                        <input
                                            required
                                            value={formData.slug}
                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                            placeholder="e.g. one-piece"
                                            className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Source URL (Auto-Track)</label>
                                        <div className="group relative">
                                            <input
                                                value={formData.sourceUrl}
                                                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                                                placeholder="https://mangadex.org/..."
                                                className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 pl-11 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0"
                                            />
                                            <Link2 className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Cover URL</label>
                                        <div className="group relative">
                                            <input
                                                value={formData.coverUrl}
                                                onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                                                placeholder="https://..."
                                                className="w-full rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 pl-11 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0"
                                            />
                                            <ImageIcon className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Description</label>
                                        <textarea
                                            rows={6}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Manga overview..."
                                            className="w-full resize-none rounded-xl border-2 border-muted bg-muted/40 px-4 py-3 font-medium transition-all focus:border-primary focus:bg-card focus:ring-0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-end gap-3 border-t pt-8">
                                <button
                                    type="button"
                                    onClick={() => setMode("SEARCH")}
                                    className="rounded-xl px-8 py-3 text-sm font-bold tracking-wide text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                                >
                                    BACK TO SEARCH
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold tracking-wide text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:translate-y-[-2px] hover:shadow-primary/30 active:translate-y-0 disabled:opacity-70"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "TRACK MANGA"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
