'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/style'
import { Signature } from './signature'

const PATH_STAGGER_SECONDS = 0.1

interface SignatureBoxProps {
  animate?: boolean
  className?: string
}

function SignatureBox({ animate, className }: SignatureBoxProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg || !animate) {
      return
    }

    const paths = svg.querySelectorAll<SVGPathElement>('path')
    paths.forEach((path, index) => {
      const length = path.getTotalLength()
      path.style.setProperty('--path-length', `${length}px`)
      path.style.setProperty('--delay', `${index * PATH_STAGGER_SECONDS}s`)
      path.classList.add('logo-path')
    })

    return () => {
      paths.forEach((path) => {
        path.classList.remove('logo-path')
        path.style.removeProperty('--path-length')
        path.style.removeProperty('--delay')
      })
    }
  }, [animate])

  return (
    <Signature
      ref={svgRef}
      fill={animate ? undefined : 'var(--color-muted)'}
      className={cn('h-auto w-18 drop-shadow-lg', className)}
    />
  )
}

export function Logo() {
  return (
    <div className="relative">
      <SignatureBox className="absolute top-0 left-0" />
      <SignatureBox animate />
    </div>
  )
}
