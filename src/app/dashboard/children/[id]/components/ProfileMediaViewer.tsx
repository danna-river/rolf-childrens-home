"use client"

import { useState } from "react"
import { ImageIcon, VideoIcon } from "lucide-react"

import { resolveVideo } from "@/lib/childMedia"
import { useTranslations } from "@/i18n/client"
import { PhotoViewer } from "./PhotoViewer"

interface ProfileMediaViewerProps {
  photoSrc: string
  videoSrc: string
  alt: string
  fallbackInitial: string
  videoTitle: string
}

type ProfileMediaMode = "picture" | "video"

export function ProfileMediaViewer({
  photoSrc,
  videoSrc,
  alt,
  fallbackInitial,
  videoTitle,
}: ProfileMediaViewerProps) {
  const t = useTranslations()
  const [mode, setMode] = useState<ProfileMediaMode>("picture")
  const video = resolveVideo(videoSrc)
  const pictureLabel = t("children.detail.pictureTab")
  const videoLabel = t("children.detail.videoTab")
  const selector = (
    <button
      type="button"
      onClick={() => setMode((current) => current === "picture" ? "video" : "picture")}
      aria-label={`${pictureLabel} / ${videoLabel}`}
      title={`${pictureLabel} / ${videoLabel}`}
      className="absolute bottom-0 left-1/2 inline-flex -translate-x-1/2 translate-y-1/2 rounded-full border border-stone bg-white shadow-[0_8px_18px_rgba(21,44,75,0.16)] transition-colors hover:bg-ice/70"
    >
      {([
        { mode: "picture" as const, Icon: ImageIcon },
        { mode: "video" as const, Icon: VideoIcon },
      ]).map(({ mode: option, Icon }) => {
        const isActive = mode === option

        return (
          <span
            key={option}
            className="flex h-12 w-14 items-center justify-center rounded-full"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-teal text-white shadow-2xs"
                  : "text-navy/60"
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </span>
        )
      })}
    </button>
  )

  return (
    <div className="flex w-full flex-col items-center pb-6">
      <div className="relative flex w-full justify-center">
        {mode === "picture" ? (
          <PhotoViewer
            src={photoSrc}
            alt={alt}
            fallbackInitial={fallbackInitial}
          />
        ) : (
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone bg-white shadow-[0_12px_28px_rgba(21,44,75,0.12)]">
            {video.kind === "file" ? (
              <video src={video.src} controls className="aspect-video w-full object-cover" />
            ) : video.kind === "drive" ? (
              <iframe
                src={video.src}
                allow="autoplay"
                allowFullScreen
                className="aspect-video w-full border-0"
                title={videoTitle}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-ice p-4 text-center">
                <VideoIcon className="size-10 text-navy/25" aria-hidden="true" />
                <p className="text-base font-bold text-navy/45">{t("children.detail.noVideo")}</p>
              </div>
            )}
          </div>
        )}
        {selector}
      </div>
    </div>
  )
}
