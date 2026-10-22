mod avif;
mod catalog;
mod metadata;
mod sony;
mod source;
mod storage;
mod thumbnail;

use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc, Condvar, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

use anyhow::{Context, Result, anyhow, bail};
use indicatif::{ProgressBar, ProgressState, ProgressStyle};
use tracing::warn;

use crate::config::{Config, ThumbnailFormat, Visibility};
use avif::{AVIF_MIME, read_existing_original};
use catalog::{
    Asset, LoadedManifest, PhotoEntry, StateEntry, StateFile, load_previous_manifest,
    load_previous_state, write_build_checkpoint,
};
use metadata::{extract_source_metadata, read_exif, source_orientation, timestamp_ms_rfc3339};
use source::{
    SourceInfo, SourceItem, collect_selected_sources, metadata_mtime_ms, read_source_info,
};
use storage::{
    build_original_path, build_thumbnail_path, create_parent_directory, path_to_manifest_key,
    remove_stale_outputs, validate_path_isolation,
};
use thumbnail::{BuiltThumbnail, mime_from_format, read_existing_thumbnail};

const CHECKPOINT_BATCH_MIN: usize = 8;

// Build orchestration and concurrency

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BuildExit {
    Success,
    PartialFailure,
}

struct BuildPlan {
    root_dir: PathBuf,
    trees: ByVisibility<OutputTree>,
    total: usize,
    workers: usize,
    avif_threads: usize,
    full_res_parallelism: usize,
    checkpoint_interval: usize,
    photos: ByVisibility<BTreeMap<String, PhotoEntry>>,
    files: BTreeMap<String, StateEntry>,
    pending: Vec<PhotoBuildItem>,
    reused: usize,
    relocated: usize,
    selected: ByVisibility<usize>,
    current_keys: BTreeSet<String>,
    expected_outputs: BTreeSet<String>,
}

impl BuildPlan {
    fn write_checkpoint(&self, config: &Config) -> Result<()> {
        let manifests = Visibility::ALL.map(|visibility| {
            (
                self.trees.get(visibility).manifest.as_path(),
                self.photos.get(visibility),
            )
        });
        write_build_checkpoint(&manifests, &config.state_path(), &self.files)
    }

    fn output_dirs(&self) -> Vec<&Path> {
        Visibility::ALL
            .into_iter()
            .flat_map(|visibility| {
                let tree = self.trees.get(visibility);
                [tree.originals.as_path(), tree.thumbnails.as_path()]
            })
            .collect()
    }
}

/// Output paths of one visibility. Manifest asset URLs are relative to `root`,
/// so a photo keeps the same URL path when it moves between trees.
struct OutputTree {
    root: PathBuf,
    originals: PathBuf,
    thumbnails: PathBuf,
    manifest: PathBuf,
}

impl OutputTree {
    fn new(config: &Config, visibility: Visibility) -> Self {
        Self {
            root: config.tree_path(visibility),
            originals: config.originals_path(visibility),
            thumbnails: config.thumbnails_path(visibility),
            manifest: config.manifest_path(visibility),
        }
    }

    fn original_path(&self, relative_source: &Path) -> PathBuf {
        build_original_path(&self.originals, relative_source)
    }

    fn thumbnail_path(&self, format: ThumbnailFormat, relative_source: &Path) -> PathBuf {
        build_thumbnail_path(&self.thumbnails, format, relative_source)
    }
}

#[derive(Default)]
struct ByVisibility<T> {
    public: T,
    private: T,
}

impl<T> ByVisibility<T> {
    fn get(&self, visibility: Visibility) -> &T {
        match visibility {
            Visibility::Public => &self.public,
            Visibility::Private => &self.private,
        }
    }

    fn get_mut(&mut self, visibility: Visibility) -> &mut T {
        match visibility {
            Visibility::Public => &mut self.public,
            Visibility::Private => &mut self.private,
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct BuildSummary {
    processed: usize,
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
    thumbnail::validate_runtime()?;
    let started_at = Instant::now();
    let mut plan = prepare_build_plan(&config)?;

    print_build_start(&config, &plan);
    let progress = create_build_progress(plan.pending.len())?;

    let summary = execute_build(&config, &progress, &mut plan)?;
    if summary.failed == 0 {
        let previous_count = plan.files.len();
        plan.files.retain(|key, _| plan.current_keys.contains(key));
        if summary.processed == 0 || plan.files.len() != previous_count {
            plan.write_checkpoint(&config)?;
        }
        remove_stale_outputs(&plan.root_dir, &plan.output_dirs(), &plan.expected_outputs)?;
    }
    progress.finish_and_clear();

    let elapsed = format_elapsed(started_at.elapsed());
    if summary.processed == 0 && summary.failed == 0 {
        println!("Up to date · {elapsed} · {} reused", summary.reused);
    } else {
        let status = if summary.failed == 0 {
            "Completed"
        } else {
            "Completed with errors"
        };
        print!(
            "{status} · {elapsed} · {} processed · {} reused",
            summary.processed, summary.reused
        );
        if summary.failed > 0 {
            print!(" · {} failed", summary.failed);
        }
        println!();
    }

    Ok(summary.exit_status())
}

fn prepare_build_plan(config: &Config) -> Result<BuildPlan> {
    let source_dir = config.source_path();
    let root_dir = config.root_dir();
    let trees = ByVisibility {
        public: OutputTree::new(config, Visibility::Public),
        private: OutputTree::new(config, Visibility::Private),
    };

    let source_metadata = fs::metadata(&source_dir)
        .with_context(|| format!("failed to access source directory {}", source_dir.display()))?;
    if !source_metadata.is_dir() {
        bail!("source path is not a directory: {}", source_dir.display());
    }

    validate_path_isolation(&source_dir, &root_dir)?;
    for visibility in Visibility::ALL {
        let tree = trees.get(visibility);
        for (label, directory) in [
            ("originals", &tree.originals),
            ("thumbnails", &tree.thumbnails),
        ] {
            fs::create_dir_all(directory).with_context(|| {
                format!("failed to create {label} directory {}", directory.display())
            })?;
        }
    }

    let mut sources = collect_selected_sources(
        &source_dir,
        config.tags(Visibility::Public),
        config.tags(Visibility::Private),
    )?;
    sources.sort_by(|left, right| left.source_key.cmp(&right.source_key));

    let previous_manifests = ByVisibility {
        public: load_previous_manifest(&trees.public.manifest)?,
        private: load_previous_manifest(&trees.private.manifest)?,
    };
    let previous_state = load_previous_state(&config.state_path())?;
    let current_keys: BTreeSet<_> = sources.iter().map(|item| item.source_key.clone()).collect();
    let mut expected_outputs = BTreeSet::new();
    let mut asset_urls = BTreeSet::new();
    let mut selected = ByVisibility::default();
    for source in &sources {
        *selected.get_mut(source.visibility) += 1;
        let tree = trees.get(source.visibility);
        for path in [
            tree.original_path(&source.relative_path),
            tree.thumbnail_path(config.thumbnail_format, &source.relative_path),
        ] {
            expected_outputs.insert(path_to_manifest_key(&root_dir, &path)?);
            // The web merges both manifests, so URLs must be unique across trees.
            let url = path_to_manifest_key(&tree.root, &path)?;
            if !asset_urls.insert(url.clone()) {
                bail!("multiple source files map to output {url}");
            }
        }
    }
    warn_duplicate_titles(&sources);

    let mut relocated = 0usize;
    for source in &sources {
        if relocate_outputs(config, &trees, source)? {
            relocated += 1;
        }
    }

    let mut photos = ByVisibility::<BTreeMap<String, PhotoEntry>>::default();
    let files = previous_state.files.clone();
    let mut pending = Vec::new();
    let mut reused_count = 0usize;

    for source in sources {
        let previous = find_previous_build(
            config,
            &trees,
            &source,
            &previous_manifests,
            &previous_state,
        )?;
        if let Some(photo) = previous.complete_photo() {
            photos
                .get_mut(source.visibility)
                .insert(photo.original.url.clone(), photo.clone());
            reused_count += 1;
        } else {
            pending.push(PhotoBuildItem { source, previous });
        }
    }
    pending.sort_by(|left, right| {
        right
            .source
            .size
            .cmp(&left.source.size)
            .then_with(|| left.source.source_key.cmp(&right.source.source_key))
    });

    let total = reused_count + pending.len();
    let workers = recommended_parallelism();

    Ok(BuildPlan {
        root_dir,
        trees,
        total,
        workers,
        avif_threads: recommended_avif_threads(workers, total),
        full_res_parallelism: recommended_full_res_parallelism(workers),
        checkpoint_interval: CHECKPOINT_BATCH_MIN.max(total / 50),
        photos,
        files,
        pending,
        reused: reused_count,
        relocated,
        selected,
        current_keys,
        expected_outputs,
    })
}

fn print_build_start(config: &Config, plan: &BuildPlan) {
    println!("Build");
    println!("  Source   {}", config.source_path().display());
    println!("  Output   {}", plan.root_dir.display());
    for visibility in Visibility::ALL {
        let tags = config.tags(visibility);
        let tags = if tags.is_empty() {
            "untagged".to_string()
        } else {
            tags.join(", ")
        };
        let label = match visibility {
            Visibility::Public => "Public",
            Visibility::Private => "Private",
        };
        println!(
            "  {label:<8} {}/ · {tags} · {} photos",
            visibility_dir_name(&plan.root_dir, &plan.trees.get(visibility).root),
            plan.selected.get(visibility)
        );
    }
    if plan.relocated > 0 {
        println!(
            "  Moved    {} photos between public and private",
            plan.relocated
        );
    }
    println!(
        "  Photos   {} total · {} to process · {} reused",
        plan.total,
        plan.pending.len(),
        plan.reused
    );
    if !plan.pending.is_empty() {
        println!(
            "  Limits   {} workers · {} full-res jobs · {} AVIF {thread_label}/job",
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
    if plan.pending.is_empty() {
        return Ok(BuildSummary {
            processed: 0,
            reused: plan.reused,
            failed: 0,
        });
    }

    if !plan.photos.public.is_empty() || !plan.photos.private.is_empty() {
        plan.write_checkpoint(config)?;
    }

    let pending = std::mem::take(&mut plan.pending);
    let pending_count = pending.len();
    let (tx, rx) = mpsc::channel();
    let mut processed_count = 0usize;
    let mut failed_count = 0usize;
    let mut since_checkpoint = 0usize;
    let status_done = Arc::new(AtomicBool::new(false));
    let worker_count = plan.workers;
    let worker_context = Arc::new(BuildWorkerContext {
        config: config.clone(),
        trees: ByVisibility {
            public: OutputTree::new(config, Visibility::Public),
            private: OutputTree::new(config, Visibility::Private),
        },
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
                        .get_mut(photo.visibility)
                        .insert(photo.photo_entry.original.url.clone(), photo.photo_entry);
                    processed_count += 1;
                    since_checkpoint += 1;
                    if processed_count == 1 || since_checkpoint >= plan.checkpoint_interval {
                        plan.write_checkpoint(config)?;
                        since_checkpoint = 0;
                    }
                }
                BuildOutcome::Failure { source_key, error } => {
                    let message = format!("Failed {source_key}: {error}");
                    if progress.is_hidden() {
                        eprintln!("{message}");
                    } else {
                        progress.println(message);
                    }
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

    plan.write_checkpoint(config)?;

    Ok(BuildSummary {
        processed: processed_count,
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
            trees: &context.trees,
            avif_threads: context.avif_threads,
            full_res_limiter: &context.full_res_limiter,
            status: &context.status,
        };
        let result = build_photo(&photo_context, &item);

        let outcome = match result {
            Ok(photo) => BuildOutcome::Success(Box::new(photo)),
            Err(error) => BuildOutcome::Failure {
                source_key: item.source.source_key,
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

fn format_elapsed(elapsed: Duration) -> String {
    let seconds = elapsed.as_secs();
    let hours = seconds / 3600;
    let minutes = (seconds / 60) % 60;
    let seconds = seconds % 60;
    if hours > 0 {
        format!("{hours}h {minutes}m {seconds}s")
    } else if minutes > 0 {
        format!("{minutes}m {seconds}s")
    } else {
        format!("{seconds}s")
    }
}

fn progress_style(pending_count: usize) -> Result<ProgressStyle> {
    let fixed_width = console::measure_text_width(&format!(
        "⠹ Processing [] {pending_count}/{pending_count} · 00h 00m 00s"
    ));
    let terminal_width = usize::from(console::Term::stderr().size().1);
    let bar_width = terminal_width.saturating_sub(fixed_width).clamp(1, 30);
    ProgressStyle::with_template(&format!(
        "{{spinner:.green}} Processing [{{bar:{bar_width}.cyan/blue}}] {{pos}}/{{len}} · {{elapsed}}\n  {{msg}}"
    ))
    .map(|style| {
        style.progress_chars("█░░").with_key(
            "elapsed",
            |state: &ProgressState, writer: &mut dyn std::fmt::Write| {
                writer
                    .write_str(&format_elapsed(state.elapsed()))
                    .expect("failed to format progress elapsed time");
            },
        )
    })
    .map_err(|error| anyhow!("failed to configure progress bar: {error}"))
}

fn create_build_progress(pending_count: usize) -> Result<ProgressBar> {
    if pending_count == 0 {
        return Ok(ProgressBar::hidden());
    }

    let progress = ProgressBar::new(pending_count as u64);
    progress.set_style(progress_style(pending_count)?);
    progress.set_message("0 processing · 0 encoding AVIF");
    progress.enable_steady_tick(std::time::Duration::from_millis(120));
    Ok(progress)
}

struct BuildWorkerContext {
    config: Config,
    trees: ByVisibility<OutputTree>,
    avif_threads: usize,
    full_res_limiter: FullResLimiter,
    status: BuildStatus,
    pending: Mutex<VecDeque<PhotoBuildItem>>,
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

fn visibility_dir_name(root: &Path, tree_root: &Path) -> String {
    tree_root
        .strip_prefix(root)
        .unwrap_or(tree_root)
        .display()
        .to_string()
}

fn warn_duplicate_titles(sources: &[SourceItem]) {
    let mut seen = BTreeMap::new();
    for source in sources {
        let Some(title) = source.path.file_stem() else {
            continue;
        };
        if let Some(previous) = seen.insert(title.to_os_string(), &source.source_key) {
            warn!(
                "{previous} and {} share the title {}; their photo pages will collide",
                source.source_key,
                title.to_string_lossy()
            );
        }
    }
}

/// Moves outputs left in the other tree after a visibility change, so they are
/// reused instead of re-encoded. Returns whether anything moved.
fn relocate_outputs(
    config: &Config,
    trees: &ByVisibility<OutputTree>,
    source: &SourceItem,
) -> Result<bool> {
    let current = trees.get(source.visibility);
    let previous = trees.get(source.visibility.other());
    let mut moved = false;
    for (from, to) in [
        (
            previous.original_path(&source.relative_path),
            current.original_path(&source.relative_path),
        ),
        (
            previous.thumbnail_path(config.thumbnail_format, &source.relative_path),
            current.thumbnail_path(config.thumbnail_format, &source.relative_path),
        ),
    ] {
        if to.exists() || !from.is_file() {
            continue;
        }
        create_parent_directory(&to)?;
        fs::rename(&from, &to)
            .with_context(|| format!("failed to move {} to {}", from.display(), to.display()))?;
        moved = true;
    }
    Ok(moved)
}

fn find_previous_build(
    config: &Config,
    trees: &ByVisibility<OutputTree>,
    item: &SourceItem,
    previous_manifests: &ByVisibility<LoadedManifest>,
    previous_state: &StateFile,
) -> Result<PreviousBuild> {
    let stamp = previous_state.files.get(&item.source_key);
    let source_status = match stamp {
        Some(stamp) if stamp.matches(item.size, item.mtime_ms) => SourceStatus::Unchanged,
        Some(_) => SourceStatus::Changed,
        None => SourceStatus::Untracked,
    };
    let tree = trees.get(item.visibility);
    let root = &tree.root;
    let original_path = tree.original_path(&item.relative_path);
    let thumbnail_path = tree.thumbnail_path(config.thumbnail_format, &item.relative_path);
    let original_key = path_to_manifest_key(root, &original_path)?;
    // After a visibility change the entry is still in the other tree's manifest.
    let photo = previous_manifests
        .get(item.visibility)
        .photos_by_key
        .get(&original_key)
        .or_else(|| {
            previous_manifests
                .get(item.visibility.other())
                .photos_by_key
                .get(&original_key)
        })
        .cloned();
    let original = photo
        .as_ref()
        .filter(|_| source_status != SourceStatus::Changed)
        .and_then(|photo| cached_asset(root, &original_path, AVIF_MIME, &photo.original));
    let thumbnail = photo
        .as_ref()
        .filter(|_| source_status != SourceStatus::Changed)
        .and_then(|photo| {
            cached_asset(
                root,
                &thumbnail_path,
                mime_from_format(config.thumbnail_format),
                &photo.thumbnail,
            )
            .filter(|_| !photo.thumb_hash.is_empty())
            .map(|asset| BuiltThumbnail {
                asset,
                thumb_hash: photo.thumb_hash.clone(),
            })
        });
    Ok(PreviousBuild {
        photo,
        source_status,
        original,
        thumbnail,
    })
}

fn cached_asset(root: &Path, path: &Path, mime: &str, asset: &Asset) -> Option<Asset> {
    let key = path_to_manifest_key(root, path).ok()?;
    let metadata = fs::metadata(path).ok()?;
    (asset.url == key
        && asset.mime == mime
        && asset.width > 0
        && asset.height > 0
        && metadata.is_file()
        && metadata.len() > 0
        && metadata.len() == asset.bytes)
        .then(|| asset.clone())
}

fn build_photo(context: &PhotoBuildContext<'_>, item: &PhotoBuildItem) -> Result<BuiltPhoto> {
    let source = &item.source;
    let previous = &item.previous;
    let tree = context.trees.get(source.visibility);
    let original_path = tree.original_path(&source.relative_path);
    let thumbnail_path =
        tree.thumbnail_path(context.config.thumbnail_format, &source.relative_path);
    let existing_original = if previous.source_status == SourceStatus::Changed {
        None
    } else {
        previous
            .original
            .clone()
            .or_else(|| read_existing_original(&tree.root, &original_path))
    };
    let existing_thumbnail = if previous.source_status == SourceStatus::Changed {
        None
    } else {
        previous.thumbnail.clone().or_else(|| {
            read_existing_thumbnail(&tree.root, &thumbnail_path, context.config.thumbnail_format)
        })
    };
    let refresh_metadata =
        previous.source_status != SourceStatus::Unchanged || previous.photo.is_none();
    let generate_original = existing_original.is_none();
    let generate_thumbnail = existing_thumbnail.is_none();
    let needs_source = refresh_metadata || generate_original || generate_thumbnail;
    let exif = needs_source.then(|| read_exif(&source.path)).flatten();
    let orientation = source_orientation(exif.as_ref());
    let source_info = if needs_source {
        match read_source_info(&source.path, orientation) {
            Ok(info) => Some(info),
            Err(error) if !generate_original && !generate_thumbnail => {
                warn!(
                    "could not probe source image {}: {error:#}",
                    source.path.display()
                );
                None
            }
            Err(error) => return Err(error),
        }
    } else {
        None
    };
    let original = match existing_original {
        Some(asset) => asset,
        None => build_original_asset(
            context,
            source,
            source_info
                .as_ref()
                .ok_or_else(|| anyhow!("missing source information"))?,
        )?,
    };
    let thumbnail = match existing_thumbnail {
        Some(thumbnail) => thumbnail,
        None => build_thumbnail_asset(
            context,
            source,
            source_info
                .as_ref()
                .ok_or_else(|| anyhow!("missing source information"))?,
        )?,
    };
    let photo_entry = if refresh_metadata {
        let extracted = extract_source_metadata(
            exif.as_ref(),
            source_info.as_ref().and_then(|info| info.bit_depth),
            source_info
                .as_ref()
                .and_then(|info| info.icc_profile.as_deref()),
        );
        let title = source
            .path
            .file_stem()
            .ok_or_else(|| anyhow!("missing file stem for {}", source.path.display()))?
            .to_string_lossy()
            .into_owned();
        PhotoEntry {
            original,
            thumbnail: thumbnail.asset,
            thumb_hash: thumbnail.thumb_hash,
            title,
            taken_at: extracted
                .taken_at
                .unwrap_or(timestamp_ms_rfc3339(source.mtime_ms)?),
            location: extracted.location,
            camera: extracted.camera.unwrap_or_default(),
            image: extracted.image,
        }
    } else {
        let mut photo = previous
            .photo
            .clone()
            .ok_or_else(|| anyhow!("missing reusable photo entry"))?;
        photo.original = original;
        photo.thumbnail = thumbnail.asset;
        photo.thumb_hash = thumbnail.thumb_hash;
        photo
    };
    let current = fs::metadata(&source.path)?;
    if current.len() != source.size || metadata_mtime_ms(&current)? != source.mtime_ms {
        if previous.source_status == SourceStatus::Untracked {
            for (generated, path) in [
                (generate_original, &original_path),
                (generate_thumbnail, &thumbnail_path),
            ] {
                if generated && let Err(error) = fs::remove_file(path) {
                    warn!(
                        "failed to remove generated output {} after source changed: {error}",
                        path.display()
                    );
                }
            }
        }
        bail!(
            "source changed during processing: {}",
            source.path.display()
        );
    }
    Ok(BuiltPhoto {
        visibility: source.visibility,
        state_key: source.source_key.clone(),
        state_entry: StateEntry {
            size: source.size,
            mtime_ms: source.mtime_ms,
        },
        photo_entry,
    })
}

struct PhotoBuildItem {
    source: SourceItem,
    previous: PreviousBuild,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SourceStatus {
    Unchanged,
    Changed,
    Untracked,
}

struct PreviousBuild {
    photo: Option<PhotoEntry>,
    source_status: SourceStatus,
    original: Option<Asset>,
    thumbnail: Option<BuiltThumbnail>,
}

impl PreviousBuild {
    fn complete_photo(&self) -> Option<&PhotoEntry> {
        self.photo.as_ref().filter(|_| {
            self.source_status == SourceStatus::Unchanged
                && self.original.is_some()
                && self.thumbnail.is_some()
        })
    }
}

struct PhotoBuildContext<'a> {
    config: &'a Config,
    trees: &'a ByVisibility<OutputTree>,
    avif_threads: usize,
    full_res_limiter: &'a FullResLimiter,
    status: &'a BuildStatus,
}

struct BuiltPhoto {
    visibility: Visibility,
    state_key: String,
    state_entry: StateEntry,
    photo_entry: PhotoEntry,
}

enum BuildOutcome {
    Success(Box<BuiltPhoto>),
    Failure { source_key: String, error: String },
}

fn build_original_asset(
    context: &PhotoBuildContext<'_>,
    item: &SourceItem,
    source_info: &SourceInfo,
) -> Result<Asset> {
    let tree = context.trees.get(item.visibility);
    let output = tree.original_path(&item.relative_path);
    create_parent_directory(&output)?;
    let _permit = context.full_res_limiter.acquire();
    let _processing = ScopedCounter::new(&context.status.processing);
    let loaded = avif::decode(&item.path, source_info.orientation)?;
    let _encoding = ScopedCounter::new(&context.status.encoding);
    avif::encode(
        &loaded,
        &tree.root,
        &output,
        avif::EncodingOptions {
            quality: context.config.avif_quality,
            speed: context.config.avif_speed,
            threads: context.avif_threads,
        },
    )
}

fn build_thumbnail_asset(
    context: &PhotoBuildContext<'_>,
    item: &SourceItem,
    source_info: &SourceInfo,
) -> Result<BuiltThumbnail> {
    let tree = context.trees.get(item.visibility);
    let output = tree.thumbnail_path(context.config.thumbnail_format, &item.relative_path);
    let _processing = ScopedCounter::new(&context.status.processing);
    thumbnail::build(
        &item.path,
        source_info,
        &tree.root,
        &output,
        thumbnail::EncodingOptions {
            width: context.config.thumbnail_width,
            format: context.config.thumbnail_format,
            quality: context.config.thumbnail_quality,
        },
    )
}
