"use client"

import React, { useEffect, useRef, useState } from "react"

interface AnimateInViewProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  variant?: "rise" | "scale" | "fade" | "left" | "right"
}

const hiddenTransformByVariant = {
  rise: "translate3d(0, 28px, 0) scale(0.98)",
  scale: "translate3d(0, 16px, 0) scale(0.96)",
  fade: "translate3d(0, 0, 0) scale(1)",
  left: "translate3d(-24px, 0, 0) scale(0.98)",
  right: "translate3d(24px, 0, 0) scale(0.98)",
}

const visibleTransform = "translate3d(0, 0, 0) scale(1)"
const revealEasing = "cubic-bezier(0.22, 1, 0.36, 1)"

export function AnimateInView({
  children,
  className,
  delay = 0,
  duration = 700,
  variant = "rise",
}: AnimateInViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (motionQuery.matches) {
      const frame = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      data-in-view={visible ? "true" : "false"}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? visibleTransform : hiddenTransformByVariant[variant],
        transitionProperty: "opacity, transform",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: revealEasing,
        transitionDelay: visible ? `${delay}ms` : "0ms",
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  )
}
