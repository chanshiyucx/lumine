use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, anyhow, bail};
use image::{ImageDecoder, ImageReader};
use libheif_rs::HeifContext;
use plist::Value as PlistValue;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::storage::path_to_manifest_key;

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "heif", "heic", "hif"];

const FINDER_TAGS_XATTR: &str = "com.apple.metadata:_kMDItemUserTags";

pub(super) fn collect_selected_sources(
    source_dir: &Path,
    source_tags: &[String],
) -> Result<Vec<SourceItem>> {
    let mut candidates = Vec::new();

    for entry in WalkDir::new(source_dir) {
        let entry = entry?;
        let path = entry.path();

        if entry.file_type().is_dir() {
            continue;
        }

        if is_supported_image(path) {
            candidates.push(path.to_path_buf());
        }
    }

    let results: Vec<_> = candidates
        .par_iter()
        .map(|path| build_source_item(source_dir, path, source_tags))
        .collect();

    let mut selected = Vec::new();
    for result in results {
        if let Some(item) = result? {
            selected.push(item);
        }
    }

    Ok(selected)
}

fn build_source_item(
    source_dir: &Path,
    path: &Path,
    source_tags: &[String],
) -> Result<Option<SourceItem>> {
    if !source_tags.is_empty() && !has_any_finder_tag(path, source_tags)? {
        return Ok(None);
    }

    let metadata = fs::metadata(path)
        .with_context(|| format!("failed to read metadata for {}", path.display()))?;
    let relative_path = path
        .strip_prefix(source_dir)
        .with_context(|| format!("failed to strip source prefix from {}", path.display()))?
        .to_path_buf();

    Ok(Some(SourceItem {
        path: path.to_path_buf(),
        relative_path,
        source_key: path_to_manifest_key(source_dir, path)?,
        size: metadata.len(),
        mtime_ms: metadata_mtime_ms(&metadata)?,
    }))
}

fn has_any_finder_tag(path: &Path, expected_tags: &[String]) -> Result<bool> {
    let tags = read_finder_tags(path)?;
    Ok(expected_tags
        .iter()
        .any(|expected| tags.iter().any(|tag| tag == expected)))
}

fn read_finder_tags(path: &Path) -> Result<Vec<String>> {
    let Some(raw) = xattr::get(path, FINDER_TAGS_XATTR)
        .with_context(|| format!("failed to read Finder tags for {}", path.display()))?
    else {
        return Ok(Vec::new());
    };

    let value = PlistValue::from_reader(Cursor::new(raw))
        .with_context(|| format!("failed to parse Finder tags for {}", path.display()))?;

    let tags = match value {
        PlistValue::Array(values) => values
            .into_iter()
            .filter_map(|value| match value {
                PlistValue::String(tag) => Some(normalize_finder_tag(tag)),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    };

    Ok(tags)
}

fn normalize_finder_tag(tag: String) -> String {
    tag.split_once('\n')
        .map(|(name, _)| name.to_string())
        .unwrap_or(tag)
}

pub(super) fn read_source_info(path: &Path, orientation: u8) -> Result<SourceInfo> {
    let (width, height, bit_depth) = if is_heif_family(path) {
        let context = HeifContext::read_from_file(
            path.to_str()
                .ok_or_else(|| anyhow!("invalid source path"))?,
        )?;
        let handle = context.primary_image_handle()?;
        (
            handle.width(),
            handle.height(),
            Some(
                handle
                    .luma_bits_per_pixel()
                    .max(handle.chroma_bits_per_pixel()),
            ),
        )
    } else {
        let decoder = ImageReader::open(path)?
            .with_guessed_format()?
            .into_decoder()?;
        let (width, height) = decoder.dimensions();
        let color = decoder.color_type();
        (
            width,
            height,
            u8::try_from(color.bits_per_pixel() / u16::from(color.channel_count())).ok(),
        )
    };
    let display_width = if matches!(orientation, 5..=8) {
        height
    } else {
        width
    };
    if width == 0 || height == 0 {
        bail!("invalid source dimensions: {}", path.display());
    }
    Ok(SourceInfo {
        display_width,
        orientation,
        bit_depth,
    })
}

pub(super) fn source_swaps_dimensions(path: &Path, source_orientation: u8) -> Result<bool> {
    let container_swaps = if is_heif_family(path) {
        heif_container_swaps_dimensions(path)?
    } else {
        false
    };
    let exif_swaps = matches!(source_orientation, 5..=8);
    Ok(container_swaps != exif_swaps)
}

fn heif_container_swaps_dimensions(path: &Path) -> Result<bool> {
    let path = path
        .to_str()
        .ok_or_else(|| anyhow!("HEIF source path is not valid UTF-8: {}", path.display()))?;
    let context = HeifContext::read_from_file(path)
        .with_context(|| format!("failed to open HEIF container {path}"))?;
    let handle = context
        .primary_image_handle()
        .with_context(|| format!("failed to read primary image handle {path}"))?;
    let stored_width = u32::try_from(handle.ispe_width())
        .with_context(|| format!("invalid stored HEIF width for {path}"))?;
    let stored_height = u32::try_from(handle.ispe_height())
        .with_context(|| format!("invalid stored HEIF height for {path}"))?;
    let display_width = handle.width();
    let display_height = handle.height();

    if stored_width == 0 || stored_height == 0 || display_width == 0 || display_height == 0 {
        bail!("invalid HEIF dimensions for {path}");
    }

    if (display_width, display_height) == (stored_width, stored_height) {
        return Ok(false);
    }

    if (display_width, display_height) == (stored_height, stored_width) {
        return Ok(true);
    }

    bail!(
        "unsupported HEIF dimension transformation for {path}: stored {stored_width}x{stored_height}, displayed {display_width}x{display_height}"
    )
}

pub(super) fn metadata_mtime_ms(metadata: &fs::Metadata) -> Result<u64> {
    let modified = metadata.modified()?;
    let duration = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| anyhow!("invalid file mtime: {error}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| anyhow!("file mtime is too large"))
}

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            let ext = extension.to_ascii_lowercase();
            SUPPORTED_EXTENSIONS.contains(&ext.as_str())
        })
}

pub(super) fn is_heif_family(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("hif")
                || extension.eq_ignore_ascii_case("heif")
                || extension.eq_ignore_ascii_case("heic")
        })
}

pub(super) struct SourceItem {
    pub(super) path: PathBuf,
    pub(super) relative_path: PathBuf,
    pub(super) source_key: String,
    pub(super) size: u64,
    pub(super) mtime_ms: u64,
}

pub(super) struct SourceInfo {
    pub(super) display_width: u32,
    pub(super) orientation: u8,
    pub(super) bit_depth: Option<u8>,
}
