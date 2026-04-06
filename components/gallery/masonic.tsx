'use client'

import {
  createResizeObserver,
  useMasonry,
  usePositioner,
  useScroller,
  type ContainerPosition,
  type MasonryProps,
  type Positioner,
} from 'masonic'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
  type MutableRefObject,
} from 'react'
import { useViewportSize } from './hooks/use-viewport-size'

function useForceUpdate() {
  const [, setTick] = useState(0)

  return useCallback(() => {
    setTick((currentTick) => currentTick + 1)
  }, [])
}

function useContainerPosition(
  elementRef: MutableRefObject<HTMLElement | null>,
  deps: DependencyList = [],
): ContainerPosition & { height: number } {
  const [containerPosition, setContainerPosition] = useState<
    ContainerPosition & { height: number }
  >({
    offset: 0,
    width: 0,
    height: 0,
  })

  useLayoutEffect(() => {
    const node = elementRef.current

    if (!node) {
      return
    }

    let offset = 0
    let current: HTMLElement | null = node

    do {
      offset += current.offsetTop || 0
      current = current.offsetParent as HTMLElement | null
    } while (current)

    const nextPosition = {
      offset,
      width: node.offsetWidth,
      height: node.offsetHeight,
    }

    setContainerPosition((previousPosition) => {
      if (
        previousPosition.offset === nextPosition.offset &&
        previousPosition.width === nextPosition.width &&
        previousPosition.height === nextPosition.height
      ) {
        return previousPosition
      }

      return nextPosition
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- this helper intentionally accepts a caller-supplied dependency list to stay aligned with masonic's container-position pattern.
  }, deps)

  useEffect(() => {
    const node = elementRef.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver(() => {
      const currentNode = elementRef.current

      if (!currentNode) {
        return
      }

      setContainerPosition((previousPosition) => {
        const nextPosition = {
          ...previousPosition,
          width: currentNode.offsetWidth,
          height: currentNode.offsetHeight,
        }

        if (
          previousPosition.width === nextPosition.width &&
          previousPosition.height === nextPosition.height
        ) {
          return previousPosition
        }

        return nextPosition
      })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [elementRef])

  return containerPosition
}

function useThrottledResizeObserver(positioner: Positioner, fps: number) {
  const forceUpdate = useForceUpdate()
  const timeoutRef = useRef<number | null>(null)
  const lastCommitTimeRef = useRef(0)

  const scheduleUpdate = useCallback(() => {
    const now = performance.now()
    const frameDuration = 1000 / fps
    const elapsed = now - lastCommitTimeRef.current

    const flush = () => {
      timeoutRef.current = null
      lastCommitTimeRef.current = performance.now()
      forceUpdate()
    }

    if (elapsed >= frameDuration) {
      flush()
      return
    }

    if (timeoutRef.current !== null) {
      return
    }

    timeoutRef.current = window.setTimeout(flush, frameDuration - elapsed)
  }, [forceUpdate, fps])

  const resizeObserver = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- createResizeObserver stores the callback for future observer events; it does not synchronously consume ref values for render output.
    return createResizeObserver(positioner, scheduleUpdate)
  }, [positioner, scheduleUpdate])

  useEffect(() => {
    return () => {
      resizeObserver.disconnect()

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [resizeObserver])

  return resizeObserver
}

export function Masonic<Item>(props: MasonryProps<Item>) {
  const containerRef = useRef<HTMLElement | null>(null)
  const { width: viewportWidth, height: viewportHeight } = useViewportSize()
  const containerPosition = useContainerPosition(containerRef, [
    viewportWidth,
    viewportHeight,
  ])
  const height = viewportHeight
  const width = containerPosition.width || viewportWidth
  const scrollState = useScroller(containerPosition.offset, props.scrollFps)

  const positioner = usePositioner(
    {
      width,
      columnWidth: props.columnWidth,
      columnGutter: props.columnGutter,
      rowGutter: props.rowGutter,
      columnCount: props.columnCount,
      maxColumnCount: props.maxColumnCount,
      maxColumnWidth: props.maxColumnWidth,
    },
    [width],
  )

  const resizeObserver = useThrottledResizeObserver(
    positioner,
    props.scrollFps ?? 12,
  )

  return useMasonry<Item>({
    scrollTop: scrollState.scrollTop,
    isScrolling: scrollState.isScrolling,
    positioner,
    resizeObserver,
    items: props.items,
    onRender: props.onRender,
    as: props.as,
    id: props.id,
    className: props.className,
    style: props.style,
    role: props.role,
    tabIndex: props.tabIndex,
    containerRef,
    itemAs: props.itemAs,
    itemStyle: props.itemStyle,
    itemHeightEstimate: props.itemHeightEstimate,
    itemKey: props.itemKey,
    overscanBy: props.overscanBy,
    height,
    render: props.render,
  })
}
