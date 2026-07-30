export const DOUBLE_TAP_DELAY = 300
export const DOUBLE_TAP_DISTANCE = 20
export const TAP_MOVE_TOLERANCE = 10

export interface TapPoint {
  x: number
  y: number
}

interface CompletedTap {
  point: TapPoint
  time: number
}

function getDistance(first: TapPoint, second: TapPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export class DoubleTapRecognizer {
  private activeTap: TapPoint | null = null
  private lastTap: CompletedTap | null = null
  private moved = false
  private multiTouch = false

  start(touchCount: number, point?: TapPoint) {
    if (touchCount !== 1 || !point) {
      this.activeTap = null
      this.multiTouch = touchCount > 1
      return
    }

    this.activeTap = point
    this.moved = false
  }

  move(touchCount: number, point?: TapPoint) {
    if (touchCount > 1) {
      this.multiTouch = true
      this.activeTap = null
      return
    }

    if (
      this.activeTap &&
      point &&
      getDistance(this.activeTap, point) > TAP_MOVE_TOLERANCE
    ) {
      this.moved = true
    }
  }

  end(
    remainingTouchCount: number,
    point?: TapPoint,
    time = Date.now(),
  ): boolean {
    if (remainingTouchCount > 0) {
      return false
    }

    const isTap = Boolean(
      this.activeTap && point && !this.moved && !this.multiTouch,
    )

    this.activeTap = null
    this.moved = false
    this.multiTouch = false

    if (!isTap || !point) {
      this.lastTap = null
      return false
    }

    if (
      this.lastTap &&
      time - this.lastTap.time <= DOUBLE_TAP_DELAY &&
      getDistance(this.lastTap.point, point) <= DOUBLE_TAP_DISTANCE
    ) {
      this.lastTap = null
      return true
    }

    this.lastTap = { point, time }
    return false
  }

  reset() {
    this.activeTap = null
    this.lastTap = null
    this.moved = false
    this.multiTouch = false
  }
}
