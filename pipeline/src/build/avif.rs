use std::{fs, io::Cursor, path::Path};

use anyhow::{Context, Result, anyhow};
use image::{
    ColorType, DynamicImage, GenericImageView, ImageBuffer, ImageDecoder, ImageReader, Rgb, Rgba,
    metadata::Orientation,
};
use libheif_rs::{
    Channel, ColorProfileRaw, ColorSpace, CompressionFormat, EncoderParameterValue, EncoderQuality,
    HeifContext, Image, LibHeif, RgbChroma, color_profile_types,
};
use ravif::{BitDepth as AvifBitDepth, ColorModel as AvifColorModel, Encoder as RavifEncoder, Img};
use rgb::FromSlice;
use tracing::warn;

use super::{
    catalog::{Asset, read_asset},
    source::is_heif_family,
    storage::write_bytes_atomic,
};

pub(super) const AVIF_MIME: &str = "image/avif";

const BT709: [f32; 3] = [0.2126, 0.7152, 0.0722];

pub(super) struct LoadedImage {
    image: DynamicImage,
    bit_depth: u8,
    has_alpha: bool,
    icc_profile: Option<Vec<u8>>,
}

pub(super) struct EncodingOptions {
    pub(super) quality: u8,
    pub(super) speed: u8,
    pub(super) threads: usize,
}

pub(super) fn decode(path: &Path, orientation: u8) -> Result<LoadedImage> {
    let bytes = fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    let mut loaded = decode_source_image(path, &bytes)
        .with_context(|| format!("failed to decode {}", path.display()))?;
    drop(bytes);
    apply_source_orientation(&mut loaded.image, orientation);
    Ok(loaded)
}

pub(super) fn encode(
    loaded: &LoadedImage,
    root: &Path,
    output: &Path,
    options: EncodingOptions,
) -> Result<Asset> {
    write_original_avif(
        loaded,
        output,
        options.quality,
        options.speed,
        options.threads,
    )
    .with_context(|| format!("failed to write {}", output.display()))?;
    let (width, height) = loaded.image.dimensions();
    read_asset(root, output, width, height, AVIF_MIME)
}

pub(super) fn read_existing_original(root: &Path, path: &Path) -> Option<Asset> {
    if !path.is_file() {
        return None;
    }
    let result = (|| -> Result<Asset> {
        let context = HeifContext::read_from_file(
            path.to_str().ok_or_else(|| anyhow!("invalid image path"))?,
        )?;
        let handle = context.primary_image_handle()?;
        read_asset(root, path, handle.width(), handle.height(), AVIF_MIME)
    })();
    match result {
        Ok(asset) => Some(asset),
        Err(error) => {
            warn!("cannot reuse AVIF {}: {error:#}", path.display());
            None
        }
    }
}

fn decode_source_image(path: &Path, bytes: &[u8]) -> Result<LoadedImage> {
    if is_heif_family(path) {
        return decode_heif_image(path, bytes);
    }

    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .with_context(|| format!("failed to guess image format for {}", path.display()))?
        .into_decoder()?;
    let icc_profile = decoder.icc_profile()?;
    let image = DynamicImage::from_decoder(decoder)
        .with_context(|| format!("failed to decode {}", path.display()))?;

    Ok(LoadedImage {
        bit_depth: inferred_bit_depth(&image),
        has_alpha: image.has_alpha(),
        icc_profile,
        image,
    })
}

fn decode_heif_image(path: &Path, bytes: &[u8]) -> Result<LoadedImage> {
    let context = HeifContext::read_from_bytes(bytes)
        .with_context(|| format!("failed to open HEIF container {}", path.display()))?;
    let handle = context
        .primary_image_handle()
        .with_context(|| format!("failed to read primary image handle {}", path.display()))?;
    let bit_depth = handle
        .luma_bits_per_pixel()
        .max(handle.chroma_bits_per_pixel());
    let has_alpha = handle.has_alpha_channel();
    let icc_profile = handle.color_profile_raw().map(|profile| profile.data);
    let high_bit_depth = bit_depth > 8;
    let little_endian = cfg!(target_endian = "little");
    let color_space = match (high_bit_depth, has_alpha, little_endian) {
        (false, false, _) => ColorSpace::Rgb(RgbChroma::Rgb),
        (false, true, _) => ColorSpace::Rgb(RgbChroma::Rgba),
        (true, false, true) => ColorSpace::Rgb(RgbChroma::HdrRgbLe),
        (true, false, false) => ColorSpace::Rgb(RgbChroma::HdrRgbBe),
        (true, true, true) => ColorSpace::Rgb(RgbChroma::HdrRgbaLe),
        (true, true, false) => ColorSpace::Rgb(RgbChroma::HdrRgbaBe),
    };
    let image = LibHeif::new()
        .decode(&handle, color_space, None)
        .with_context(|| format!("failed to decode HEIF image {}", path.display()))?;
    let planes = image.planes();
    let plane = planes
        .interleaved
        .ok_or_else(|| anyhow!("HEIF image is not interleaved: {}", path.display()))?;

    if high_bit_depth {
        let channels = if has_alpha { 4usize } else { 3usize };
        let row_size = plane.width as usize * channels * 2;
        let mut pixels =
            Vec::with_capacity(plane.width as usize * plane.height as usize * channels);

        for row in plane
            .data
            .chunks_exact(plane.stride)
            .take(plane.height as usize)
        {
            for sample in row[..row_size].chunks_exact(2) {
                let value = if little_endian {
                    u16::from_le_bytes([sample[0], sample[1]])
                } else {
                    u16::from_be_bytes([sample[0], sample[1]])
                };
                pixels.push(value);
            }
        }

        let image = if has_alpha {
            let rgba =
                ImageBuffer::<Rgba<u16>, Vec<u16>>::from_raw(plane.width, plane.height, pixels)
                    .ok_or_else(|| {
                        anyhow!(
                            "failed to construct high-bit-depth RGBA image {}",
                            path.display()
                        )
                    })?;
            DynamicImage::ImageRgba16(rgba)
        } else {
            let rgb =
                ImageBuffer::<Rgb<u16>, Vec<u16>>::from_raw(plane.width, plane.height, pixels)
                    .ok_or_else(|| {
                        anyhow!(
                            "failed to construct high-bit-depth RGB image {}",
                            path.display()
                        )
                    })?;
            DynamicImage::ImageRgb16(rgb)
        };

        return Ok(LoadedImage {
            image,
            bit_depth,
            has_alpha,
            icc_profile,
        });
    }

    let channels = if has_alpha { 4usize } else { 3usize };
    let row_size = plane.width as usize * channels;
    let mut pixels = Vec::with_capacity(row_size * plane.height as usize);

    for row in plane
        .data
        .chunks_exact(plane.stride)
        .take(plane.height as usize)
    {
        pixels.extend_from_slice(&row[..row_size]);
    }

    let image = if has_alpha {
        let rgba = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(plane.width, plane.height, pixels)
            .ok_or_else(|| anyhow!("failed to construct RGBA image buffer {}", path.display()))?;
        DynamicImage::ImageRgba8(rgba)
    } else {
        let rgb = ImageBuffer::<Rgb<u8>, Vec<u8>>::from_raw(plane.width, plane.height, pixels)
            .ok_or_else(|| anyhow!("failed to construct RGB image buffer {}", path.display()))?;
        DynamicImage::ImageRgb8(rgb)
    };

    Ok(LoadedImage {
        image,
        bit_depth: 8,
        has_alpha,
        icc_profile,
    })
}

fn write_original_avif(
    loaded: &LoadedImage,
    path: &Path,
    avif_quality: u8,
    avif_speed: u8,
    avif_threads: usize,
) -> Result<()> {
    let avif_file = if let Some(profile) = &loaded.icc_profile {
        encode_avif_with_icc(loaded, profile, avif_quality, avif_speed, avif_threads)?
    } else if loaded.bit_depth > 8 {
        encode_avif_from_high_bit_depth_source(loaded, avif_quality, avif_speed, avif_threads)?
    } else {
        encode_avif_from_8_bit_source(loaded, avif_quality, avif_speed, avif_threads)?
    };

    write_bytes_atomic(path, &avif_file)
}

// libheif preserves ICC and performs the RGB-to-YCbCr conversion for AOM.
fn encode_avif_with_icc(
    loaded: &LoadedImage,
    profile: &[u8],
    quality: u8,
    speed: u8,
    threads: usize,
) -> Result<Vec<u8>> {
    let heif = LibHeif::new_checked()?;
    let (width, height) = loaded.image.dimensions();
    let chroma = match (loaded.has_alpha, cfg!(target_endian = "little")) {
        (false, true) => RgbChroma::HdrRgbLe,
        (false, false) => RgbChroma::HdrRgbBe,
        (true, true) => RgbChroma::HdrRgbaLe,
        (true, false) => RgbChroma::HdrRgbaBe,
    };
    let mut image = Image::new(width, height, ColorSpace::Rgb(chroma))?;
    image.create_plane(Channel::Interleaved, width, height, 10)?;
    {
        let mut planes = image.planes_mut();
        let plane = planes
            .interleaved
            .as_mut()
            .context("missing RGB encoding plane")?;
        let channels = if loaded.has_alpha { 4 } else { 3 };
        let pixels = if loaded.has_alpha {
            loaded.image.to_rgba16().into_raw()
        } else {
            loaded.image.to_rgb16().into_raw()
        };
        // DynamicImage expands 8-bit samples to the full u16 range.
        let sample_depth = if loaded.bit_depth <= 8 {
            16
        } else {
            loaded.bit_depth
        };
        for (source, destination) in pixels
            .chunks_exact(width as usize * channels)
            .zip(plane.data.chunks_exact_mut(plane.stride))
        {
            for (sample, bytes) in source.iter().zip(destination.chunks_exact_mut(2)) {
                bytes.copy_from_slice(&scale_sample_to_10_bit(*sample, sample_depth).to_ne_bytes());
            }
        }
    }
    image.set_color_profile_raw(&ColorProfileRaw::new(
        color_profile_types::PROF,
        profile.to_vec(),
    ))?;
    // libheif-rs 2.7 does not retain its CString for the name filter. Select by ID instead.
    let descriptor = heif
        .encoder_descriptors(16, Some(CompressionFormat::Av1), None)
        .into_iter()
        .find(|descriptor| descriptor.id() == "aom")
        .context("ICC AVIF encoding requires the libheif AOM encoder")?;
    let mut encoder = heif.encoder(descriptor)?;
    encoder.set_quality(EncoderQuality::Lossy(quality))?;
    encoder.set_parameter_value("speed", EncoderParameterValue::Int(i32::from(speed.min(9))))?;
    encoder.set_parameter_value(
        "threads",
        EncoderParameterValue::Int(i32::try_from(threads)?),
    )?;
    encoder.set_parameter_value("chroma", EncoderParameterValue::String("444".into()))?;
    if loaded.has_alpha {
        encoder.set_parameter_value(
            "alpha-quality",
            EncoderParameterValue::Int(i32::from(quality)),
        )?;
    }
    let mut context = HeifContext::new()?;
    context.encode_image(&image, &mut encoder, None)?;
    Ok(context.write_to_bytes()?)
}

fn encode_avif_from_high_bit_depth_source(
    loaded: &LoadedImage,
    quality: u8,
    speed: u8,
    threads: usize,
) -> Result<Vec<u8>> {
    let encoder = RavifEncoder::new()
        .with_quality(f32::from(quality))
        .with_alpha_quality(f32::from(quality))
        .with_speed(speed)
        .with_bit_depth(AvifBitDepth::Ten)
        .with_internal_color_model(AvifColorModel::YCbCr)
        .with_num_threads(Some(threads));
    let bit_depth = loaded.bit_depth.clamp(10, 16);

    if loaded.has_alpha {
        let converted;
        let rgba = if let Some(rgba) = loaded.image.as_rgba16() {
            rgba
        } else {
            converted = loaded.image.to_rgba16();
            &converted
        };
        let planes = rgba.pixels().map(|pixel| {
            rgb_to_10_bit_ycbcr(
                [
                    scale_sample_to_10_bit(pixel.0[0], bit_depth),
                    scale_sample_to_10_bit(pixel.0[1], bit_depth),
                    scale_sample_to_10_bit(pixel.0[2], bit_depth),
                ],
                BT709,
            )
        });
        let alpha = rgba
            .pixels()
            .map(|pixel| scale_sample_to_10_bit(pixel.0[3], bit_depth));

        return encoder
            .encode_raw_planes_10_bit(
                rgba.width() as usize,
                rgba.height() as usize,
                planes,
                Some(alpha),
                ravif::PixelRange::Full,
                ravif::MatrixCoefficients::BT709,
            )
            .map(|encoded| encoded.avif_file)
            .map_err(|error| anyhow!("failed to encode 10-bit AVIF: {error}"));
    }

    let converted;
    let rgb = if let Some(rgb) = loaded.image.as_rgb16() {
        rgb
    } else {
        converted = loaded.image.to_rgb16();
        &converted
    };
    let planes = rgb.pixels().map(|pixel| {
        rgb_to_10_bit_ycbcr(
            [
                scale_sample_to_10_bit(pixel.0[0], bit_depth),
                scale_sample_to_10_bit(pixel.0[1], bit_depth),
                scale_sample_to_10_bit(pixel.0[2], bit_depth),
            ],
            BT709,
        )
    });

    encoder
        .encode_raw_planes_10_bit(
            rgb.width() as usize,
            rgb.height() as usize,
            planes,
            None::<std::iter::Empty<u16>>,
            ravif::PixelRange::Full,
            ravif::MatrixCoefficients::BT709,
        )
        .map(|encoded| encoded.avif_file)
        .map_err(|error| anyhow!("failed to encode 10-bit AVIF: {error}"))
}

fn encode_avif_from_8_bit_source(
    loaded: &LoadedImage,
    quality: u8,
    speed: u8,
    threads: usize,
) -> Result<Vec<u8>> {
    // ravif recommends 10-bit internal precision even for 8-bit source pixels.
    let encoder = RavifEncoder::new()
        .with_quality(f32::from(quality))
        .with_alpha_quality(f32::from(quality))
        .with_speed(speed)
        .with_bit_depth(AvifBitDepth::Ten)
        .with_internal_color_model(AvifColorModel::RGB)
        .with_num_threads(Some(threads));

    if loaded.has_alpha {
        let rgba = loaded.image.to_rgba8();
        return encoder
            .encode_rgba(Img::new(
                rgba.as_raw().as_rgba(),
                rgba.width() as usize,
                rgba.height() as usize,
            ))
            .map(|encoded| encoded.avif_file)
            .map_err(|error| anyhow!("failed to encode AVIF: {error}"));
    }

    let rgb = loaded.image.to_rgb8();
    encoder
        .encode_rgb(Img::new(
            rgb.as_raw().as_rgb(),
            rgb.width() as usize,
            rgb.height() as usize,
        ))
        .map(|encoded| encoded.avif_file)
        .map_err(|error| anyhow!("failed to encode AVIF: {error}"))
}

fn apply_source_orientation(image: &mut DynamicImage, source_orientation: u8) {
    if let Some(orientation) = Orientation::from_exif(source_orientation) {
        image.apply_orientation(orientation);
    }
}

// Output paths and persistence

fn inferred_bit_depth(image: &DynamicImage) -> u8 {
    match image.color() {
        ColorType::L16 | ColorType::La16 | ColorType::Rgb16 | ColorType::Rgba16 => 16,
        _ => 8,
    }
}

fn scale_sample_to_10_bit(value: u16, source_bit_depth: u8) -> u16 {
    let source_bit_depth = source_bit_depth.clamp(1, 16);
    let source_max = ((1u32 << source_bit_depth) - 1).max(1);
    let scaled = (u32::from(value).min(source_max) * 1023 + (source_max / 2)) / source_max;
    u16::try_from(scaled).expect("10-bit sample must fit in u16")
}

fn rgb_to_10_bit_ycbcr(rgb: [u16; 3], matrix: [f32; 3]) -> [u16; 3] {
    let scale = 1023.0f32;
    let shift = (scale * 0.5).round();
    let r = f32::from(rgb[0]);
    let g = f32::from(rgb[1]);
    let b = f32::from(rgb[2]);
    let y = matrix[2].mul_add(b, matrix[0].mul_add(r, matrix[1] * g));
    let cb = (b - y).mul_add(0.5 / (1.0 - matrix[2]), shift);
    let cr = (r - y).mul_add(0.5 / (1.0 - matrix[0]), shift);

    [
        clamp_10_bit(y.round()),
        clamp_10_bit(cb.round()),
        clamp_10_bit(cr.round()),
    ]
}

#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "the value is clamped to the unsigned 10-bit range before conversion"
)]
fn clamp_10_bit(value: f32) -> u16 {
    value.clamp(0.0, 1023.0) as u16
}
