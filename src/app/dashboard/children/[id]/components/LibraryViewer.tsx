"use client"

import { useState } from "react"
import { resolvePhotoSrc, resolveVideo, resolveVideoThumbnail } from "@/lib/childMedia"
import { PlayCircleIcon } from "lucide-react"

export interface MediaItem {
    id: string
    url: string
    media_type: string
    filename: string
}

interface Props {
    mediaLibrary: MediaItem[]
}

export function LibraryViewer({ mediaLibrary }: Props) {
    const [activeItem, setActiveItem] = useState<MediaItem | null>(null)

    if (!mediaLibrary || mediaLibrary.length === 0) return null

    const photos = mediaLibrary.filter(item => item.media_type === 'photo')
    const videos = mediaLibrary.filter(item => item.media_type === 'video')

    const closeTheater = () => setActiveItem(null)

    return (
        <div className="space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-teal border-b border-stone pb-2">
                Media Portfolio Library ({mediaLibrary.length})
            </h3>

            {/* --- PHOTOS --- */}
            {photos.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {photos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative flex-none w-32 aspect-square rounded-xl overflow-hidden border border-stone bg-white shadow-2xs snap-start">
                            {/* eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime. */}
                            <img src={resolvePhotoSrc(item.url, 400) || item.url} alt={item.filename} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            {/* --- VIDEOS --- */}
            {videos.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {videos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative flex-none w-32 aspect-square rounded-xl overflow-hidden border border-stone bg-slate-900 shadow-2xs snap-start flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime. */}
                            <img src={resolveVideoThumbnail(item.url, 400) || ''} alt={item.filename} className="w-full h-full object-cover opacity-60" />
                            <PlayCircleIcon className="absolute size-8 text-white/90" />
                        </button>
                    ))}
                </div>
            )}

            {/* --- MODAL --- */}
            {activeItem && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closeTheater}>
                    <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        {activeItem.media_type === 'photo' ? (
                            // eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime.
                            <img src={resolvePhotoSrc(activeItem.url, 1000) || activeItem.url} alt={activeItem.filename} className="w-full h-full object-contain" />
                        ) : (() => {
                            const v = resolveVideo(activeItem.url)
                            return v.kind === 'drive' ? (
                                <iframe src={v.src} allow="autoplay" allowFullScreen className="w-full h-full" />
                            ) : v.kind === 'file' ? (
                                <video src={v.src} controls autoPlay className="w-full h-full" />
                            ) : null
                        })()}
                    </div>
                    <button onClick={closeTheater} className="absolute top-4 right-4 text-white text-2xl">✕</button>
                </div>
            )}
        </div>
    )
}