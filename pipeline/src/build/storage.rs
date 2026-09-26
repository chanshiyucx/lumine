use std::{
    collections::BTreeSet,
    fs,
    io::{BufWriter, Write},
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, anyhow, bail};
use serde::Serialize;
use walkdir::WalkDir;

use crate::config::ThumbnailFormat;

const AVIF_EXTENSION: &str = "avif";

pub(super) fn validate_path_isolation(source_dir: &Path, root_dir: &Path) -> Result<()> {
    let canonical_source = fs::canonicalize(source_dir)
        .with_context(|| format!("failed to resolve source path {}", source_dir.display()))?;
    let canonical_root = canonicalize_allow_missing(root_dir)
        .with_context(|| format!("failed to resolve target path {}", root_dir.display()))?;

    if canonical_source == canonical_root
        || canonical_source.starts_with(&canonical_root)
        || canonical_root.starts_with(&canonical_source)
    {
        bail!(
            "sourcePath and targetPath must be separate, non-nested directories (source: {}, target: {})",
            canonical_source.display(),
            canonical_root.display()
        );
    }

    Ok(())
}

fn canonicalize_allow_missing(path: &Path) -> Result<PathBuf> {
    let mut existing = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()?.join(path)
    };
    let mut missing_components = Vec::new();

    while !existing.exists() {
        let name = existing
            .file_name()
            .ok_or_else(|| anyhow!("path has no existing ancestor: {}", path.display()))?;
        missing_components.push(name.to_os_string());

        if !existing.pop() {
            bail!("path has no existing ancestor: {}", path.display());
        }
    }

    let mut canonical = fs::canonicalize(&existing)?;
    for component in missing_components.iter().rev() {
        canonical.push(component);
    }

    Ok(canonical)
}

pub(super) fn remove_stale_outputs(
    root: &Path,
    directories: [&Path; 2],
    expected: &BTreeSet<String>,
) -> Result<()> {
    let canonical_root = fs::canonicalize(root)?;
    for directory in directories {
        for entry in WalkDir::new(directory).follow_links(false) {
            let entry = entry?;
            let path = entry.path();
            if !entry.file_type().is_file() {
                continue;
            }
            let managed = path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| {
                    ["avif", "jpg", "jpeg", "png", "webp"]
                        .iter()
                        .any(|known| ext.eq_ignore_ascii_case(known))
                });
            if managed {
                let key = path_to_manifest_key(root, path)?;
                if !expected.contains(&key) {
                    remove_output_if_exists(root, &canonical_root, &key)?;
                }
            }
        }
    }
    Ok(())
}

fn remove_output_if_exists(
    root_dir: &Path,
    canonical_root: &Path,
    relative_path: &str,
) -> Result<()> {
    if relative_path.is_empty() {
        return Ok(());
    }

    let relative_path = Path::new(relative_path);
    if relative_path.is_absolute()
        || relative_path
            .components()
            .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        bail!(
            "refusing to remove unsafe state path: {}",
            relative_path.display()
        );
    }

    let path = root_dir.join(relative_path);
    if !path.exists() {
        return Ok(());
    }

    let canonical_path = fs::canonicalize(&path)
        .with_context(|| format!("failed to resolve stale output {}", path.display()))?;
    if canonical_path == canonical_root || !canonical_path.starts_with(canonical_root) {
        bail!(
            "refusing to remove path outside target directory: {}",
            canonical_path.display()
        );
    }

    fs::remove_file(&path)
        .with_context(|| format!("failed to remove stale output {}", path.display()))?;

    Ok(())
}

// Per-photo build pipeline

pub(super) fn build_original_path(originals_dir: &Path, relative_source: &Path) -> PathBuf {
    let mut path = originals_dir.join(relative_source);
    path.set_extension(AVIF_EXTENSION);
    path
}

pub(super) fn build_thumbnail_path(
    thumbnails_dir: &Path,
    format: ThumbnailFormat,
    relative_source: &Path,
) -> PathBuf {
    let mut path = thumbnails_dir.join(relative_source);
    path.set_extension(format.extension());
    path
}

pub(super) fn create_parent_directory(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    Ok(())
}

pub(super) fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let mut tmp_file = create_temporary_output_file(path)?;
    {
        let mut writer = BufWriter::new(tmp_file.as_file_mut());
        serde_json::to_writer(&mut writer, value)
            .with_context(|| format!("failed to write temporary JSON for {}", path.display()))?;
        writer
            .flush()
            .with_context(|| format!("failed to flush temporary JSON for {}", path.display()))?;
    }
    persist_temporary_file(tmp_file, path)?;
    Ok(())
}

pub(super) fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut tmp_file = create_temporary_output_file(path)?;
    {
        let mut writer = BufWriter::new(tmp_file.as_file_mut());
        writer
            .write_all(bytes)
            .with_context(|| format!("failed to write temporary file for {}", path.display()))?;
        writer
            .flush()
            .with_context(|| format!("failed to flush temporary file for {}", path.display()))?;
    }
    persist_temporary_file(tmp_file, path)?;
    Ok(())
}

fn create_temporary_output_file(path: &Path) -> Result<tempfile::NamedTempFile> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    tempfile::Builder::new()
        .prefix(".lumine-pipeline-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .with_context(|| format!("failed to create temporary file for {}", path.display()))
}

fn persist_temporary_file(tmp_file: tempfile::NamedTempFile, path: &Path) -> Result<()> {
    tmp_file
        .persist(path)
        .map(|_| ())
        .map_err(|error| anyhow!("failed to replace {}: {}", path.display(), error.error))
}

pub(super) fn path_to_manifest_key(base_dir: &Path, path: &Path) -> Result<String> {
    let relative = path
        .strip_prefix(base_dir)
        .with_context(|| format!("failed to strip prefix from {}", path.display()))?;

    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/"))
}
