import { notFound, redirect } from 'next/navigation'
import { DynaPuff, Elms_Sans, Short_Stack } from 'next/font/google'

import { calculateAge } from '@/components/actions'
import { resolvePhotoSrc, resolveVideo } from '@/lib/childMedia'
import { isAdminRole } from '@/lib/profiles'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Child, ChildWithMediaRefs } from '@/lib/types'
import { getMessages, getUserLocale } from '@/i18n/server'
import { EditablePrintTemplate, type EditablePrintBlock } from './EditablePrintTemplate'

const dynaPuff = DynaPuff({
  variable: '--font-dynapuff',
  subsets: ['latin'],
  weight: 'variable',
})

const elmsSans = Elms_Sans({
  variable: '--font-elms-sans',
  subsets: ['latin'],
  weight: 'variable',
})

const shortStack = Short_Stack({
  variable: '--font-short-stack',
  subsets: ['latin'],
  weight: '400',
})

type PrintableChild = Child & {
  profile_photo_id?: string | null
}

function childName(child: Child): string {
  return [child.first_name, child.last_name].filter(Boolean).join(' ') || child.display_name || 'Unnamed'
}

function firstName(child: Child): string {
  return child.first_name || child.display_name || childName(child)
}

function qrImageSrc(value: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=18&data=${encodeURIComponent(value)}`
}

export default async function ChildPrintTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile } = await requireAuth()
  if (!isAdminRole(profile.role)) return redirect('/dashboard')

  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)
  const supabase = await createClient()

  const { data } = await supabase
    .from('children')
    .select(`
      *,
      profile_photo:child_media!fk_children_profile_photo(id, url),
      profile_video:child_media!fk_children_profile_video(id, url)
    `)
    .eq('id', id)
    .single()

  const rawChild = data as ChildWithMediaRefs | null
  if (!rawChild) return notFound()

  const child: PrintableChild = {
    ...rawChild,
    profile_photo: rawChild.profile_photo?.url ?? null,
    profile_video: rawChild.profile_video?.url ?? null,
    profile_photo_id: rawChild.profile_photo?.id ?? null,
  }

  const name = childName(child)
  const initial = (firstName(child).slice(0, 1) || '?').toUpperCase()
  const age = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const photoSrc = resolvePhotoSrc(child.profile_photo, 1800)
  const video = resolveVideo(child.profile_video)
  const videoUrl = video.kind === 'none' ? null : video.src
  const bio = child.bio?.trim()
  const fallbackStoryDetails = [
    child.favorite_subject ? `Favorite Subject: ${child.favorite_subject}` : null,
    child.hobby ? `Favorite Hobbies: ${child.hobby}` : null,
  ].filter((part): part is string => part !== null).join('\n')
  const profileStory = bio
    ? [
        'Dearest Sponsor,',
        '',
        bio,
        '',
        'Thank you for sponsoring me and loving me!',
      ].join('\n')
    : [
        'Dearest Sponsor,',
        '',
        `My name is ${name}.`,
        '',
        child.country || child.year_joined || age
          ? `I joined the Children's Home${child.country ? ` in ${child.country}` : ''}${child.year_joined ? ` in ${child.year_joined}` : ''}. ${age ? `I am ${age} years old this year!` : ''}`.trim()
          : null,
        '',
        fallbackStoryDetails || null,
        '',
        'Thank you for sponsoring me and loving me!',
      ].filter((part): part is string => part !== null).join('\n')
  const blocks: EditablePrintBlock[] = [
    {
      id: 'page1-training-badge',
      kind: 'text',
      page: 1,
      x: 2.2,
      y: 5.2,
      w: 12.5,
      h: 10.8,
      z: 10,
      className: 'bubbleLabel',
      text: 'TRAINING\nCENTER',
    },
    {
      id: 'page1-brand',
      kind: 'image',
      page: 1,
      x: 53.4,
      y: 2.1,
      w: 23.2,
      h: 12.2,
      z: 10,
      className: 'transparentImage',
      src: '/print-template/chia-logo.png',
      alt: "Children's Home in Africa logo",
      fallback: '',
    },
    {
      id: 'page1-hello',
      kind: 'text',
      page: 1,
      x: 58,
      y: 20.5,
      w: 36,
      h: 12.5,
      z: 10,
      className: 'helloText',
      text: 'HELLO!',
    },
    {
      id: 'page1-main-program-photo',
      kind: 'image',
      page: 1,
      x: 4.5,
      y: 20.2,
      w: 40.8,
      h: 30.5,
      z: 8,
      className: 'whitePhotoFrame',
      src: '/print-template/training-center-children.jpg',
      alt: 'Children in craft training center',
      fallback: '',
    },
    {
      id: 'page1-craft-photo',
      kind: 'image',
      page: 1,
      x: 28.5,
      y: 10.8,
      w: 19.5,
      h: 15,
      z: 12,
      rotation: 6,
      className: 'polaroidFrame',
      src: '/print-template/craft-products.jpg',
      alt: 'Craft training products',
      fallback: '',
    },
    {
      id: 'page1-program-copy',
      kind: 'text',
      page: 1,
      x: 4.5,
      y: 52.5,
      w: 42,
      h: 17.5,
      z: 10,
      className: 'programCopy',
      text: 'In Cameroon, our new Craft Training Center is giving orphans the opportunity to learn valuable skills that will empower them for the future. Through hands-on training in various crafts, they are gaining tools for self-sufficiency and hope for a brighter tomorrow.',
    },
    {
      id: 'page1-sewing-photo',
      kind: 'image',
      page: 1,
      x: 4.5,
      y: 74,
      w: 29,
      h: 20,
      z: 9,
      className: 'whitePhotoFrame',
      src: '/print-template/sewing-center.jpg',
      alt: 'Mali sewing center',
      fallback: '',
    },
    {
      id: 'page1-sewing-copy',
      kind: 'text',
      page: 1,
      x: 34.5,
      y: 74.5,
      w: 10,
      h: 22,
      z: 10,
      className: 'captionCopy',
      text: "Mali's\nSewing\nCenter\nnurtures\nchildren\nwith the\nlifelong skill\nof sewing.",
    },
    {
      id: 'page1-child-photo',
      kind: 'image',
      page: 1,
      x: 57.5,
      y: 44,
      w: 38,
      h: 28,
      z: 10,
      className: 'portraitFrame',
      src: photoSrc,
      alt: `${name} profile photo`,
      fallback: initial,
    },
    {
      id: 'page1-name-kicker',
      kind: 'text',
      page: 1,
      x: 68,
      y: 81.7,
      w: 26,
      h: 5,
      z: 10,
      className: 'nameKickerBlock',
      text: 'My name is',
    },
    {
      id: 'page1-child-name',
      kind: 'text',
      page: 1,
      x: 66,
      y: 88,
      w: 30,
      h: 6,
      z: 10,
      className: 'childNameBlock',
      text: name,
    },
    {
      id: 'page1-palm-right',
      kind: 'image',
      page: 1,
      x: 92,
      y: 31.5,
      w: 8.5,
      h: 15,
      z: 9,
      rotation: 10,
      className: 'transparentImage',
      src: '/print-template/palm.png',
      alt: 'Palm decoration',
      fallback: '',
    },
    {
      id: 'page1-palm-bottom',
      kind: 'image',
      page: 1,
      x: 53.5,
      y: 77,
      w: 12,
      h: 18,
      z: 9,
      rotation: -18,
      className: 'transparentImage',
      src: '/print-template/palm.png',
      alt: 'Palm decoration',
      fallback: '',
    },
    {
      id: 'page2-story-bubble',
      kind: 'text',
      page: 2,
      x: 34.5,
      y: 2.5,
      w: 13,
      h: 9,
      z: 10,
      rotation: 6,
      className: 'homeBubbleLabel',
      text: 'MY STORY',
    },
    {
      id: 'page2-home-bubble',
      kind: 'text',
      page: 2,
      x: 83.6,
      y: 2.5,
      w: 13.4,
      h: 10,
      z: 10,
      rotation: 5,
      className: 'bubbleLabel',
      text: "CHILDREN'S\nHOME",
    },
    {
      id: 'page2-story',
      kind: 'text',
      page: 2,
      x: 3.3,
      y: 10,
      w: 44.8,
      h: 47,
      z: 10,
      className: 'profileStory',
      text: profileStory,
    },
    ...(videoUrl
      ? [
          {
            id: 'page2-scan-label',
            kind: 'text' as const,
            page: 2,
            x: 8.6,
            y: 72.7,
            w: 15.8,
            h: 13,
            z: 10,
            className: 'scanText',
            text: 'SCAN\nME',
          },
          {
            id: 'page2-main-qr',
            kind: 'image' as const,
            page: 2,
            x: 24.5,
            y: 72.8,
            w: 12.2,
            h: 14.8,
            z: 10,
            className: 'qrFrame',
            src: qrImageSrc(videoUrl),
            alt: `${name} profile video QR code`,
            fallback: '',
          },
          {
            id: 'page2-qr-caption',
            kind: 'text' as const,
            page: 2,
            x: 14.5,
            y: 90.4,
            w: 22,
            h: 5,
            z: 10,
            className: 'qrCaption',
            text: 'Scan this QR code\nto see a cute video of me!',
          },
        ]
      : [
          {
            id: 'page2-left-logo',
            kind: 'image' as const,
            page: 2,
            x: 15.2,
            y: 72.2,
            w: 24,
            h: 14,
            z: 10,
            className: 'transparentImage',
            src: '/print-template/chia-logo.png',
            alt: "Children's Home in Africa logo",
            fallback: '',
          },
        ]),
    {
      id: 'page2-renovation-building',
      kind: 'image',
      page: 2,
      x: 55,
      y: 5,
      w: 27.5,
      h: 22,
      z: 10,
      className: 'whitePhotoFrame',
      src: '/print-template/renovation-building.jpg',
      alt: 'Renovated children home building',
      fallback: '',
    },
    {
      id: 'page2-renovation-collage',
      kind: 'image',
      page: 2,
      x: 55,
      y: 27.8,
      w: 13.8,
      h: 64,
      z: 10,
      className: 'whitePhotoFrame',
      src: '/print-template/renovation-collage.png',
      alt: 'Children home renovation collage',
      fallback: '',
    },
    {
      id: 'page2-renovation-copy',
      kind: 'text',
      page: 2,
      x: 71,
      y: 30.5,
      w: 25,
      h: 55,
      z: 10,
      className: 'renovationCopy',
      text: "We are thrilled to announce that the long-awaited renovation of the Children's Home is now complete! The newly refreshed space offers a warm, safe, and nurturing environment for our children to grow and thrive, along with a brand-new Education Center that sparks learning and creativity.\n\nThank you to everyone who supported this project - together, we're shaping brighter futures!",
    },
    {
      id: 'page2-small-qr',
      kind: 'image',
      page: 2,
      x: 85.5,
      y: 16.2,
      w: 7.6,
      h: 9.2,
      z: 10,
      className: 'qrFrame',
      src: '/print-template/sample-qr-clean.png',
      alt: 'Children home QR placeholder',
      fallback: '',
    },
    {
      id: 'page2-small-qr-label',
      kind: 'text',
      page: 2,
      x: 84.3,
      y: 25.8,
      w: 10,
      h: 3.6,
      z: 10,
      className: 'smallScanText',
      text: 'SCAN ME',
    },
  ]

  return (
    <EditablePrintTemplate
      childId={id}
      childName={name}
      blocks={blocks}
      fontClassName={`${dynaPuff.variable} ${elmsSans.variable} ${shortStack.variable}`}
      labels={{
        backToProfile: messages['children.print.backToProfile'],
        print: messages['children.print.print'],
        resetLayout: messages['children.print.resetLayout'],
        editHint: messages['children.print.editHint'],
        savedLocally: messages['children.print.savedLocally'],
        move: messages['children.print.move'],
        resize: messages['children.print.resize'],
      }}
    />
  )
}
