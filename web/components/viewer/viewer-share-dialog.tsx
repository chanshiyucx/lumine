import {
  Check,
  CloudDownload,
  Copy,
  ImageDown,
  Send,
  Share2,
  X,
} from 'lucide-react'
import { m } from 'motion/react'
import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { TwitterIcon } from '@/components/icons'
import type { Photo } from '@/lib/photo'
import { getPhotoOgPath, getPhotoShareUrl } from '@/lib/photo/share'
import { siteConfig } from '@/lib/site-config'
import { useDialogFocus } from './hooks/use-dialog-focus'
import { photoResourceStore } from './lib/photo-resource-store'

interface ViewerShareDialogProps {
  photo: Photo
  returnFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}

type CopyStatus = 'idle' | 'copied' | 'failed'
type DownloadTarget = 'original' | 'preview' | null

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
      className="border-overlay bg-overlay/45 text-subtle hover:border-muted/60 hover:bg-overlay/65 hover:text-text focus-visible:outline-iris flex min-w-0 flex-col items-center gap-1.5 rounded border px-2 py-2.5 text-xs transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="text-text flex size-4.5 items-center justify-center">
        {icon}
      </span>
      <span className="text-text w-full truncate text-center text-[10px] leading-tight">
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
  document.body.append(textArea)
  textArea.select()

  const copied = document.execCommand('copy')
  textArea.remove()

  if (!copied) {
    throw new Error('Failed to copy photo link')
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
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function getOriginalDownloadName(photo: Photo) {
  const mimeSubtype = photo.original.mime.split('/').at(1)
  const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype

  return extension ? `${photo.fileName}.${extension}` : photo.fileName
}

function canShareFiles(files: File[]): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function'
  ) {
    return false
  }

  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

async function createShareFile(photo: Photo): Promise<File | null> {
  const snapshot = photoResourceStore.getSnapshot(photo.original.url)
  const targetUrl =
    snapshot.status === 'ready' ||
    snapshot.status === 'cached' ||
    snapshot.status === 'decoding'
      ? snapshot.src
      : photo.original.url

  try {
    const response = await fetch(targetUrl)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const fileName = getOriginalDownloadName(photo)
    const mimeType = blob.type || photo.original.mime || 'image/jpeg'

    return new File([blob], fileName, { type: mimeType })
  } catch {
    return null
  }
}

export function ViewerShareDialog({
  photo,
  returnFocusRef,
  onClose,
}: ViewerShareDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const copyStatusTimeoutRef = useRef<number | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(true)
  const [hasPreviewFailed, setHasPreviewFailed] = useState(false)
  const titleId = useId()
  const shareUrl = getPhotoShareUrl(photo.slug)
  const ogPreviewUrl = getPhotoOgPath(photo.slug)
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const getReturnFocusElement = useCallback(
    () => returnFocusRef.current,
    [returnFocusRef],
  )

  useDialogFocus(dialogRef, getReturnFocusElement)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopPropagation()
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current)
      }
    }
  }, [onClose])

  const updateCopyStatus = (status: CopyStatus) => {
    setCopyStatus(status)

    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current)
    }

    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle')
      copyStatusTimeoutRef.current = null
    }, 1000)
  }

  const handleCopyLink = async () => {
    try {
      await copyText(shareUrl)
      updateCopyStatus('copied')
    } catch {
      updateCopyStatus('failed')
    }
  }

  const handleNativeShare = async () => {
    const baseShareData: ShareData = {
      title: photo.title,
      text: `${photo.title} — ${siteConfig.name}`,
      url: shareUrl,
    }

    try {
      const shareFile = await createShareFile(photo)
      const shareDataWithFiles: ShareData =
        shareFile && canShareFiles([shareFile])
          ? { ...baseShareData, files: [shareFile] }
          : baseShareData

      try {
        await navigator.share(shareDataWithFiles)
        onClose()
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        // If file sharing failed due to platform restrictions, retry with URL-only share
        if (shareDataWithFiles.files && shareDataWithFiles.files.length > 0) {
          try {
            await navigator.share(baseShareData)
            onClose()
            return
          } catch (fallbackError) {
            if (
              fallbackError instanceof DOMException &&
              fallbackError.name === 'AbortError'
            ) {
              return
            }
          }
        }
      }

      await handleCopyLink()
    } catch {
      await handleCopyLink()
    }
  }

  const handleSocialShare = (url: string) => {
    openShareWindow(url)
    onClose()
  }

  const handleDownload = async (
    target: Exclude<DownloadTarget, null>,
    url: string,
    fileName: string,
  ) => {
    setDownloadTarget(target)

    try {
      await downloadFile(url, fileName)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadTarget(null)
    }
  }

  const shareText = `${photo.title} — ${siteConfig.name}`
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
          className="text-subtle hover:text-text focus-visible:outline-iris absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onClose}
          aria-label="Close share dialog"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 space-y-2">
          <p className="text-muted text-xs font-medium">Share link</p>
          <div className="border-overlay bg-overlay/35 flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs">{shareUrl}</span>
            <button
              type="button"
              className="border-overlay text-subtle hover:text-text focus-visible:outline-iris shrink-0 rounded-lg border p-1.5 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={handleCopyLink}
              aria-label={copyStatus === 'copied' ? 'Link copied' : 'Copy link'}
              disabled={copyStatus === 'copied'}
            >
              <span className="relative block size-4">
                <Copy
                  className={`absolute inset-0 size-4 transition-all duration-300 ${copyStatus === 'copied' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                />
                <Check
                  className={`text-foam absolute inset-0 size-4 transition-all duration-300 ${copyStatus === 'copied' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                />
              </span>
            </button>
          </div>
          <span className="sr-only" aria-live="polite">
            {copyStatus === 'copied'
              ? 'Link copied.'
              : copyStatus === 'failed'
                ? 'Could not copy the link.'
                : ''}
          </span>
        </div>

        <div className="mb-4 space-y-2">
          <p className="text-muted text-xs font-medium">Share preview</p>
          <div className="border-overlay bg-base/60 relative overflow-hidden rounded-lg border">
            <div className="w-full" style={{ aspectRatio: '1200 / 628' }}>
              {isPreviewLoading && !hasPreviewFailed && (
                <div className="bg-overlay/35 absolute inset-0 flex items-center justify-center">
                  <div className="border-overlay border-t-iris size-8 animate-spin rounded-full border-2" />
                </div>
              )}
              {!hasPreviewFailed && (
                <Image
                  src={ogPreviewUrl}
                  alt={photo.title}
                  fill
                  sizes="(max-width: 768px) calc(100vw - 3.5rem), 45rem"
                  className={`object-cover transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setIsPreviewLoading(false)}
                  onError={() => {
                    setIsPreviewLoading(false)
                    setHasPreviewFailed(true)
                  }}
                  unoptimized
                />
              )}
              {hasPreviewFailed && (
                <div className="text-muted absolute inset-0 flex items-center justify-center text-xs">
                  Preview unavailable
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={
            canUseNativeShare
              ? 'grid grid-cols-5 gap-2'
              : 'grid grid-cols-4 gap-2'
          }
        >
          {canUseNativeShare && (
            <ShareActionButton
              icon={<Share2 className="size-4.5" />}
              label="System"
              onClick={handleNativeShare}
            />
          )}
          <ShareActionButton
            icon={<TwitterIcon className="size-4.5" />}
            label="Twitter"
            onClick={() =>
              handleSocialShare(
                `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`,
              )
            }
          />
          <ShareActionButton
            icon={<Send className="size-4.5" />}
            label="Telegram"
            onClick={() =>
              handleSocialShare(
                `https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareText}`,
              )
            }
          />
          <ShareActionButton
            icon={<CloudDownload className="size-4.5" />}
            label={downloadTarget === 'original' ? '…' : 'Original'}
            disabled={downloadTarget === 'original'}
            onClick={() =>
              void handleDownload(
                'original',
                photo.original.url,
                getOriginalDownloadName(photo),
              )
            }
          />
          <ShareActionButton
            icon={<ImageDown className="size-4.5" />}
            label={downloadTarget === 'preview' ? '…' : 'Preview'}
            disabled={downloadTarget === 'preview'}
            onClick={() =>
              void handleDownload(
                'preview',
                ogPreviewUrl,
                `${photo.slug}-og.png`,
              )
            }
          />
        </div>
      </m.div>
    </>
  )
}
