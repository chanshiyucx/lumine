import type {
  DoubleClickConfig,
  PanningConfig,
  PinchConfig,
  WheelConfig,
} from './types'

export const defaultWheelConfig: WheelConfig = {
  step: 0.1,
  wheelDisabled: false,
}

export const defaultPinchConfig: PinchConfig = {
  step: 0.5,
  disabled: false,
}

export const defaultDoubleClickConfig: DoubleClickConfig = {
  step: 2,
  disabled: false,
  mode: 'toggle',
  animationTime: 200,
}

export const defaultPanningConfig: PanningConfig = {
  disabled: false,
}
