# Lumine

Lumine is a personal photo gallery with two parts:

- `pipeline/` is a Rust program that reads your photos, creates web-friendly images and thumbnails, and writes a `manifest.json` file.
- `web/` is a Next.js app that reads the manifest and displays the photos as a gallery, albums, photo pages, and a map.

The basic flow is:

```text
Photo folders -> Rust pipeline -> Generated media folder -> Next.js gallery
```

## Requirements

- macOS (the image pipeline uses the macOS `sips` tool)
- Rust and Cargo
- Node.js 24 or newer
- pnpm

## 1. Prepare your photos

Put photos inside album folders. Album folder names must use the format `YYYYMMDD-Name`:

```text
photos/
  20260820-Berlin/
    IMG_0001.jpg
    IMG_0002.heic
  20260901-Paris/
    IMG_0003.png
```

Supported source formats are JPEG, PNG, WebP, HEIF, HEIC, and HIF.

## 2. Run the backend pipeline

Create the pipeline configuration:

```bash
cd pipeline
cp pipeline.toml.example pipeline.toml
```

Open `pipeline.toml` and update the paths:

```toml
sourcePath = "/absolute/path/to/photos"
targetPath = "/absolute/path/to/lumine-output"

# Use [] to process every supported image.
# Use ["Aether"] to process only files with that macOS Finder tag.
sourceTags = []

originals_dir = "gallery"
thumbnails_dir = "thumbnails"
thumbnail_width = 960
thumbnail_format = "webp"
thumbnail_quality = 92
avif_quality = 95
avif_speed = 6
```

Run the pipeline from the `pipeline/` directory:

```bash
./build.sh
```

The first run may take a while because Cargo needs to download and compile the Rust dependencies. The generated folder will look like this:

```text
lumine-output/
  gallery/       # Full-size AVIF images
  thumbnails/    # Smaller preview images
  manifest.json  # Photo data used by the frontend
  state.json     # Local incremental-build cache
```

The pipeline keeps the album folder structure and extracts useful EXIF data when available, such as the capture time, camera settings, and GPS location. Later runs reuse unchanged files. If a source photo is changed, removed, or no longer has a selected Finder tag, the generated output is updated automatically.

> Keep `sourcePath` and `targetPath` separate. Neither directory may be inside the other.

## 3. Make the generated media available

The frontend needs to access `manifest.json`, `gallery/`, and `thumbnails/` over HTTP. For a quick local test, start a static file server in a second terminal:

```bash
python3 -m http.server 8080 --directory /absolute/path/to/lumine-output
```

Your manifest should now be available at [http://localhost:8080/manifest.json](http://localhost:8080/manifest.json).

For production, publish `manifest.json`, `gallery/`, and `thumbnails/` to any static host or object storage service. Keep `state.json` locally for future pipeline runs. `MEDIA_ORIGIN` must point to the public root containing `manifest.json`.

## 4. Run the frontend

In a new terminal:

```bash
cd web
pnpm install
cp .env.example .env.local
```

For the local media server above, set `web/.env.local` to:

```dotenv
MEDIA_ORIGIN=http://localhost:8080
```

Then start Next.js:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Useful pages include:

- `/` - photo gallery
- `/albums` - album list
- `/map` - albums placed on a map

## Optional: enable the map page

The map page also reads `map.json` from `MEDIA_ORIGIN`. Create it next to `manifest.json` and add coordinates for any albums you want to show:

```json
{
  "version": 1,
  "locations": {
    "20260820-Berlin": { "lat": 52.52, "lng": 13.405 },
    "20260901-Paris": { "lat": 48.8566, "lng": 2.3522 }
  }
}
```

Album keys must exactly match the album folder names.

## Everyday workflow

After the first setup, the normal workflow is short:

1. Add or edit photos inside `sourcePath`.
2. Run `cd pipeline && ./build.sh`.
3. Upload or serve the updated output folder.
4. Refresh the website. The frontend checks the manifest for updates every 30 seconds.

## Useful frontend commands

Run these inside `web/`:

```bash
pnpm lint        # Check code style
pnpm type-check  # Check TypeScript
pnpm test        # Run tests
pnpm build       # Create a production build
pnpm start       # Run the production build
```

## Troubleshooting

- **The gallery is empty:** check `sourceTags`. Use `[]` for all photos, or add the configured Finder tag to your files.
- **An album name causes an error:** use the `YYYYMMDD-Name` format, for example `20260820-Berlin`.
- **The frontend cannot load photos:** open `MEDIA_ORIGIN/manifest.json` in a browser and confirm that the generated image URLs are reachable from the same origin.
- **The pipeline rejects the paths:** use two separate, non-nested directories for `sourcePath` and `targetPath`.
