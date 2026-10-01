import { CheckLine } from '@mingcute/react/check'
import { CloseLine } from '@mingcute/react/close'
import { CopyLine } from '@mingcute/react/copy'
import { Download2Line } from '@mingcute/react/download-2'
import { PicLine } from '@mingcute/react/pic'
import { Share2Line } from '@mingcute/react/share-2'
import { TelegramFill } from '@mingcute/react/telegram'
import { TwitterFill } from '@mingcute/react/twitter'
import { m } from 'motion/react'
import Image from 'next/image'
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import { getPhotoShareUrl } from '@/lib/photo/share'
import { getPhotoOgPath } from '@/lib/route-paths'
import { siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/style'
import { useDialogFocus } from './hooks/use-dialog-focus'

interface ViewerShareDialogProps {
  photo: Photo
  returnFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}

type CopyStatus = 'idle' | 'copied' | 'failed'
type DownloadTarget = 'original' | 'preview'
type PreviewStatus = 'loading' | 'ready' | 'error'

interface ShareActionButtonProps {
  icon: ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}

function ShareActionButton({
  icon,
  label,
  disabled = false,
  onClick,
}: ShareActionButtonProps) {
  return (
    <button
      type="button"
      className="border-overlay bg-overlay/45 text-text hover:border-muted/60 hover:bg-overlay/65 flex min-w-0 flex-col items-center gap-1.5 rounded border px-2 py-2.5 text-xs transition-[background-color,border-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex size-4.5 items-center justify-center">{icon}</span>
      <span className="w-full truncate text-center text-[10px] leading-tight">
        {label}
      </span>
    </button>
  )
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'

  try {
    document.body.append(textArea)
    textArea.select()

    if (!document.execCommand('copy')) {
      throw new Error('Failed to copy photo link')
    }
  } finally {
    textArea.remove()
  }
}

function openShareWindow(url: string) {
  window.open(url, '_blank', 'width=600,height=600,noopener,noreferrer')
}

async function downloadFile(url: string, fileName: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}`)
  }

  const objectUrl = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')

  try {
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

function getOriginalDownloadName(photo: Photo) {
  const mimeSubtype = photo.original.mime.split('/').at(1)
  const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype

  return extension ? `${photo.fileName}.${extension}` : photo.fileName
}

function useCopyLink(url: string) {
  const copyStatusTimeoutRef = useRef<number | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  useEffect(() => {
    return () => {
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current)
      }
    }
  }, [])

  const updateCopyStatus = (status: Exclude<CopyStatus, 'idle'>) => {
    setCopyStatus(status)

    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current)
    }

    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle')
      copyStatusTimeoutRef.current = null
    }, 1000)
  }

  const copyLink = async () => {
    try {
      await copyText(url)
      updateCopyStatus('copied')
    } catch {
      updateCopyStatus('failed')
    }
  }

  return { copyStatus, copyLink }
}

interface ShareLinkProps {
  url: string
  copyStatus: CopyStatus
  onCopy: () => Promise<void>
}

function ShareLink({ url, copyStatus, onCopy }: ShareLinkProps) {
  const isCopied = copyStatus === 'copied'

  return (
    <div className="mb-4 space-y-2">
      <p className="text-muted text-xs font-medium">Share link</p>
      <div className="border-overlay bg-overlay/35 flex items-center gap-2 rounded-lg border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs">{url}</span>
        <button
          type="button"
          className="border-overlay text-subtle hover:text-text shrink-0 rounded-lg border p-1.5 transition-colors duration-300"
          onClick={onCopy}
          aria-label={isCopied ? 'Link copied' : 'Copy link'}
          disabled={isCopied}
        >
          <span className="relative block size-4">
            <CopyLine
              className={cn(
                'absolute inset-0 size-4 transition-[opacity,transform] duration-300',
                isCopied ? 'scale-0 opacity-0' : 'scale-100 opacity-100',
              )}
              aria-hidden="true"
            />
            <CheckLine
              className={cn(
                'text-foam absolute inset-0 size-4 transition-[opacity,transform] duration-300',
                isCopied ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {isCopied
          ? 'Link copied.'
          : copyStatus === 'failed'
            ? 'Could not copy the link.'
            : ''}
      </span>
    </div>
  )
}

interface SharePreviewProps {
  src: string
  alt: string
}

function SharePreview({ src, alt }: SharePreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>('loading')
  const isLoading = status === 'loading'
  const hasFailed = status === 'error'

  return (
    <div className="mb-4 space-y-2">
      <p className="text-muted text-xs font-medium">Share preview</p>
      <div className="border-overlay bg-base/60 overflow-hidden rounded-lg border">
        <div className="relative w-full" style={{ aspectRatio: '1200 / 628' }}>
          {isLoading && (
            <div className="bg-overlay/35 absolute inset-0 flex items-center justify-center">
              <div className="border-overlay border-t-love size-8 animate-spin rounded-full border-2" />
            </div>
          )}
          {!hasFailed && (
            <Image
              src={src}
              alt={alt}
              fill
              loading="eager"
              sizes="(max-width: 768px) calc(100vw - 3.5rem), 45rem"
              className={cn(
                'object-cover transition-opacity duration-300',
                isLoading ? 'opacity-0' : 'opacity-100',
              )}
              onLoad={() => setStatus('ready')}
              onError={() => setStatus('error')}
              unoptimized
            />
          )}
          {hasFailed && (
            <div className="text-muted absolute inset-0 flex items-center justify-center text-xs">
              Preview unavailable
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ViewerShareDialog({
  photo,
  returnFocusRef,
  onClose,
}: ViewerShareDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [downloads, setDownloads] = useState({
    original: false,
    preview: false,
  })
  const titleId = useId()
  const shareUrl = getPhotoShareUrl(photo.slug)
  const ogPreviewUrl = getPhotoOgPath(photo.slug)
  const shareText = `${photo.title} — ${siteConfig.name}`
  const { copyStatus, copyLink } = useCopyLink(shareUrl)
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useDialogFocus(dialogRef, () => returnFocusRef.current, true)

  const closeFromEffect = useEffectEvent(onClose)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopPropagation()
      closeFromEffect()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleNativeShare = async () => {
    const shareData: ShareData = {
      title: photo.title,
      text: shareText,
      url: shareUrl,
    }

    try {
      await navigator.share(shareData)
      onClose()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      await copyLink()
    }
  }

  const handleSocialShare = (url: string) => {
    openShareWindow(url)
    onClose()
  }

  const handleDownload = async (target: DownloadTarget) => {
    const url = target === 'original' ? photo.original.url : ogPreviewUrl
    const fileName =
      target === 'original'
        ? getOriginalDownloadName(photo)
        : `${photo.slug}-og.png`

    setDownloads((current) => ({ ...current, [target]: true }))

    try {
      await downloadFile(url, fileName)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloads((current) => ({ ...current, [target]: false }))
    }
  }

  const encodedShareUrl = encodeURIComponent(shareUrl)
  const encodedShareText = encodeURIComponent(shareText)

  return (
    <>
      <m.div
        className="bg-base/80 fixed inset-0 z-300 backdrop-blur-sm"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onPointerDown={onClose}
      />

      <m.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-viewer-share-dialog
        className="border-overlay bg-base text-text fixed top-1/2 left-1/2 z-310 max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border px-3 pt-4 pb-3 text-[16px] shadow-2xl outline-none"
        initial={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
        transition={{ type: 'spring', duration: 0.32, bounce: 0 }}
      >
        <div className="mb-4 min-w-0">
          <p className="text-muted mb-0.5 text-xs font-medium">Share photo</p>
          <h2 id={titleId} className="truncate text-lg font-semibold">
            {photo.title}
          </h2>
        </div>

        <button
          type="button"
          className="text-subtle hover:text-text absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-transparent transition-colors"
          onClick={onClose}
          aria-label="Close share dialog"
        >
          <CloseLine className="size-4" aria-hidden="true" />
        </button>

        <ShareLink url={shareUrl} copyStatus={copyStatus} onCopy={copyLink} />
        <SharePreview src={ogPreviewUrl} alt={photo.title} />

        <div
          className={cn(
            'grid gap-2',
            canUseNativeShare ? 'grid-cols-5' : 'grid-cols-4',
          )}
        >
          {canUseNativeShare && (
            <ShareActionButton
              icon={<Share2Line className="size-4.5" aria-hidden="true" />}
              label="System"
              onClick={handleNativeShare}
            />
          )}
          <ShareActionButton
            icon={<TwitterFill className="size-4.5" aria-hidden="true" />}
            label="Twitter"
            onClick={() =>
              handleSocialShare(
                `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`,
              )
            }
          />
          <ShareActionButton
            icon={<TelegramFill className="size-4.5" aria-hidden="true" />}
            label="Telegram"
            onClick={() =>
              handleSocialShare(
                `https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareText}`,
              )
            }
          />
          <ShareActionButton
            icon={<Download2Line className="size-4.5" aria-hidden="true" />}
            label={downloads.original ? '…' : 'Original'}
            disabled={downloads.original}
            onClick={() => void handleDownload('original')}
          />
          <ShareActionButton
            icon={<PicLine className="size-4.5" aria-hidden="true" />}
            label={downloads.preview ? '…' : 'Preview'}
            disabled={downloads.preview}
            onClick={() => void handleDownload('preview')}
          />
        </div>
      </m.div>
    </>
  )
}
