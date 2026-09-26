use std::{path::Path, process::Command};

use anyhow::{Context, Result, anyhow, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use fast_image_resize as fr;
use image::{
    ColorType, DynamicImage, ImageBuffer, ImageDecoder, ImageEncoder, ImageReader, Rgb, Rgba,
    codecs::{jpeg::JpegEncoder, png::PngEncoder},
};
use img_parts::{ImageICC, webp::WebP};
use moxcms::{ColorProfile, Layout, RenderingIntent, TransformOptions};
use thumbhash::rgba_to_thumb_hash;
use tracing::warn;

use super::{
    catalog::{Asset, read_asset},
    source::{SourceInfo, is_heif_family, source_swaps_dimensions},
    storage::{create_parent_directory, write_bytes_atomic},
};
use crate::config::ThumbnailFormat;

const SIPS_PATH: &str = "/usr/bin/sips";

const THUMBHASH_MAX_DIMENSION: u32 = 100;

struct PreviewImage {
    image: DynamicImage,
    icc_profile: Option<Vec<u8>>,
}

#[derive(Clone)]
pub(super) struct BuiltThumbnail {
    pub(super) asset: Asset,
    pub(super) thumb_hash: String,
}

pub(super) struct EncodingOptions {
    pub(super) width: u32,
    pub(super) format: ThumbnailFormat,
    pub(super) quality: u8,
}

pub(super) fn build(
    source_path: &Path,
    source_info: &SourceInfo,
    root: &Path,
    output: &Path,
    options: EncodingOptions,
) -> Result<BuiltThumbnail> {
    create_parent_directory(output)?;
    {
        let preview_width = source_info.display_width.min(options.width).max(1);
        let swaps_dimensions = source_swaps_dimensions(source_path, source_info.orientation)?;
        let preview = build_preview_image(source_path, preview_width, swaps_dimensions)?;
        write_thumbnail(&preview, output, options.format, options.quality)
            .with_context(|| format!("failed to write {}", output.display()))?;
    }
    read_thumbnail_asset(root, output, options.format)
}

pub(super) fn validate_runtime() -> Result<()> {
    if !cfg!(target_os = "macos") {
        bail!("the image build pipeline is supported only on macOS");
    }

    let output = Command::new(SIPS_PATH)
        .arg("--version")
        .output()
        .context("failed to launch /usr/bin/sips")?;
    if !output.status.success() {
        bail!("/usr/bin/sips is unavailable");
    }

    Ok(())
}

pub(super) fn read_existing_thumbnail(
    root: &Path,
    path: &Path,
    format: ThumbnailFormat,
) -> Option<BuiltThumbnail> {
    if !path.is_file() {
        return None;
    }
    let result = read_thumbnail_asset(root, path, format);
    match result {
        Ok(thumbnail) => Some(thumbnail),
        Err(error) => {
            warn!("cannot reuse thumbnail {}: {error:#}", path.display());
            None
        }
    }
}

fn read_thumbnail_asset(
    root: &Path,
    path: &Path,
    format: ThumbnailFormat,
) -> Result<BuiltThumbnail> {
    let preview = decode_preview_image(path)?;
    Ok(BuiltThumbnail {
        asset: read_asset(
            root,
            path,
            preview.image.width(),
            preview.image.height(),
            mime_from_format(format),
        )?,
        thumb_hash: compute_thumb_hash(&preview)?,
    })
}

fn resize_to_fit(image: &DynamicImage, max_width: u32, max_height: u32) -> Result<DynamicImage> {
    let width = image.width();
    let height = image.height();
    if width <= max_width && height <= max_height {
        return Ok(image.clone());
    }

    let (scale_numerator, scale_denominator) =
        if u64::from(max_width) * u64::from(height) <= u64::from(max_height) * u64::from(width) {
            (max_width, width)
        } else {
            (max_height, height)
        };

    resize_to_dimensions(
        image,
        scaled_dimension(width, scale_numerator, scale_denominator),
        scaled_dimension(height, scale_numerator, scale_denominator),
    )
}

fn scaled_dimension(dimension: u32, numerator: u32, denominator: u32) -> u32 {
    let denominator = u128::from(denominator.max(1));
    let scaled = (u128::from(dimension) * u128::from(numerator) + denominator / 2) / denominator;
    u32::try_from(scaled).unwrap_or(u32::MAX).max(1)
}

fn resize_to_dimensions(
    image: &DynamicImage,
    target_width: u32,
    target_height: u32,
) -> Result<DynamicImage> {
    let options =
        fr::ResizeOptions::new().resize_alg(fr::ResizeAlg::Convolution(fr::FilterType::Lanczos3));
    let mut resizer = fr::Resizer::new();

    if image.has_alpha() {
        let src = image.to_rgba8();
        let src_width = src.width();
        let src_height = src.height();
        let src_image = fr::images::Image::from_vec_u8(
            src_width,
            src_height,
            src.into_raw(),
            fr::PixelType::U8x4,
        )
        .map_err(|error| anyhow!("failed to create resize source buffer: {error}"))?;
        let mut dst_image =
            fr::images::Image::new(target_width, target_height, fr::PixelType::U8x4);
        resizer
            .resize(&src_image, &mut dst_image, Some(&options))
            .map_err(|error| anyhow!("failed to resize image: {error}"))?;
        let buffer = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(
            target_width,
            target_height,
            dst_image.into_vec(),
        )
        .ok_or_else(|| anyhow!("failed to build resized RGBA image buffer"))?;

        return Ok(DynamicImage::ImageRgba8(buffer));
    }

    let src = image.to_rgb8();
    let src_width = src.width();
    let src_height = src.height();
    let src_image =
        fr::images::Image::from_vec_u8(src_width, src_height, src.into_raw(), fr::PixelType::U8x3)
            .map_err(|error| anyhow!("failed to create resize source buffer: {error}"))?;
    let mut dst_image = fr::images::Image::new(target_width, target_height, fr::PixelType::U8x3);
    resizer
        .resize(&src_image, &mut dst_image, Some(&options))
        .map_err(|error| anyhow!("failed to resize image: {error}"))?;
    let buffer = ImageBuffer::<Rgb<u8>, Vec<u8>>::from_raw(
        target_width,
        target_height,
        dst_image.into_vec(),
    )
    .ok_or_else(|| anyhow!("failed to build resized RGB image buffer"))?;

    Ok(DynamicImage::ImageRgb8(buffer))
}

fn write_thumbnail(
    preview: &PreviewImage,
    path: &Path,
    format: ThumbnailFormat,
    quality: u8,
) -> Result<()> {
    let image = &preview.image;
    let bytes = match format {
        ThumbnailFormat::Jpeg => {
            let mut bytes = Vec::new();
            let rgb = image.to_rgb8();
            let mut encoder = JpegEncoder::new_with_quality(&mut bytes, quality);
            if let Some(profile) = &preview.icc_profile {
                encoder.set_icc_profile(profile.clone())?;
            }
            encoder.encode(&rgb, rgb.width(), rgb.height(), ColorType::Rgb8.into())?;
            bytes
        }
        ThumbnailFormat::Png => {
            let mut bytes = Vec::new();
            let mut encoder = PngEncoder::new(&mut bytes);
            if let Some(profile) = &preview.icc_profile {
                encoder.set_icc_profile(profile.clone())?;
            }
            image.write_with_encoder(encoder)?;
            bytes
        }
        ThumbnailFormat::Webp => {
            let quality = f32::from(quality).clamp(1.0, 100.0);
            let bytes = if let Some(rgb) = image.as_rgb8() {
                webp::Encoder::from_rgb(rgb.as_raw(), rgb.width(), rgb.height())
                    .encode(quality)
                    .to_vec()
            } else if let Some(rgba) = image.as_rgba8() {
                webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height())
                    .encode(quality)
                    .to_vec()
            } else {
                let rgba = image.to_rgba8();
                webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height())
                    .encode(quality)
                    .to_vec()
            };
            if let Some(profile) = &preview.icc_profile {
                let mut encoded = WebP::from_bytes(bytes.into())?;
                encoded.set_icc_profile(Some(profile.clone().into()));
                encoded.encoder().bytes().to_vec()
            } else {
                bytes
            }
        }
    };

    write_bytes_atomic(path, &bytes)
}

fn compute_thumb_hash(preview: &PreviewImage) -> Result<String> {
    let mut reduced = resize_to_fit(
        &preview.image,
        THUMBHASH_MAX_DIMENSION,
        THUMBHASH_MAX_DIMENSION,
    )?
    .to_rgba8();
    // ThumbHash has no profile: its decoded placeholder must contain sRGB pixels.
    if let Some(profile) = &preview.icc_profile {
        let source =
            ColorProfile::new_from_slice(profile).context("invalid thumbnail ICC profile")?;
        let transform = source
            .create_transform_8bit(
                Layout::Rgba,
                &ColorProfile::new_srgb(),
                Layout::Rgba,
                TransformOptions {
                    rendering_intent: RenderingIntent::RelativeColorimetric,
                    ..Default::default()
                },
            )
            .context("failed to create thumbnail color transform")?;
        let mut converted = vec![0; reduced.as_raw().len()];
        transform
            .transform(reduced.as_raw(), &mut converted)
            .context("failed to convert ThumbHash pixels to sRGB")?;
        reduced.as_mut().copy_from_slice(&converted);
    }
    let hash = rgba_to_thumb_hash(
        reduced.width() as usize,
        reduced.height() as usize,
        reduced.as_raw(),
    );

    Ok(BASE64.encode(hash))
}

fn build_preview_image(
    source_path: &Path,
    target_width: u32,
    swaps_dimensions: bool,
) -> Result<PreviewImage> {
    build_sips_preview(source_path, target_width.max(1), swaps_dimensions)
}

fn build_sips_preview(
    source_path: &Path,
    target_width: u32,
    swaps_dimensions: bool,
) -> Result<PreviewImage> {
    let should_optimize_color = !is_heif_family(source_path);
    let temp_dir = tempfile::Builder::new()
        .prefix("lumine-pipeline-preview-")
        .tempdir()
        .context("failed to create temporary preview directory")?;
    let resized_path = temp_dir.path().join("resized.png");
    let preview_path = temp_dir.path().join("preview.png");
    let resize_path = if should_optimize_color {
        &resized_path
    } else {
        &preview_path
    };
    let resize_output = Command::new(SIPS_PATH)
        .arg(if swaps_dimensions {
            "--resampleHeight"
        } else {
            "--resampleWidth"
        })
        .arg(target_width.to_string())
        .arg("-s")
        .arg("format")
        .arg("png")
        .arg(source_path)
        .arg("--out")
        .arg(resize_path)
        .output()
        .with_context(|| format!("failed to launch sips for {}", source_path.display()))?;
    ensure_sips_succeeded(&resize_output, source_path, "resize")?;

    if should_optimize_color {
        let optimize_output = Command::new(SIPS_PATH)
            .arg("--optimizeColorForSharing")
            .arg(&resized_path)
            .arg("--out")
            .arg(&preview_path)
            .output()
            .with_context(|| format!("failed to launch sips for {}", source_path.display()))?;
        ensure_sips_succeeded(&optimize_output, source_path, "color optimization")?;
    }

    let preview = decode_preview_image(&preview_path)?;

    if preview.image.width() != target_width {
        bail!(
            "sips returned unexpected preview width for {}: expected {target_width}, got {}x{}",
            source_path.display(),
            preview.image.width(),
            preview.image.height()
        );
    }

    Ok(preview)
}

fn decode_preview_image(path: &Path) -> Result<PreviewImage> {
    let reader = ImageReader::open(path)
        .with_context(|| format!("failed to open preview {}", path.display()))?
        .with_guessed_format()
        .with_context(|| format!("failed to guess preview format for {}", path.display()))?;
    let mut decoder = reader
        .into_decoder()
        .with_context(|| format!("failed to create preview decoder for {}", path.display()))?;
    let orientation = decoder
        .orientation()
        .with_context(|| format!("failed to read preview orientation for {}", path.display()))?;
    let icc_profile = decoder.icc_profile()?;
    let mut image = DynamicImage::from_decoder(decoder)
        .with_context(|| format!("failed to decode preview {}", path.display()))?;
    image.apply_orientation(orientation);
    Ok(PreviewImage { image, icc_profile })
}

fn ensure_sips_succeeded(
    output: &std::process::Output,
    source_path: &Path,
    operation: &str,
) -> Result<()> {
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        bail!("sips {operation} failed for {}", source_path.display());
    }
    bail!(
        "sips {operation} failed for {}: {stderr}",
        source_path.display()
    );
}

pub(super) fn mime_from_format(format: ThumbnailFormat) -> &'static str {
    match format {
        ThumbnailFormat::Jpeg => "image/jpeg",
        ThumbnailFormat::Png => "image/png",
        ThumbnailFormat::Webp => "image/webp",
    }
}
