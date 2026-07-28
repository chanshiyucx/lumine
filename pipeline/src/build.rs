use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    fmt::Write as _,
    fs,
    fs::File,
    io::{BufWriter, Cursor, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        Arc, Condvar, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc,
    },
    time::Instant,
};

use anyhow::{Context, Result, anyhow, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use exif::{DateTime as ExifDateTime, Exif, In, Reader as ExifReader, Tag, Value};
use fast_image_resize as fr;
use image::{
    ColorType, DynamicImage, GenericImageView, ImageBuffer, ImageFormat, ImageReader, Rgb, Rgba,
    codecs::jpeg::JpegEncoder, imageops, metadata::Orientation,
};
use indicatif::{ProgressBar, ProgressStyle};
use libheif_rs::{ColorSpace, HeifContext, LibHeif, RgbChroma};
use plist::Value as PlistValue;
use ravif::{BitDepth as AvifBitDepth, ColorModel as AvifColorModel, Encoder as RavifEncoder, Img};
use rayon::prelude::*;
use rgb::FromSlice;
use serde::{Deserialize, Serialize};
use thumbhash::rgba_to_thumb_hash;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tracing::warn;
use walkdir::WalkDir;

use crate::config::{Config, ThumbnailFormat};

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "heif", "heic", "hif"];
const FINDER_TAGS_XATTR: &str = "com.apple.metadata:_kMDItemUserTags";
const AVIF_EXTENSION: &str = "avif";
const AVIF_MIME: &str = "image/avif";
const BT709: [f32; 3] = [0.2126, 0.7152, 0.0722];
const MANIFEST_VERSION: u8 = 2;
const THUMBHASH_MAX_DIMENSION: u32 = 100;
const PREVIEW_ORIENTATION_COMPARE_SIZE: u32 = 64;
const CHECKPOINT_BATCH_MIN: usize = 8;

// Build orchestration and concurrency

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BuildExit {
    Success,
    PartialFailure,
}

struct BuildPlan {
    root_dir: PathBuf,
    originals_dir: PathBuf,
    thumbnails_dir: PathBuf,
    total: usize,
    workers: usize,
    avif_threads: usize,
    full_res_parallelism: usize,
    checkpoint_interval: usize,
    photos: BTreeMap<String, PhotoEntry>,
    files: BTreeMap<String, StateEntry>,
    pending: Vec<SourceItem>,
    reused: usize,
}

#[derive(Debug, Clone, Copy)]
struct BuildSummary {
    built: usize,
    reused: usize,
    failed: usize,
}

impl BuildSummary {
    fn exit_status(self) -> BuildExit {
        if self.failed == 0 {
            BuildExit::Success
        } else {
            BuildExit::PartialFailure
        }
    }
}

pub(crate) fn run() -> Result<BuildExit> {
    let config = Config::load()?;
    let started_at = Instant::now();
    let mut plan = prepare_build_plan(&config)?;

    print_build_start(&config, &plan);
    let progress = create_build_progress(plan.pending.len())?;

    let summary = execute_build(&config, &progress, &mut plan)?;
    progress.finish_and_clear();

    if summary.built == 0 && summary.failed == 0 {
        println!(
            "Up to date · {} reused · {:.2?}",
            summary.reused,
            started_at.elapsed()
        );
    } else {
        println!(
            "Completed in {:.2?} · {} built · {} reused · {} failed",
            started_at.elapsed(),
            summary.built,
            summary.reused,
            summary.failed
        );
    }

    Ok(summary.exit_status())
}

fn prepare_build_plan(config: &Config) -> Result<BuildPlan> {
    if !config.source_tags().is_empty() && !cfg!(target_os = "macos") {
        bail!("sourceTags filtering currently only supports macOS");
    }

    let source_dir = config.source_path();
    let root_dir = config.root_dir();
    let originals_dir = config.originals_path();
    let thumbnails_dir = config.thumbnails_path();

    let source_metadata = fs::metadata(&source_dir)
        .with_context(|| format!("failed to access source directory {}", source_dir.display()))?;
    if !source_metadata.is_dir() {
        bail!("source path is not a directory: {}", source_dir.display());
    }

    validate_path_isolation(&source_dir, &root_dir)?;
    fs::create_dir_all(&originals_dir).with_context(|| {
        format!(
            "failed to create originals directory {}",
            originals_dir.display()
        )
    })?;
    fs::create_dir_all(&thumbnails_dir).with_context(|| {
        format!(
            "failed to create thumbnails directory {}",
            thumbnails_dir.display()
        )
    })?;

    let mut sources = collect_selected_sources(&source_dir, config.source_tags())?;
    sources.sort_by(|left, right| left.source_key.cmp(&right.source_key));

    let previous_manifest = load_previous_manifest(&config.manifest_path())?;
    let previous_state = load_previous_state(&config.state_path())?;
    let current_keys: BTreeSet<_> = sources.iter().map(|item| item.source_key.clone()).collect();
    remove_stale_outputs(&root_dir, &current_keys, &previous_state)?;

    let mut photos = BTreeMap::new();
    let mut files = BTreeMap::new();
    let mut pending = Vec::new();
    let mut reused_count = 0usize;

    for item in sources {
        if let Some((photo, state_entry)) =
            find_reusable_photo(&root_dir, &item, &previous_manifest, &previous_state)
        {
            photos.insert(photo.original.url.clone(), photo);
            files.insert(item.source_key, state_entry);
            reused_count += 1;
        } else {
            pending.push(item);
        }
    }
    pending.sort_by(|left, right| {
        right
            .size
            .cmp(&left.size)
            .then_with(|| left.source_key.cmp(&right.source_key))
    });

    let total = reused_count + pending.len();
    let workers = recommended_parallelism();

    Ok(BuildPlan {
        root_dir,
        originals_dir,
        thumbnails_dir,
        total,
        workers,
        avif_threads: recommended_avif_threads(workers, total),
        full_res_parallelism: recommended_full_res_parallelism(workers),
        checkpoint_interval: CHECKPOINT_BATCH_MIN.max(total / 50),
        photos,
        files,
        pending,
        reused: reused_count,
    })
}

fn print_build_start(config: &Config, plan: &BuildPlan) {
    println!("Build plan");
    println!("  Source        {}", config.source_path().display());
    println!("  Output        {}", plan.root_dir.display());
    if !config.source_tags().is_empty() {
        println!("  Tags          {}", config.source_tags().join(", "));
    }
    println!("  Originals     {}", plan.originals_dir.display());
    println!("  Thumbnails    {}", plan.thumbnails_dir.display());
    println!(
        "  Images        {} total · {} to build · {} reused",
        plan.total,
        plan.pending.len(),
        plan.reused
    );
    if !plan.pending.is_empty() {
        println!(
            "  Concurrency   up to {} workers · up to {} full-resolution jobs · {} AVIF {thread_label}/worker",
            plan.workers,
            plan.full_res_parallelism,
            plan.avif_threads,
            thread_label = if plan.avif_threads == 1 {
                "thread"
            } else {
                "threads"
            }
        );
    }
    println!();
}

fn execute_build(
    config: &Config,
    progress: &ProgressBar,
    plan: &mut BuildPlan,
) -> Result<BuildSummary> {
    if plan.pending.is_empty() || !plan.photos.is_empty() {
        write_build_checkpoint(config, &plan.photos, &plan.files)?;
    }

    if plan.pending.is_empty() {
        return Ok(BuildSummary {
            built: 0,
            reused: plan.reused,
            failed: 0,
        });
    }

    let pending = std::mem::take(&mut plan.pending);
    let pending_count = pending.len();
    let (tx, rx) = mpsc::channel();
    let mut built_count = 0usize;
    let mut failed_count = 0usize;
    let mut since_checkpoint = 0usize;
    let status_done = Arc::new(AtomicBool::new(false));
    let worker_count = plan.workers;
    let worker_context = Arc::new(BuildWorkerContext {
        config: config.clone(),
        root_dir: plan.root_dir.clone(),
        originals_dir: plan.originals_dir.clone(),
        thumbnails_dir: plan.thumbnails_dir.clone(),
        avif_threads: plan.avif_threads,
        full_res_limiter: FullResLimiter::new(plan.full_res_parallelism),
        status: BuildStatus::default(),
        pending: Mutex::new(VecDeque::from(pending)),
    });
    let status_context = Arc::clone(&worker_context);
    let status_progress = progress.clone();
    let status_done_flag = Arc::clone(&status_done);
    let status_thread = std::thread::spawn(move || {
        while !status_done_flag.load(Ordering::Acquire) {
            let processing = status_context.status.processing.load(Ordering::Relaxed);
            let encoding = status_context.status.encoding.load(Ordering::Relaxed);
            status_progress.set_message(format!(
                "{processing} processing · {encoding} encoding AVIF"
            ));
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
    let workers: Vec<_> = (0..worker_count)
        .map(|_| {
            let tx = tx.clone();
            let context = Arc::clone(&worker_context);
            std::thread::spawn(move || run_build_worker(&context, &tx))
        })
        .collect();
    drop(tx);

    let collect_result = (|| -> Result<()> {
        for _ in 0..pending_count {
            let outcome = rx
                .recv()
                .map_err(|error| anyhow!("failed to receive build result: {error}"))?;
            progress.inc(1);

            match outcome {
                BuildOutcome::Success(photo) => {
                    let photo = *photo;
                    plan.files.insert(photo.state_key, photo.state_entry);
                    plan.photos
                        .insert(photo.photo_entry.original.url.clone(), photo.photo_entry);
                    built_count += 1;
                    since_checkpoint += 1;
                    if built_count == 1 || since_checkpoint >= plan.checkpoint_interval {
                        write_build_checkpoint(config, &plan.photos, &plan.files)?;
                        since_checkpoint = 0;
                    }
                }
                BuildOutcome::Failure { source_key, error } => {
                    progress.println(format!("Failed {source_key}: {error}"));
                    failed_count += 1;
                }
            }
        }

        Ok(())
    })();

    let mut worker_panicked = false;
    for worker in workers {
        worker_panicked |= worker.join().is_err();
    }
    status_done.store(true, Ordering::Release);
    let _ = status_thread.join();

    if worker_panicked {
        bail!("build worker thread panicked");
    }
    collect_result?;

    write_build_checkpoint(config, &plan.photos, &plan.files)?;

    Ok(BuildSummary {
        built: built_count,
        reused: plan.reused,
        failed: failed_count,
    })
}

fn run_build_worker(context: &BuildWorkerContext, outcomes: &mpsc::Sender<BuildOutcome>) {
    loop {
        let item = {
            let mut pending = context.pending.lock().expect("pending queue poisoned");
            pending.pop_front()
        };
        let Some(item) = item else {
            break;
        };

        let photo_context = PhotoBuildContext {
            config: &context.config,
            root_dir: &context.root_dir,
            originals_dir: &context.originals_dir,
            thumbnails_dir: &context.thumbnails_dir,
            avif_threads: context.avif_threads,
            full_res_limiter: &context.full_res_limiter,
            status: &context.status,
        };
        let result = build_photo(&photo_context, &item);

        let outcome = match result {
            Ok(photo) => BuildOutcome::Success(Box::new(photo)),
            Err(error) => BuildOutcome::Failure {
                source_key: item.source_key,
                error: format!("{error:#}"),
            },
        };

        if outcomes.send(outcome).is_err() {
            break;
        }
    }
}

fn recommended_parallelism() -> usize {
    let available = std::thread::available_parallelism()
        .map(std::num::NonZero::get)
        .unwrap_or(1);
    let physical = num_cpus::get_physical();
    let baseline = match physical {
        0 => available,
        n => available.min(n),
    };

    (baseline / 2).clamp(1, 8)
}

fn recommended_avif_threads(worker_count: usize, total_jobs: usize) -> usize {
    let available = std::thread::available_parallelism()
        .map(std::num::NonZero::get)
        .unwrap_or(1);
    let enough_parallel_work = total_jobs > worker_count.max(2);

    if available >= 12 && enough_parallel_work {
        2
    } else {
        1
    }
}

fn recommended_full_res_parallelism(worker_count: usize) -> usize {
    match worker_count {
        0..=3 => 1,
        4 | 5 => 2,
        6 | 7 => 3,
        _ => 4,
    }
}

fn progress_style() -> Result<ProgressStyle> {
    ProgressStyle::with_template(
        "{spinner:.green} Building [{wide_bar:.cyan/blue}] {pos}/{len} · {msg}",
    )
    .map(|style| style.progress_chars("=>-"))
    .map_err(|error| anyhow!("failed to configure progress bar: {error}"))
}

fn create_build_progress(pending_count: usize) -> Result<ProgressBar> {
    if pending_count == 0 {
        return Ok(ProgressBar::hidden());
    }

    let progress = ProgressBar::new(pending_count as u64);
    progress.set_style(progress_style()?);
    progress.set_message("0 processing · 0 encoding AVIF");
    progress.enable_steady_tick(std::time::Duration::from_millis(120));
    Ok(progress)
}

struct BuildWorkerContext {
    config: Config,
    root_dir: PathBuf,
    originals_dir: PathBuf,
    thumbnails_dir: PathBuf,
    avif_threads: usize,
    full_res_limiter: FullResLimiter,
    status: BuildStatus,
    pending: Mutex<VecDeque<SourceItem>>,
}

#[derive(Default)]
struct BuildStatus {
    processing: AtomicUsize,
    encoding: AtomicUsize,
}

struct ScopedCounter<'a> {
    counter: &'a AtomicUsize,
}

impl<'a> ScopedCounter<'a> {
    fn new(counter: &'a AtomicUsize) -> Self {
        counter.fetch_add(1, Ordering::Relaxed);
        Self { counter }
    }
}

impl Drop for ScopedCounter<'_> {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::Relaxed);
    }
}

struct FullResLimiter {
    active: Mutex<usize>,
    wake: Condvar,
    limit: usize,
}

impl FullResLimiter {
    fn new(limit: usize) -> Self {
        Self {
            active: Mutex::new(0),
            wake: Condvar::new(),
            limit: limit.max(1),
        }
    }

    fn acquire(&self) -> FullResPermit<'_> {
        let mut active = self.active.lock().expect("full-res limiter poisoned");
        while *active >= self.limit {
            active = self
                .wake
                .wait(active)
                .expect("full-res limiter wait poisoned");
        }
        *active += 1;
        FullResPermit { limiter: self }
    }
}

struct FullResPermit<'a> {
    limiter: &'a FullResLimiter,
}

impl Drop for FullResPermit<'_> {
    fn drop(&mut self) {
        let mut active = self
            .limiter
            .active
            .lock()
            .expect("full-res limiter poisoned");
        *active = active.saturating_sub(1);
        self.limiter.wake.notify_one();
    }
}

// Source discovery and cache reuse

fn validate_path_isolation(source_dir: &Path, root_dir: &Path) -> Result<()> {
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

fn collect_selected_sources(source_dir: &Path, source_tags: &[String]) -> Result<Vec<SourceItem>> {
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

fn find_reusable_photo(
    root_dir: &Path,
    item: &SourceItem,
    previous_manifest: &LoadedManifest,
    previous_state: &StateFile,
) -> Option<(PhotoEntry, StateEntry)> {
    let state_entry = previous_state.files.get(&item.source_key)?;
    if state_entry.original.is_empty() {
        return None;
    }

    if state_entry.size != item.size || state_entry.mtime_ms != item.mtime_ms {
        return None;
    }

    let original_path = root_dir.join(&state_entry.original);
    if !original_path.exists() {
        return None;
    }

    let thumbnail_path = root_dir.join(&state_entry.thumbnail);
    if !thumbnail_path.exists() {
        return None;
    }

    let photo_entry = previous_manifest
        .photos_by_key
        .get(&state_entry.original)?
        .clone();

    Some((photo_entry, state_entry.clone()))
}

fn remove_stale_outputs(
    root_dir: &Path,
    current_keys: &BTreeSet<String>,
    previous_state: &StateFile,
) -> Result<()> {
    let canonical_root = fs::canonicalize(root_dir)
        .with_context(|| format!("failed to resolve target path {}", root_dir.display()))?;

    for (source_key, state_entry) in &previous_state.files {
        if current_keys.contains(source_key) {
            continue;
        }

        remove_output_if_exists(root_dir, &canonical_root, &state_entry.original)?;
        remove_output_if_exists(root_dir, &canonical_root, &state_entry.thumbnail)?;
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

fn build_photo(context: &PhotoBuildContext<'_>, item: &SourceItem) -> Result<BuiltPhoto> {
    let exif = read_exif(&item.path);
    let source_orientation = source_orientation(exif.as_ref());
    let original = build_original_asset(context, item, source_orientation)?;
    let thumbnail = build_thumbnail_asset(context, item, source_orientation, &original)?;
    let title = item
        .path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .ok_or_else(|| anyhow!("missing file stem for {}", item.path.display()))?;
    let extracted = extract_source_metadata(exif.as_ref(), Some(original.bit_depth));
    let original_key = original.asset.url.clone();
    let thumbnail_key = thumbnail.asset.url.clone();

    Ok(BuiltPhoto {
        state_key: item.source_key.clone(),
        state_entry: StateEntry {
            size: item.size,
            mtime_ms: item.mtime_ms,
            original: original_key,
            thumbnail: thumbnail_key,
            processed_at: now_rfc3339()?,
        },
        photo_entry: PhotoEntry {
            original: original.asset,
            thumbnail: thumbnail.asset,
            thumb_hash: thumbnail.thumb_hash,
            title,
            taken_at: extracted
                .taken_at
                .unwrap_or(timestamp_ms_rfc3339(item.mtime_ms)?),
            location: extracted.location,
            camera: extracted.camera.unwrap_or_default(),
            image: extracted.image,
        },
    })
}

fn build_original_asset(
    context: &PhotoBuildContext<'_>,
    item: &SourceItem,
    source_orientation: u8,
) -> Result<BuiltOriginal> {
    let output_path = build_original_path(context.originals_dir, &item.relative_path);
    create_parent_directory(&output_path)?;

    let (width, height, bit_depth, orientation_reference) = {
        let full_res_permit = context.full_res_limiter.acquire();
        let _processing_scope = ScopedCounter::new(&context.status.processing);
        let source_bytes = fs::read(&item.path)
            .with_context(|| format!("failed to read {}", item.path.display()))?;
        let mut loaded = decode_source_image(&item.path, &source_bytes)
            .with_context(|| format!("failed to decode {}", item.path.display()))?;
        drop(source_bytes);

        apply_source_orientation(&mut loaded.image, source_orientation);
        let (width, height) = loaded.image.dimensions();
        let bit_depth = loaded.bit_depth;
        let orientation_reference = if should_align_preview_orientation(&item.path) {
            Some(build_orientation_reference(&loaded.image)?)
        } else {
            None
        };

        {
            let _encoding_scope = ScopedCounter::new(&context.status.encoding);
            write_original_avif(
                &loaded,
                &output_path,
                context.config.avif_quality,
                context.config.avif_speed,
                context.avif_threads,
            )
            .with_context(|| format!("failed to write {}", output_path.display()))?;
        }
        drop(loaded);
        drop(full_res_permit);

        (width, height, bit_depth, orientation_reference)
    };

    let output_metadata = fs::metadata(&output_path)
        .with_context(|| format!("failed to read metadata for {}", output_path.display()))?;

    Ok(BuiltOriginal {
        asset: Asset {
            url: path_to_manifest_key(context.root_dir, &output_path)?,
            width,
            height,
            bytes: output_metadata.len(),
            mime: AVIF_MIME.to_string(),
        },
        bit_depth,
        orientation_reference,
    })
}

fn build_thumbnail_asset(
    context: &PhotoBuildContext<'_>,
    item: &SourceItem,
    source_orientation: u8,
    original: &BuiltOriginal,
) -> Result<BuiltThumbnail> {
    let output_path =
        build_thumbnail_path(context.thumbnails_dir, context.config, &item.relative_path);
    create_parent_directory(&output_path)?;

    let _processing_scope = ScopedCounter::new(&context.status.processing);
    let thumbnail_image = {
        let preview_width = original
            .asset
            .width
            .min(context.config.thumbnail_width)
            .max(1);
        let preview_image = build_preview_image(&item.path, preview_width, source_orientation)?;
        let preview_image = if let Some(reference) = original.orientation_reference.as_ref() {
            align_preview_orientation(preview_image, reference)?
        } else {
            preview_image
        };
        let thumbnail_image = resize_image(&preview_image, context.config.thumbnail_width)?;
        write_thumbnail(
            &thumbnail_image,
            &output_path,
            context.config.thumbnail_format,
            context.config.thumbnail_quality,
        )
        .with_context(|| format!("failed to write {}", output_path.display()))?;
        thumbnail_image
    };

    let output_metadata = fs::metadata(&output_path)
        .with_context(|| format!("failed to read metadata for {}", output_path.display()))?;
    let (width, height) = thumbnail_image.dimensions();

    Ok(BuiltThumbnail {
        asset: Asset {
            url: path_to_manifest_key(context.root_dir, &output_path)?,
            width,
            height,
            bytes: output_metadata.len(),
            mime: mime_from_format(context.config.thumbnail_format).to_string(),
        },
        thumb_hash: compute_thumb_hash(&thumbnail_image)?,
    })
}

// EXIF metadata

fn extract_source_metadata(exif: Option<&Exif>, bit_depth: Option<u8>) -> ExtractedMetadata {
    ExtractedMetadata {
        taken_at: exif.and_then(extract_taken_at),
        location: exif.and_then(extract_location),
        camera: exif.and_then(extract_camera),
        image: extract_image_metadata(exif, bit_depth),
    }
}

fn read_exif(path: &Path) -> Option<Exif> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) => {
            warn!("failed to open EXIF source {}: {error}", path.display());
            return None;
        }
    };
    let mut reader = std::io::BufReader::new(file);
    let mut exif_reader = ExifReader::new();
    exif_reader.continue_on_error(true);

    match exif_reader
        .read_from_container(&mut reader)
        .or_else(|error| {
            error.distill_partial_result(|errors| {
                for partial in errors {
                    warn!("partial EXIF parse for {}: {partial}", path.display());
                }
            })
        }) {
        Ok(exif) => Some(exif),
        Err(exif::Error::NotFound(_) | exif::Error::InvalidFormat(_)) => None,
        Err(error) => {
            warn!("failed to parse EXIF for {}: {error}", path.display());
            None
        }
    }
}

fn extract_taken_at(exif: &Exif) -> Option<String> {
    let (date_tag, subsec_tag, offset_tag) =
        if exif.get_field(Tag::DateTimeOriginal, In::PRIMARY).is_some() {
            (
                Tag::DateTimeOriginal,
                Tag::SubSecTimeOriginal,
                Tag::OffsetTimeOriginal,
            )
        } else if exif
            .get_field(Tag::DateTimeDigitized, In::PRIMARY)
            .is_some()
        {
            (
                Tag::DateTimeDigitized,
                Tag::SubSecTimeDigitized,
                Tag::OffsetTimeDigitized,
            )
        } else {
            (Tag::DateTime, Tag::SubSecTime, Tag::OffsetTime)
        };

    let mut datetime = ExifDateTime::from_ascii(exif_ascii(exif, date_tag)?).ok()?;

    if let Some(value) = exif_ascii(exif, subsec_tag) {
        let _ = datetime.parse_subsec(value);
    }

    if let Some(value) = exif_ascii(exif, offset_tag) {
        let _ = datetime.parse_offset(value);
    }

    Some(format_exif_datetime(&datetime))
}

fn extract_location(exif: &Exif) -> Option<Location> {
    let lat_values = rational_triplet(exif, Tag::GPSLatitude)?;
    let lng_values = rational_triplet(exif, Tag::GPSLongitude)?;
    let lat_ref = exif_text(exif, Tag::GPSLatitudeRef)?;
    let lng_ref = exif_text(exif, Tag::GPSLongitudeRef)?;

    let lat = signed_gps_coordinate(lat_values, &lat_ref)?;
    let lng = signed_gps_coordinate(lng_values, &lng_ref)?;
    let alt = rational_value(exif, Tag::GPSAltitude).map(|value| {
        let altitude_ref = exif_uint(exif, Tag::GPSAltitudeRef).unwrap_or(0);
        if altitude_ref == 1 { -value } else { value }
    });

    Some(Location { lat, lng, alt })
}

fn extract_camera(exif: &Exif) -> Option<Camera> {
    let camera = Camera {
        make: exif_text(exif, Tag::Make),
        model: exif_text(exif, Tag::Model),
        lens: exif_text(exif, Tag::LensModel).or_else(|| exif_text(exif, Tag::LensMake)),
        focal_length_mm: rational_value(exif, Tag::FocalLength).map(round_to_hundredths_f32),
        focal_length_in_35mm: exif_uint(exif, Tag::FocalLengthIn35mmFilm),
        aperture: rational_value(exif, Tag::FNumber).map(round_to_hundredths_f32),
        max_aperture: extract_max_aperture(exif),
        shutter: exif_display(exif, Tag::ExposureTime),
        iso: exif_uint(exif, Tag::PhotographicSensitivity)
            .or_else(|| exif_uint(exif, Tag::ISOSpeed)),
        exposure_program: exif_display(exif, Tag::ExposureProgram),
        exposure_mode: compact_exposure_mode(exif),
        metering_mode: exif_display(exif, Tag::MeteringMode),
        white_balance: compact_white_balance(exif),
        flash: compact_flash(exif),
        scene_capture_type: exif_display(exif, Tag::SceneCaptureType),
        brightness_ev: rational_value(exif, Tag::BrightnessValue).map(round_to_hundredths_f32),
        sensing_method: exif_display(exif, Tag::SensingMethod),
    };

    (!camera.is_empty()).then_some(camera)
}

fn extract_image_metadata(exif: Option<&Exif>, bit_depth: Option<u8>) -> ImageMetadata {
    let color_space = exif
        .and_then(|exif| exif_display(exif, Tag::ColorSpace))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Unspecified".to_string());

    ImageMetadata {
        orientation: 1,
        color_space,
        is_live_photo: false,
        bit_depth,
    }
}

fn exif_ascii(exif: &Exif, tag: Tag) -> Option<&[u8]> {
    match &exif.get_field(tag, In::PRIMARY)?.value {
        Value::Ascii(values) => values.first().map(Vec::as_slice),
        _ => None,
    }
}

fn exif_text(exif: &Exif, tag: Tag) -> Option<String> {
    let raw = exif_ascii(exif, tag)?;
    let text = String::from_utf8_lossy(raw)
        .trim_matches('\0')
        .trim()
        .to_string();

    (!text.is_empty()).then_some(text)
}

fn exif_display(exif: &Exif, tag: Tag) -> Option<String> {
    let text = exif
        .get_field(tag, In::PRIMARY)?
        .display_value()
        .to_string();
    let text = text.trim();
    (!text.is_empty() && text != "unknown").then(|| text.to_string())
}

fn exif_uint(exif: &Exif, tag: Tag) -> Option<u32> {
    exif.get_field(tag, In::PRIMARY)?.value.get_uint(0)
}

fn extract_max_aperture(exif: &Exif) -> Option<f32> {
    exif_apex_aperture(exif, Tag::MaxApertureValue)
        .or_else(|| lens_specification_max_aperture(exif))
        .map(round_to_hundredths_f32)
}

fn compact_exposure_mode(exif: &Exif) -> Option<String> {
    if let Some(value) = exif_uint(exif, Tag::ExposureMode) {
        return match value {
            0 => Some("auto".to_string()),
            1 => Some("manual".to_string()),
            2 => Some("bracket".to_string()),
            _ => None,
        };
    }

    exif_display(exif, Tag::ExposureMode).and_then(|value| {
        let normalized = value.to_ascii_lowercase();
        if normalized.contains("manual") {
            Some("manual".to_string())
        } else if normalized.contains("bracket") {
            Some("bracket".to_string())
        } else if normalized.contains("auto") {
            Some("auto".to_string())
        } else {
            None
        }
    })
}

fn compact_white_balance(exif: &Exif) -> Option<String> {
    if let Some(value) = exif_uint(exif, Tag::WhiteBalance) {
        return match value {
            0 => Some("auto".to_string()),
            1 => Some("manual".to_string()),
            _ => None,
        };
    }

    exif_display(exif, Tag::WhiteBalance).and_then(|value| {
        let normalized = value.to_ascii_lowercase();
        if normalized.contains("manual") {
            Some("manual".to_string())
        } else if normalized.contains("auto") {
            Some("auto".to_string())
        } else {
            None
        }
    })
}

fn compact_flash(exif: &Exif) -> Option<String> {
    if let Some(value) = exif_uint(exif, Tag::Flash) {
        let no_function = value & 0x20 != 0;
        let red_eye = value & 0x40 != 0;
        let fired = value & 0x01 != 0;
        let mode = value & 0x18;

        let label = if no_function {
            "unsupported"
        } else if mode == 0x18 && fired {
            "auto-fired"
        } else if mode == 0x18 {
            "auto"
        } else if red_eye && fired {
            "red-eye"
        } else if mode == 0x10 {
            "off"
        } else if fired || mode == 0x08 {
            "on"
        } else {
            "off"
        };

        return Some(label.to_string());
    }

    exif_display(exif, Tag::Flash).and_then(|value| {
        let normalized = value.to_ascii_lowercase();
        if normalized.contains("no flash function") {
            Some("unsupported".to_string())
        } else if normalized.contains("red-eye") {
            Some("red-eye".to_string())
        } else if normalized.contains("auto") && normalized.contains("fired") {
            Some("auto-fired".to_string())
        } else if normalized.contains("auto") {
            Some("auto".to_string())
        } else if normalized.contains("not fired") || normalized.contains("suppressed") {
            Some("off".to_string())
        } else if normalized.contains("fired") {
            Some("on".to_string())
        } else {
            None
        }
    })
}

fn exif_apex_aperture(exif: &Exif, tag: Tag) -> Option<f64> {
    let apex = rational_value(exif, tag)?;
    let aperture = 2_f64.powf(apex / 2.0);
    (aperture.is_finite() && aperture > 0.0).then_some(aperture)
}

fn lens_specification_max_aperture(exif: &Exif) -> Option<f64> {
    match &exif.get_field(Tag::LensSpecification, In::PRIMARY)?.value {
        Value::Rational(values) if values.len() >= 4 => [values[2].to_f64(), values[3].to_f64()]
            .into_iter()
            .filter(|value| value.is_finite() && *value > 0.0)
            .reduce(f64::min),
        _ => None,
    }
}

fn rational_value(exif: &Exif, tag: Tag) -> Option<f64> {
    let value = match &exif.get_field(tag, In::PRIMARY)?.value {
        Value::Rational(values) => values.first().map(exif::Rational::to_f64),
        Value::SRational(values) => values.first().map(exif::SRational::to_f64),
        _ => None,
    }?;

    value.is_finite().then_some(value)
}

fn rational_triplet(exif: &Exif, tag: Tag) -> Option<[f64; 3]> {
    let values = match &exif.get_field(tag, In::PRIMARY)?.value {
        Value::Rational(values) if values.len() >= 3 => {
            [values[0].to_f64(), values[1].to_f64(), values[2].to_f64()]
        }
        _ => return None,
    };

    values
        .iter()
        .all(|value| value.is_finite())
        .then_some(values)
}

fn signed_gps_coordinate(parts: [f64; 3], direction: &str) -> Option<f64> {
    let mut value = parts[0] + (parts[1] / 60.0) + (parts[2] / 3600.0);
    match direction.trim().to_ascii_uppercase().as_str() {
        "N" | "E" => Some(value),
        "S" | "W" => {
            value = -value;
            Some(value)
        }
        _ => None,
    }
}

fn format_exif_datetime(datetime: &ExifDateTime) -> String {
    let mut formatted = format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        datetime.year,
        datetime.month,
        datetime.day,
        datetime.hour,
        datetime.minute,
        datetime.second
    );

    if let Some(nanos) = datetime.nanosecond {
        let mut fraction = format!("{nanos:09}");
        while fraction.ends_with('0') {
            fraction.pop();
        }
        if !fraction.is_empty() {
            formatted.push('.');
            formatted.push_str(&fraction);
        }
    }

    if let Some(offset_minutes) = datetime.offset {
        let sign = if offset_minutes >= 0 { '+' } else { '-' };
        let total = offset_minutes.unsigned_abs();
        let hours = total / 60;
        let minutes = total % 60;
        formatted.push(sign);
        let _ = write!(&mut formatted, "{hours:02}:{minutes:02}");
    }

    formatted
}

#[allow(
    clippy::cast_possible_truncation,
    reason = "camera metadata is intentionally stored as rounded f32 values"
)]
fn round_to_hundredths_f32(value: f64) -> f32 {
    ((value * 100.0).round() / 100.0) as f32
}

// Image decoding, resizing, and encoding

fn resize_image(image: &DynamicImage, target_width: u32) -> Result<DynamicImage> {
    let width = image.width();
    if width <= target_width {
        return Ok(image.clone());
    }

    resize_to_dimensions(
        image,
        target_width,
        scaled_dimension(image.height(), target_width, width),
    )
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

fn decode_source_image(path: &Path, bytes: &[u8]) -> Result<LoadedImage> {
    if is_heif_family(path) {
        return decode_heif_image(path, bytes);
    }

    let image = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .with_context(|| format!("failed to guess image format for {}", path.display()))?
        .decode()
        .with_context(|| format!("failed to decode {}", path.display()))?;

    Ok(LoadedImage {
        bit_depth: inferred_bit_depth(&image),
        has_alpha: image.has_alpha(),
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
    let hdr = bit_depth > 8;
    let little_endian = cfg!(target_endian = "little");
    let color_space = match (hdr, has_alpha, little_endian) {
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

    if hdr {
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
                        anyhow!("failed to construct HDR RGBA image {}", path.display())
                    })?;
            DynamicImage::ImageRgba16(rgba)
        } else {
            let rgb =
                ImageBuffer::<Rgb<u16>, Vec<u16>>::from_raw(plane.width, plane.height, pixels)
                    .ok_or_else(|| {
                        anyhow!("failed to construct HDR RGB image {}", path.display())
                    })?;
            DynamicImage::ImageRgb16(rgb)
        };

        return Ok(LoadedImage {
            image,
            bit_depth,
            has_alpha,
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
    })
}

fn write_original_avif(
    loaded: &LoadedImage,
    path: &Path,
    avif_quality: u8,
    avif_speed: u8,
    avif_threads: usize,
) -> Result<()> {
    let avif_file = if loaded.bit_depth > 8 {
        encode_10_bit_avif(loaded, avif_quality, avif_speed, avif_threads)?
    } else {
        encode_8_bit_avif(loaded, avif_quality, avif_speed, avif_threads)?
    };

    write_bytes_atomic(path, &avif_file)
}

fn encode_10_bit_avif(
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

fn encode_8_bit_avif(
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

fn write_thumbnail(
    image: &DynamicImage,
    path: &Path,
    format: ThumbnailFormat,
    quality: u8,
) -> Result<()> {
    let bytes = match format {
        ThumbnailFormat::Jpeg => {
            let mut bytes = Vec::new();
            let rgb = image.to_rgb8();
            let mut encoder = JpegEncoder::new_with_quality(&mut bytes, quality);
            encoder.encode(&rgb, rgb.width(), rgb.height(), ColorType::Rgb8.into())?;
            bytes
        }
        ThumbnailFormat::Png => {
            let mut cursor = Cursor::new(Vec::new());
            image.write_to(&mut cursor, ImageFormat::Png)?;
            cursor.into_inner()
        }
        ThumbnailFormat::Webp => {
            let rgba = image.to_rgba8();
            let encoder = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height());
            encoder
                .encode(f32::from(quality).clamp(1.0, 100.0))
                .to_vec()
        }
    };

    write_bytes_atomic(path, &bytes)
}

fn compute_thumb_hash(image: &DynamicImage) -> Result<String> {
    let reduced =
        resize_to_fit(image, THUMBHASH_MAX_DIMENSION, THUMBHASH_MAX_DIMENSION)?.to_rgba8();
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
    source_orientation: u8,
) -> Result<DynamicImage> {
    if cfg!(target_os = "macos") {
        match build_preview_image_with_sips(source_path, target_width.max(1)) {
            Ok(image) => return Ok(image),
            Err(error) => warn!(
                "failed to build preview with sips for {}: {error:#}; falling back to internal preview pipeline",
                source_path.display()
            ),
        }
    }

    let source_bytes = fs::read(source_path)
        .with_context(|| format!("failed to read preview source {}", source_path.display()))?;
    let mut loaded = decode_source_image(source_path, &source_bytes)
        .with_context(|| format!("failed to decode preview source {}", source_path.display()))?;
    apply_source_orientation(&mut loaded.image, source_orientation);
    build_internal_preview(&loaded)
}

fn should_align_preview_orientation(source_path: &Path) -> bool {
    !is_heif_family(source_path)
}

fn build_orientation_reference(reference_image: &DynamicImage) -> Result<OrientationReference> {
    let (canvas_width, canvas_height) =
        orientation_compare_dimensions(reference_image.width(), reference_image.height());
    let probe = normalize_orientation_compare_image(reference_image, canvas_width, canvas_height)?
        .to_rgb8();

    Ok(OrientationReference {
        canvas_width,
        canvas_height,
        probe,
    })
}

fn align_preview_orientation(
    preview_image: DynamicImage,
    reference: &OrientationReference,
) -> Result<DynamicImage> {
    let transform = best_orientation_transform(&preview_image, reference)?;
    Ok(apply_orientation_transform(preview_image, transform))
}

fn best_orientation_transform(
    preview_image: &DynamicImage,
    reference: &OrientationReference,
) -> Result<OrientationTransform> {
    let preview_probe = resize_to_fit(
        preview_image,
        PREVIEW_ORIENTATION_COMPARE_SIZE,
        PREVIEW_ORIENTATION_COMPARE_SIZE,
    )?;
    let mut best: Option<(u64, OrientationTransform)> = None;

    for transform in OrientationTransform::ALL {
        let candidate = apply_orientation_transform(preview_probe.clone(), transform);
        let score = orientation_similarity_score(
            &candidate,
            &reference.probe,
            reference.canvas_width,
            reference.canvas_height,
        )?;
        if score == 0 {
            return Ok(transform);
        }

        let replace = match best {
            Some((best_score, _)) => score < best_score,
            None => true,
        };

        if replace {
            best = Some((score, transform));
        }
    }

    best.map(|(_, transform)| transform)
        .ok_or_else(|| anyhow!("failed to select preview orientation"))
}

fn orientation_similarity_score(
    candidate: &DynamicImage,
    reference: &image::RgbImage,
    canvas_width: u32,
    canvas_height: u32,
) -> Result<u64> {
    let candidate =
        normalize_orientation_compare_image(candidate, canvas_width, canvas_height)?.to_rgb8();

    Ok(candidate
        .pixels()
        .zip(reference.pixels())
        .map(|(left, right)| {
            left.0
                .iter()
                .zip(right.0.iter())
                .map(|(l, r)| u64::from(u8::abs_diff(*l, *r)))
                .sum::<u64>()
        })
        .sum())
}

fn normalize_orientation_compare_image(
    image: &DynamicImage,
    canvas_width: u32,
    canvas_height: u32,
) -> Result<DynamicImage> {
    let resized = resize_to_fit(image, canvas_width, canvas_height)?.to_rgba8();
    let mut canvas = ImageBuffer::<Rgba<u8>, Vec<u8>>::new(canvas_width, canvas_height);
    let offset_x = i64::from((canvas_width - resized.width()) / 2);
    let offset_y = i64::from((canvas_height - resized.height()) / 2);
    imageops::overlay(&mut canvas, &resized, offset_x, offset_y);
    Ok(DynamicImage::ImageRgba8(canvas))
}

fn orientation_compare_dimensions(width: u32, height: u32) -> (u32, u32) {
    let longest = width.max(height).max(1);
    (
        scaled_dimension(width, PREVIEW_ORIENTATION_COMPARE_SIZE, longest),
        scaled_dimension(height, PREVIEW_ORIENTATION_COMPARE_SIZE, longest),
    )
}

#[derive(Clone, Copy)]
enum OrientationTransform {
    Identity,
    Rotate90,
    Rotate180,
    Rotate270,
    FlipH,
    FlipHRotate90,
    FlipHRotate180,
    FlipHRotate270,
}

struct OrientationReference {
    canvas_width: u32,
    canvas_height: u32,
    probe: image::RgbImage,
}

impl OrientationTransform {
    const ALL: [Self; 8] = [
        Self::Identity,
        Self::Rotate90,
        Self::Rotate180,
        Self::Rotate270,
        Self::FlipH,
        Self::FlipHRotate90,
        Self::FlipHRotate180,
        Self::FlipHRotate270,
    ];
}

fn apply_orientation_transform(
    image: DynamicImage,
    transform: OrientationTransform,
) -> DynamicImage {
    match transform {
        OrientationTransform::Identity => image,
        OrientationTransform::Rotate90 => image.rotate90(),
        OrientationTransform::Rotate180 => image.rotate180(),
        OrientationTransform::Rotate270 => image.rotate270(),
        OrientationTransform::FlipH => image.fliph(),
        OrientationTransform::FlipHRotate90 => image.fliph().rotate90(),
        OrientationTransform::FlipHRotate180 => image.fliph().rotate180(),
        OrientationTransform::FlipHRotate270 => image.fliph().rotate270(),
    }
}

fn build_internal_preview(loaded: &LoadedImage) -> Result<DynamicImage> {
    if loaded.bit_depth <= 8 {
        if loaded.has_alpha {
            return Ok(DynamicImage::ImageRgba8(loaded.image.to_rgba8()));
        }

        return Ok(DynamicImage::ImageRgb8(loaded.image.to_rgb8()));
    }

    let source_bit_depth = loaded.bit_depth.clamp(9, 16);
    if loaded.has_alpha {
        let rgba16 = loaded.image.to_rgba16();
        let pixels = rgba16
            .pixels()
            .flat_map(|pixel| {
                pixel
                    .0
                    .iter()
                    .map(|component| map_preview_sample_to_8_bit(*component, source_bit_depth))
            })
            .collect::<Vec<_>>();

        let buffer =
            ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(rgba16.width(), rgba16.height(), pixels)
                .ok_or_else(|| anyhow!("failed to build preview RGBA image buffer"))?;

        return Ok(DynamicImage::ImageRgba8(buffer));
    }

    let rgb16 = loaded.image.to_rgb16();
    let pixels = rgb16
        .pixels()
        .flat_map(|pixel| {
            pixel
                .0
                .iter()
                .map(|component| map_preview_sample_to_8_bit(*component, source_bit_depth))
        })
        .collect::<Vec<_>>();
    let buffer = ImageBuffer::<Rgb<u8>, Vec<u8>>::from_raw(rgb16.width(), rgb16.height(), pixels)
        .ok_or_else(|| anyhow!("failed to build preview RGB image buffer"))?;

    Ok(DynamicImage::ImageRgb8(buffer))
}

fn build_preview_image_with_sips(source_path: &Path, target_width: u32) -> Result<DynamicImage> {
    let color_handling = if is_heif_family(source_path) {
        SipsColorHandling::Preserve
    } else {
        SipsColorHandling::OptimizeForSharing
    };

    run_sips_preview(source_path, target_width, color_handling)
}

fn run_sips_preview(
    source_path: &Path,
    target_width: u32,
    color_handling: SipsColorHandling,
) -> Result<DynamicImage> {
    let temp_dir = tempfile::Builder::new()
        .prefix("lumine-pipeline-preview-")
        .tempdir()
        .context("failed to create temporary preview directory")?;
    let resized_path = temp_dir.path().join("resized.png");
    let preview_path = temp_dir.path().join("preview.png");
    let resize_path = if color_handling == SipsColorHandling::OptimizeForSharing {
        &resized_path
    } else {
        &preview_path
    };
    let resize_output = Command::new("sips")
        .arg("--resampleWidth")
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

    if color_handling == SipsColorHandling::OptimizeForSharing {
        let optimize_output = Command::new("sips")
            .arg("--optimizeColorForSharing")
            .arg(&resized_path)
            .arg("--out")
            .arg(&preview_path)
            .output()
            .with_context(|| format!("failed to launch sips for {}", source_path.display()))?;
        ensure_sips_succeeded(&optimize_output, source_path, "color optimization")?;
    }

    let image = ImageReader::open(&preview_path)
        .with_context(|| format!("failed to open preview {}", preview_path.display()))?
        .with_guessed_format()
        .with_context(|| {
            format!(
                "failed to guess preview format for {}",
                preview_path.display()
            )
        })?
        .decode()
        .with_context(|| format!("failed to decode preview {}", preview_path.display()))?;

    if image.width() != target_width {
        bail!(
            "sips returned unexpected preview width for {}: expected {target_width}, got {}x{}",
            source_path.display(),
            image.width(),
            image.height()
        );
    }

    Ok(image)
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

fn source_orientation(exif: Option<&Exif>) -> u8 {
    exif.and_then(|exif| exif_uint(exif, Tag::Orientation))
        .and_then(|value| u8::try_from(value).ok())
        .unwrap_or(1)
}

fn apply_source_orientation(image: &mut DynamicImage, source_orientation: u8) {
    if let Some(orientation) = Orientation::from_exif(source_orientation) {
        image.apply_orientation(orientation);
    }
}

// Output paths and persistence

fn build_original_path(originals_dir: &Path, relative_source: &Path) -> PathBuf {
    let mut path = originals_dir.join(relative_source);
    path.set_extension(AVIF_EXTENSION);
    path
}

fn build_thumbnail_path(thumbnails_dir: &Path, config: &Config, relative_source: &Path) -> PathBuf {
    let mut path = thumbnails_dir.join(relative_source);
    path.set_extension(config.thumbnail_format.extension());
    path
}

fn create_parent_directory(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    Ok(())
}

fn load_previous_manifest(path: &Path) -> Result<LoadedManifest> {
    if !path.exists() {
        return Ok(LoadedManifest::default());
    }

    let file = File::open(path)
        .with_context(|| format!("failed to open previous manifest {}", path.display()))?;
    let manifest_json: serde_json::Value = serde_json::from_reader(file)
        .with_context(|| format!("failed to parse previous manifest {}", path.display()))?;
    let version = manifest_json
        .get("version")
        .and_then(serde_json::Value::as_u64);

    if version != Some(u64::from(MANIFEST_VERSION)) {
        warn!(
            "ignoring manifest version {}; rebuilding for version {MANIFEST_VERSION}",
            version.map_or_else(|| "unknown".to_string(), |value| value.to_string())
        );
        return Ok(LoadedManifest::default());
    }

    let manifest: ManifestFile = serde_json::from_value(manifest_json)
        .with_context(|| format!("failed to validate previous manifest {}", path.display()))?;
    let photos_by_key = manifest
        .photos
        .into_iter()
        .map(|photo| (photo.original.url.clone(), photo))
        .collect();

    Ok(LoadedManifest { photos_by_key })
}

fn load_previous_state(path: &Path) -> Result<StateFile> {
    if !path.exists() {
        return Ok(StateFile {
            updated_at: String::new(),
            files: BTreeMap::new(),
        });
    }

    let file = File::open(path)
        .with_context(|| format!("failed to open previous state {}", path.display()))?;
    let state: StateFile = serde_json::from_reader(file)
        .with_context(|| format!("failed to parse previous state {}", path.display()))?;
    Ok(state)
}

fn write_build_checkpoint(
    config: &Config,
    photos: &BTreeMap<String, PhotoEntry>,
    files: &BTreeMap<String, StateEntry>,
) -> Result<()> {
    let now = now_rfc3339()?;

    write_json(
        &config.manifest_path(),
        &ManifestFileRef {
            version: MANIFEST_VERSION,
            updated_at: now.clone(),
            photos: photos.values().collect(),
        },
    )?;
    write_json(
        &config.state_path(),
        &StateFileRef {
            updated_at: now,
            files,
        },
    )?;

    Ok(())
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
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

fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
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

// Shared value conversions

fn metadata_mtime_ms(metadata: &fs::Metadata) -> Result<u64> {
    let modified = metadata.modified()?;
    let duration = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| anyhow!("invalid file mtime: {error}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| anyhow!("file mtime is too large"))
}

fn now_rfc3339() -> Result<String> {
    Ok(OffsetDateTime::now_utc().format(&Rfc3339)?)
}

fn timestamp_ms_rfc3339(epoch_milliseconds: u64) -> Result<String> {
    let nanoseconds = i128::from(epoch_milliseconds) * 1_000_000;
    Ok(OffsetDateTime::from_unix_timestamp_nanos(nanoseconds)?.format(&Rfc3339)?)
}

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

#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss,
    reason = "sample values are clamped to the target 8-bit range before conversion"
)]
fn map_preview_sample_to_8_bit(value: u16, source_bit_depth: u8) -> u8 {
    let source_bit_depth = source_bit_depth.clamp(1, 16);
    let source_max = ((1u32 << source_bit_depth) - 1).max(1);
    let normalized = (u32::from(value).min(source_max) as f32 / source_max as f32).clamp(0.0, 1.0);
    let gamma_mapped = normalized.powf(1.0 / 2.2);
    (gamma_mapped * 255.0).round().clamp(0.0, 255.0) as u8
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

fn path_to_manifest_key(base_dir: &Path, path: &Path) -> Result<String> {
    let relative = path
        .strip_prefix(base_dir)
        .with_context(|| format!("failed to strip prefix from {}", path.display()))?;

    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/"))
}

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            let ext = extension.to_ascii_lowercase();
            SUPPORTED_EXTENSIONS.contains(&ext.as_str())
        })
}

fn is_heif_family(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("hif")
                || extension.eq_ignore_ascii_case("heif")
                || extension.eq_ignore_ascii_case("heic")
        })
}

fn mime_from_format(format: ThumbnailFormat) -> &'static str {
    match format {
        ThumbnailFormat::Jpeg => "image/jpeg",
        ThumbnailFormat::Png => "image/png",
        ThumbnailFormat::Webp => "image/webp",
    }
}

// Data model

struct SourceItem {
    path: PathBuf,
    relative_path: PathBuf,
    source_key: String,
    size: u64,
    mtime_ms: u64,
}

struct LoadedImage {
    image: DynamicImage,
    bit_depth: u8,
    has_alpha: bool,
}

struct BuiltOriginal {
    asset: Asset,
    bit_depth: u8,
    orientation_reference: Option<OrientationReference>,
}

struct BuiltThumbnail {
    asset: Asset,
    thumb_hash: String,
}

struct PhotoBuildContext<'a> {
    config: &'a Config,
    root_dir: &'a Path,
    originals_dir: &'a Path,
    thumbnails_dir: &'a Path,
    avif_threads: usize,
    full_res_limiter: &'a FullResLimiter,
    status: &'a BuildStatus,
}

struct BuiltPhoto {
    state_key: String,
    state_entry: StateEntry,
    photo_entry: PhotoEntry,
}

enum BuildOutcome {
    Success(Box<BuiltPhoto>),
    Failure { source_key: String, error: String },
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SipsColorHandling {
    Preserve,
    OptimizeForSharing,
}

struct ExtractedMetadata {
    taken_at: Option<String>,
    location: Option<Location>,
    camera: Option<Camera>,
    image: ImageMetadata,
}

#[derive(Default)]
struct LoadedManifest {
    photos_by_key: BTreeMap<String, PhotoEntry>,
}

#[derive(Deserialize, Serialize)]
struct ManifestFile {
    version: u8,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    photos: Vec<PhotoEntry>,
}

#[derive(Serialize)]
struct ManifestFileRef<'a> {
    version: u8,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    photos: Vec<&'a PhotoEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
struct PhotoEntry {
    original: Asset,
    thumbnail: Asset,
    #[serde(rename = "thumbHash")]
    thumb_hash: String,
    title: String,
    #[serde(rename = "takenAt")]
    taken_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<Location>,
    camera: Camera,
    image: ImageMetadata,
}

#[derive(Clone, Deserialize, Serialize)]
struct Asset {
    url: String,
    width: u32,
    height: u32,
    bytes: u64,
    mime: String,
}

#[derive(Deserialize, Serialize)]
struct StateFile {
    #[serde(rename = "updatedAt")]
    updated_at: String,
    files: BTreeMap<String, StateEntry>,
}

#[derive(Serialize)]
struct StateFileRef<'a> {
    #[serde(rename = "updatedAt")]
    updated_at: String,
    files: &'a BTreeMap<String, StateEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
struct StateEntry {
    size: u64,
    #[serde(rename = "mtimeMs")]
    mtime_ms: u64,
    #[serde(default)]
    original: String,
    thumbnail: String,
    #[serde(rename = "processedAt")]
    processed_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct Location {
    lat: f64,
    lng: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    alt: Option<f64>,
}

#[derive(Clone, Default, Deserialize, Serialize)]
struct Camera {
    #[serde(skip_serializing_if = "Option::is_none")]
    make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    lens: Option<String>,
    #[serde(rename = "focalLengthMm", skip_serializing_if = "Option::is_none")]
    focal_length_mm: Option<f32>,
    #[serde(rename = "focalLengthIn35mm", skip_serializing_if = "Option::is_none")]
    focal_length_in_35mm: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    aperture: Option<f32>,
    #[serde(rename = "maxAperture", skip_serializing_if = "Option::is_none")]
    max_aperture: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    shutter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    iso: Option<u32>,
    #[serde(rename = "exposureProgram", skip_serializing_if = "Option::is_none")]
    exposure_program: Option<String>,
    #[serde(rename = "exposureMode", skip_serializing_if = "Option::is_none")]
    exposure_mode: Option<String>,
    #[serde(rename = "meteringMode", skip_serializing_if = "Option::is_none")]
    metering_mode: Option<String>,
    #[serde(rename = "whiteBalance", skip_serializing_if = "Option::is_none")]
    white_balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    flash: Option<String>,
    #[serde(rename = "sceneCaptureType", skip_serializing_if = "Option::is_none")]
    scene_capture_type: Option<String>,
    #[serde(rename = "brightnessEv", skip_serializing_if = "Option::is_none")]
    brightness_ev: Option<f32>,
    #[serde(rename = "sensingMethod", skip_serializing_if = "Option::is_none")]
    sensing_method: Option<String>,
}

impl Camera {
    fn is_empty(&self) -> bool {
        self.make.is_none()
            && self.model.is_none()
            && self.lens.is_none()
            && self.focal_length_mm.is_none()
            && self.focal_length_in_35mm.is_none()
            && self.aperture.is_none()
            && self.max_aperture.is_none()
            && self.shutter.is_none()
            && self.iso.is_none()
            && self.exposure_program.is_none()
            && self.exposure_mode.is_none()
            && self.metering_mode.is_none()
            && self.white_balance.is_none()
            && self.flash.is_none()
            && self.scene_capture_type.is_none()
            && self.brightness_ev.is_none()
            && self.sensing_method.is_none()
    }
}

#[derive(Clone, Deserialize, Serialize)]
struct ImageMetadata {
    orientation: u8,
    #[serde(rename = "colorSpace")]
    color_space: String,
    #[serde(rename = "isLivePhoto")]
    is_live_photo: bool,
    #[serde(rename = "bitDepth", skip_serializing_if = "Option::is_none")]
    bit_depth: Option<u8>,
}
