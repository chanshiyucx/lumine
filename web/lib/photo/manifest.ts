import { z } from 'zod'

const assetSchema = z.strictObject({
  url: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  mime: z.string().min(1),
})

const cameraSchema = z.strictObject({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  lensMake: z.string().min(1).optional(),
  lensModel: z.string().min(1).optional(),
  focalLength: z.number().positive().optional(),
  focalLengthIn35mmFilm: z.number().int().positive().optional(),
  fNumber: z.number().positive().optional(),
  exposureTime: z.number().positive().optional(),
  iso: z.number().int().positive().optional(),
  exposureProgram: z.string().min(1).optional(),
  exposureMode: z.string().min(1).optional(),
  meteringMode: z.string().min(1).optional(),
  whiteBalance: z.string().min(1).optional(),
  flash: z.string().min(1).optional(),
  sceneCaptureType: z.string().min(1).optional(),
  maxApertureFNumber: z.number().positive().optional(),
  brightnessValue: z.number().optional(),
  sensingMethod: z.string().min(1).optional(),
})

const imageSchema = z.strictObject({
  orientation: z.number().int().positive().optional(),
  colorSpace: z.string().min(1).optional(),
  isLivePhoto: z.boolean().optional(),
  bitDepth: z.number().int().positive().optional(),
})

const locationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  alt: z.number().optional(),
})

const photoSchema = z.strictObject({
  original: assetSchema,
  thumbnail: assetSchema,
  thumbHash: z.base64().min(8).max(36),
  title: z.string().min(1),
  takenAt: z.iso.datetime({ offset: true }),
  location: locationSchema.optional(),
  camera: cameraSchema,
  image: imageSchema,
})

export const manifestSchema = z.strictObject({
  version: z.literal(3),
  updatedAt: z.string().min(1),
  photos: z.array(photoSchema),
})

export type PhotoAsset = z.infer<typeof assetSchema>
export type PhotoCamera = z.infer<typeof cameraSchema>
export type PhotoImage = z.infer<typeof imageSchema>
export type PhotoLocation = z.infer<typeof locationSchema>
export type PhotoManifestEntry = z.infer<typeof photoSchema>
