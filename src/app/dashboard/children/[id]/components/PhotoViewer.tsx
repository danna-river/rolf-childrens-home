"use client"
import { useState } from "react"

interface Props {
  src: string
  alt: string
  fallbackInitial: string
}

export function PhotoViewer({ src, alt, fallbackInitial }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="focus:outline-none">
        {src ? (
          <img src={src} alt={alt} className="h-36 w-36 rounded-full object-cover border-4 border-white shadow cursor-pointer hover:opacity-90 transition-opacity" />
        ) : (
          <div className="h-36 w-36 rounded-full bg-gray-200 flex items-center justify-center shadow">
            <span className="text-gray-500 text-4xl font-semibold">{fallbackInitial}</span>
          </div>
        )}
      </button>

      {open && src && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
