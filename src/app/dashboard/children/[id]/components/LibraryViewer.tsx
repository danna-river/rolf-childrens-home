"use client"

import { useState, useEffect } from "react"
import { resolveVideo } from "@/lib/childMedia"
import { PlayCircleIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

export interface MediaItem {
    id: string
    url: string
    media_type: string
    filename: string
    created_at?: string
}

interface Props {
    mediaLibrary: MediaItem[]
}

function mediaThumbnailUrl(mediaId: string): string {
    return `/api/media/${mediaId}/thumbnail`
}

export function LibraryViewer({ mediaLibrary }: Props) {
    const [activeItem, setActiveItem] = useState<MediaItem | null>(null)

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeItem) return
            if (e.key === "Escape") closeTheater()
            if (e.key === "ArrowLeft") handlePrev()
            if (e.key === "ArrowRight") handleNext()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeItem])

    if (!mediaLibrary || mediaLibrary.length === 0) return null

    // Sort newest to oldest
    const sortChronological = (a: MediaItem, b: MediaItem) => {
        if (!a.created_at || !b.created_at) return 0
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }

    const photos = mediaLibrary.filter(item => item.media_type === 'photo').sort(sortChronological)
    const videos = mediaLibrary.filter(item => item.media_type === 'video').sort(sortChronological)

    const closeTheater = () => setActiveItem(null)

    // Determine current navigation context
    const activeList = activeItem?.media_type === 'photo' ? photos : videos
    const currentIndex = activeItem ? activeList.findIndex(i => i.id === activeItem.id) : -1

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (currentIndex > 0) {
            setActiveItem(activeList[currentIndex - 1])
        }
    }

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (currentIndex < activeList.length - 1 && currentIndex !== -1) {
            setActiveItem(activeList[currentIndex + 1])
        }
    }

    return (
        <div className="space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-teal border-b border-stone pb-2">
                Media Portfolio Library ({mediaLibrary.length})
            </h3>

            {/* --- PHOTOS --- */}
            {photos.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {photos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative flex-none w-32 aspect-square rounded-xl overflow-hidden border border-stone bg-white shadow-2xs snap-start cursor-pointer hover:opacity-90 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaThumbnailUrl(item.id)} alt={item.filename} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/* --- VIDEOS --- */}
            {videos.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {videos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative flex-none w-32 aspect-square rounded-xl overflow-hidden border border-stone bg-slate-900 shadow-2xs snap-start flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaThumbnailUrl(item.id)} alt={item.filename} className="w-full h-full object-cover opacity-60" />
                            <PlayCircleIcon className="absolute size-8 text-white/90" />
                        </button>
                    ))}
                </div>
            )}

            {/* --- THEATER MODAL --- */}
            {activeItem && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={closeTheater}>
                    
                    {/* Previous Button */}
                    {currentIndex > 0 && (
                        <button 
                            onClick={handlePrev} 
                            className="absolute left-4 sm:left-8 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
                        >
                            <ChevronLeftIcon className="size-8 sm:size-10" />
                        </button>
                    )}

                    {/* Media Container */}
                    <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        {activeItem.media_type === 'photo' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaThumbnailUrl(activeItem.id)} alt={activeItem.filename} className="w-full h-full object-contain" />
                        ) : (() => {
                            const v = resolveVideo(activeItem.url)
                            return v.kind === 'drive' ? (
                                <iframe src={v.src} allow="autoplay" allowFullScreen className="w-full h-full border-0" />
                            ) : v.kind === 'file' ? (
                                <video src={v.src} controls autoPlay className="w-full h-full" />
                            ) : null
                        })()}
                    </div>

                    {/* Next Button */}
                    {currentIndex !== -1 && currentIndex < activeList.length - 1 && (
                        <button 
                            onClick={handleNext} 
                            className="absolute right-4 sm:right-8 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
                        >
                            <ChevronRightIcon className="size-8 sm:size-10" />
                        </button>
                    )}

                    {/* Close Button */}
                    <button 
                        onClick={closeTheater} 
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
                    >
                        <XIcon className="size-6 sm:size-8" />
                    </button>

                    {/* Counter Indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-xs font-mono tracking-widest bg-black/50 px-3 py-1.5 rounded-full">
                        {currentIndex + 1} / {activeList.length}
                    </div>

                </div>
            )}
        </div>
    )
}