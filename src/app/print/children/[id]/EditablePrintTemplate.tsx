'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, GripIcon, PrinterIcon, RotateCcwIcon } from 'lucide-react'

import styles from './print-template.module.css'

type BlockKind = 'text' | 'image'

type BlockState = {
  id: string
  kind: BlockKind
  page: number
  x: number
  y: number
  w: number
  h: number
  z: number
  className: string
  rotation?: number
  text?: string
  alt?: string
  src?: string | null
  fallback?: string
}

type DragState =
  | {
      mode: 'move'
      id: string
      pointerId: number
      startX: number
      startY: number
      originX: number
      originY: number
      sheetWidth: number
      sheetHeight: number
    }
  | {
      mode: 'resize'
      id: string
      pointerId: number
      startX: number
      startY: number
      originW: number
      originH: number
      sheetWidth: number
      sheetHeight: number
    }

type Labels = {
  backToProfile: string
  print: string
  resetLayout: string
  editHint: string
  savedLocally: string
  move: string
  resize: string
}

const STORAGE_VERSION = 16
const FOLD_PAGE = 2
const FOLD_LEFT_EDGE = 48.8
const FOLD_RIGHT_EDGE = 52.2

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function storageKey(childId: string): string {
  return `child-print-template:${STORAGE_VERSION}:${childId}`
}

function blockStyle(block: BlockState): CSSProperties {
  return {
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: `${block.w}%`,
    height: `${block.h}%`,
    zIndex: block.z,
    transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
  }
}

function mergeStoredBlocks(defaultBlocks: BlockState[], stored: BlockState[]): BlockState[] {
  return defaultBlocks.map((block) => {
    const match = stored.find((storedBlock) => storedBlock.id === block.id)
    return match ? { ...block, ...match, kind: block.kind, className: block.className } : block
  })
}

function foldBounds(block: BlockState): { minX: number; maxX: number; maxW: number } {
  if (block.page !== FOLD_PAGE) {
    return { minX: 0, maxX: 100 - block.w, maxW: 100 - block.x }
  }

  const isLeftPanel = block.x + block.w / 2 < 50
  if (isLeftPanel) {
    return {
      minX: 0,
      maxX: Math.max(0, FOLD_LEFT_EDGE - block.w),
      maxW: Math.max(6, FOLD_LEFT_EDGE - block.x),
    }
  }

  return {
    minX: FOLD_RIGHT_EDGE,
    maxX: 100 - block.w,
    maxW: 100 - block.x,
  }
}

export function EditablePrintTemplate({
  childId,
  childName,
  blocks,
  fontClassName,
  labels,
}: {
  childId: string
  childName: string
  blocks: BlockState[]
  fontClassName?: string
  labels: Labels
}) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const defaultBlocks = useMemo(() => blocks, [blocks])
  const [editableBlocks, setEditableBlocks] = useState<BlockState[]>(() => {
    if (typeof window === 'undefined') return blocks

    const stored = window.localStorage.getItem(storageKey(childId))
    if (!stored) return blocks

    try {
      const parsed = JSON.parse(stored) as BlockState[]
      return Array.isArray(parsed) ? mergeStoredBlocks(blocks, parsed) : blocks
    } catch {
      window.localStorage.removeItem(storageKey(childId))
      return blocks
    }
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pages = useMemo(
    () => Array.from(new Set(editableBlocks.map((block) => block.page))).sort((a, b) => a - b),
    [editableBlocks],
  )

  useEffect(() => {
    window.localStorage.setItem(storageKey(childId), JSON.stringify(editableBlocks))
  }, [childId, editableBlocks])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      setEditableBlocks((current) => current.map((block) => {
        if (block.id !== drag.id) return block

        if (drag.mode === 'move') {
          const deltaX = ((event.clientX - drag.startX) / drag.sheetWidth) * 100
          const deltaY = ((event.clientY - drag.startY) / drag.sheetHeight) * 100
          const bounds = foldBounds(block)
          return {
            ...block,
            x: clamp(drag.originX + deltaX, bounds.minX, bounds.maxX),
            y: clamp(drag.originY + deltaY, 0, 100 - block.h),
          }
        }

        const deltaW = ((event.clientX - drag.startX) / drag.sheetWidth) * 100
        const deltaH = ((event.clientY - drag.startY) / drag.sheetHeight) * 100
        const bounds = foldBounds(block)
        return {
          ...block,
          w: clamp(drag.originW + deltaW, 6, bounds.maxW),
          h: clamp(drag.originH + deltaH, 4, 100 - block.y),
        }
      }))
    }

    function onPointerUp(event: PointerEvent) {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
    block: BlockState,
    mode: DragState['mode'],
  ) {
    const sheet = event.currentTarget.closest(`.${styles.sheet}`)
    const rect = sheet?.getBoundingClientRect() ?? sheetRef.current?.getBoundingClientRect()
    if (!rect) return

    event.preventDefault()
    event.stopPropagation()
    setSelectedId(block.id)
    dragRef.current = mode === 'move'
      ? {
          mode,
          id: block.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: block.x,
          originY: block.y,
          sheetWidth: rect.width,
          sheetHeight: rect.height,
        }
      : {
          mode,
          id: block.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originW: block.w,
          originH: block.h,
          sheetWidth: rect.width,
          sheetHeight: rect.height,
        }
  }

  function updateText(blockId: string, value: string) {
    setEditableBlocks((current) => current.map((block) => (
      block.id === blockId ? { ...block, text: value } : block
    )))
  }

  function resetLayout() {
    window.localStorage.removeItem(storageKey(childId))
    setEditableBlocks(defaultBlocks)
    setSelectedId(null)
  }

  return (
    <main className={`${styles.screen} ${fontClassName ?? ''}`}>
      <div className={styles.toolbar}>
        <Link href={`/dashboard/children/${childId}`} className={styles.toolbarButton}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {labels.backToProfile}
        </Link>
        <p className={styles.toolbarHint}>{labels.editHint}</p>
        <div className={styles.toolbarActions}>
          <span className={styles.savedLabel}>{labels.savedLocally}</span>
          <button type="button" onClick={resetLayout} className={styles.toolbarButton}>
            <RotateCcwIcon className="size-4" aria-hidden="true" />
            {labels.resetLayout}
          </button>
          <button type="button" onClick={() => window.print()} className={styles.printButton}>
            <PrinterIcon className="size-4" aria-hidden="true" />
            {labels.print}
          </button>
        </div>
      </div>

      {pages.map((pageNumber) => (
        <article
          key={pageNumber}
          ref={pageNumber === 1 ? sheetRef : undefined}
          className={styles.sheet}
          aria-label={`${childName} editable printable child template page ${pageNumber}`}
        >
          <div className={styles.bunting} aria-hidden="true">
            {['#3cb6b2', '#f5c94d', '#e95f5f', '#3a78b7', '#ffffff', '#3cb6b2', '#f5c94d', '#e95f5f', '#3a78b7', '#ffffff', '#3cb6b2', '#f5c94d', '#e95f5f', '#3a78b7', '#ffffff', '#3cb6b2', '#f5c94d', '#e95f5f', '#3a78b7'].map((color, index) => (
              <span key={`${color}-${index}`} className={styles.flag} style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className={styles.waveOne} aria-hidden="true" />
          <div className={styles.waveTwo} aria-hidden="true" />
          <div className={styles.sun} aria-hidden="true" />
          <div className={styles.cloudOne} aria-hidden="true" />
          <div className={styles.cloudTwo} aria-hidden="true" />

          {editableBlocks.filter((block) => block.page === pageNumber).map((block) => {
            const selected = selectedId === block.id
            return (
              <div
                key={block.id}
                className={`${styles.editableBlock} ${selected ? styles.selectedBlock : ''}`}
                style={blockStyle(block)}
                onPointerDown={() => setSelectedId(block.id)}
              >
                <button
                  type="button"
                  className={styles.dragHandle}
                  onPointerDown={(event) => beginDrag(event, block, 'move')}
                  aria-label={labels.move}
                  title={labels.move}
                >
                  <GripIcon className="size-3.5" aria-hidden="true" />
                </button>

                {block.kind === 'text' ? (
                  <div
                    className={styles[block.className as keyof typeof styles]}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck
                    onBlur={(event) => updateText(block.id, event.currentTarget.innerText)}
                  >
                    {block.text}
                  </div>
                ) : (
                  <div className={styles[block.className as keyof typeof styles]}>
                    {block.src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- child/program media may be static, Google Drive, or storage URLs resolved at runtime.
                      <img src={block.src} alt={block.alt ?? childName} referrerPolicy="no-referrer" />
                    ) : (
                      <div className={styles.portraitFallback}>{block.fallback}</div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className={styles.resizeHandle}
                  onPointerDown={(event) => beginDrag(event, block, 'resize')}
                  aria-label={labels.resize}
                  title={labels.resize}
                />
              </div>
            )
          })}
        </article>
      ))}
    </main>
  )
}

export type { BlockState as EditablePrintBlock }
