"use client"

import { useState, useEffect, useTransition } from "react"
import { resolveVideo } from "@/lib/childMedia"
import { PlayCircleIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, UserCircleIcon, CheckCircle2Icon } from "lucide-react"
import { setProfileMediaAction } from "../media-actions"
import { enrollChildProfilePhoto } from "@/lib/face/enroll"
import { useTranslations } from "@/i18n/client"

export interface MediaItem {
    id: string
    url: string
    media_type: string
    filename: string
    usage_type: string // Must be included in your DB select!
    created_at?: string 
}

interface Props {
    childId: string 
    mediaLibrary: MediaItem[]
}

function mediaThumbnailUrl(mediaId: string): string {
    return `/api/media/${mediaId}/thumbnail`
}

export function LibraryViewer({ childId, mediaLibrary }: Props) {
    const t = useTranslations()
    const [activeItem, setActiveItem] = useState<MediaItem | null>(null)
    const [isPending, startTransition] = useTransition()
    const [indexingFace, setIndexingFace] = useState(false)

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeItem) return
            if (e.key === "Escape") {
                setActiveItem(null)
                return
            }

            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return

            const sortedItems = mediaLibrary
                .filter(item => item.media_type === activeItem.media_type)
                .sort((a, b) => {
                    if (!a.created_at || !b.created_at) return 0
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
            const activeIndex = sortedItems.findIndex(item => item.id === activeItem.id)
            const nextIndex = e.key === "ArrowLeft" ? activeIndex - 1 : activeIndex + 1

            if (nextIndex >= 0 && nextIndex < sortedItems.length) {
                setActiveItem(sortedItems[nextIndex])
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeItem, mediaLibrary])

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

    // Server Action Handler
    const handleSetProfile = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!activeItem) return

        startTransition(async () => {
            const res = await setProfileMediaAction(
                childId,
                activeItem.id,
                activeItem.media_type as 'photo' | 'video'
            )

            if (res.error) {
                alert(res.error)
                return
            }

            // Swapping the profile photo dropped the old face template (DB
            // trigger), so index the new one now; a failure here just leaves
            // the child in the admin backfill queue.
            if (activeItem.media_type === 'photo') {
                setIndexingFace(true)
                await enrollChildProfilePhoto(childId)
                setIndexingFace(false)
            }

            // Optimistically update UI so it snaps to "Current" instantly
            setActiveItem({
                ...activeItem,
                usage_type: activeItem.media_type === 'photo' ? 'profile_picture' : 'profile_video'
            })
        })
    }

    return (
        <div className="space-y-5">
            <h3 className="border-b border-stone pb-4 text-xl font-bold uppercase tracking-[0.22em] text-teal sm:text-2xl">
                Media Portfolio Library ({mediaLibrary.length})
            </h3>

            {/* --- PHOTOS --- */}
            {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                    {photos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-stone bg-white shadow-2xs transition-opacity hover:opacity-90">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaThumbnailUrl(item.id)} alt={item.filename} className="h-full w-full object-cover" />
                            
                            {/* Indicator if already profile picture */}
                            {item.usage_type === 'profile_picture' && (
                                <div className="absolute right-2 top-2 rounded-full bg-teal p-1.5 text-white shadow-sm">
                                    <UserCircleIcon className="size-4" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* --- VIDEOS --- */}
            {videos.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                    {videos.map((item) => (
                        <button key={item.id} onClick={() => setActiveItem(item)} className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-stone bg-slate-900 shadow-2xs transition-opacity hover:opacity-90">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaThumbnailUrl(item.id)} alt={item.filename} className="h-full w-full object-cover opacity-60" />
                            <PlayCircleIcon className="absolute size-12 text-white/90" />

                            {/* Indicator if already profile video */}
                            {item.usage_type === 'profile_video' && (
                                <div className="absolute right-2 top-2 z-10 rounded-full bg-teal p-1.5 text-white shadow-sm">
                                    <UserCircleIcon className="size-4" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* --- THEATER MODAL --- */}
            {activeItem && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={closeTheater}>
                    
                    {/* Top Action Bar */}
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                        
                        {/* Set Profile Button */}
                        {activeItem.usage_type === 'profile_picture' || activeItem.usage_type === 'profile_video' ? (
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal/20 border border-teal/30 text-teal text-xs font-bold tracking-wide">
                                <CheckCircle2Icon className="size-4" />
                                Current Profile {activeItem.media_type === 'photo' ? 'Picture' : 'Video'}
                            </div>
                        ) : (
                            <button
                                onClick={handleSetProfile}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50"
                            >
                                <UserCircleIcon className="size-4" />
                                {indexingFace ? t('children.faceSearch.indexing') : isPending ? 'Updating...' : `Set as Profile ${activeItem.media_type === 'photo' ? 'Picture' : 'Video'}`}
                            </button>
                        )}
                    </div>

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
