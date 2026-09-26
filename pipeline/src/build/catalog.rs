use std::{collections::BTreeMap, fs, fs::File, path::Path};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tracing::warn;

use super::storage::{path_to_manifest_key, write_json};

const MANIFEST_VERSION: u8 = 3;

pub(super) fn read_asset(
    root: &Path,
    path: &Path,
    width: u32,
    height: u32,
    mime: &str,
) -> Result<Asset> {
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() || metadata.len() == 0 || width == 0 || height == 0 {
        bail!("invalid image asset: {}", path.display());
    }
    Ok(Asset {
        url: path_to_manifest_key(root, path)?,
        width,
        height,
        bytes: metadata.len(),
        mime: mime.to_owned(),
    })
}

pub(super) fn load_previous_manifest(path: &Path) -> Result<LoadedManifest> {
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

pub(super) fn load_previous_state(path: &Path) -> Result<StateFile> {
    if !path.exists() {
        return Ok(StateFile {
            files: BTreeMap::new(),
        });
    }

    let file = File::open(path)
        .with_context(|| format!("failed to open previous state {}", path.display()))?;
    let state: StateFile = serde_json::from_reader(file).with_context(|| {
        format!(
            "invalid state {}; delete it to establish a new source baseline; also delete affected image outputs if sources may have changed",
            path.display()
        )
    })?;
    Ok(state)
}

pub(super) fn write_build_checkpoint(
    manifest_path: &Path,
    state_path: &Path,
    photos: &BTreeMap<String, PhotoEntry>,
    files: &BTreeMap<String, StateEntry>,
) -> Result<()> {
    let photo_values: Vec<_> = photos.values().collect();
    let mut manifest = serde_json::to_value(ManifestFileRef {
        version: MANIFEST_VERSION,
        updated_at: String::new(),
        photos: photo_values,
    })?;
    let mut previous_content = read_json_value(manifest_path)?;
    if let Some(value) = previous_content.as_mut()
        && let Some(object) = value.as_object_mut()
    {
        object.remove("updatedAt");
    }
    manifest
        .as_object_mut()
        .expect("manifest object")
        .remove("updatedAt");
    if previous_content.as_ref() != Some(&manifest) {
        manifest["updatedAt"] = serde_json::Value::String(now_rfc3339()?);
        write_json(manifest_path, &manifest)?;
    }
    let state = serde_json::to_value(StateFileRef { files })?;
    if read_json_value(state_path)?.as_ref() != Some(&state) {
        write_json(state_path, &state)?;
    }
    Ok(())
}

fn read_json_value(path: &Path) -> Result<Option<serde_json::Value>> {
    match File::open(path) {
        Ok(file) => {
            Ok(Some(serde_json::from_reader(file).with_context(|| {
                format!("failed to parse {}", path.display())
            })?))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error).with_context(|| format!("failed to open {}", path.display())),
    }
}

fn now_rfc3339() -> Result<String> {
    Ok(OffsetDateTime::now_utc().format(&Rfc3339)?)
}

#[derive(Default)]
pub(super) struct LoadedManifest {
    pub(super) photos_by_key: BTreeMap<String, PhotoEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct PhotoEntry {
    pub(super) original: Asset,
    pub(super) thumbnail: Asset,
    #[serde(rename = "thumbHash")]
    pub(super) thumb_hash: String,
    pub(super) title: String,
    #[serde(rename = "takenAt")]
    pub(super) taken_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) location: Option<Location>,
    pub(super) camera: Camera,
    pub(super) image: ImageMetadata,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct Asset {
    pub(super) url: String,
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) bytes: u64,
    pub(super) mime: String,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct StateFile {
    pub(super) files: BTreeMap<String, StateEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct StateEntry {
    pub(super) size: u64,
    #[serde(rename = "mtimeMs")]
    pub(super) mtime_ms: u64,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct Location {
    pub(super) lat: f64,
    pub(super) lng: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) alt: Option<f64>,
}

#[derive(Clone, Default, Deserialize, Serialize)]
pub(super) struct Camera {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) make: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) model: Option<String>,
    #[serde(rename = "lensMake", skip_serializing_if = "Option::is_none")]
    pub(super) lens_make: Option<String>,
    #[serde(rename = "lensModel", skip_serializing_if = "Option::is_none")]
    pub(super) lens_model: Option<String>,
    #[serde(rename = "focalLength", skip_serializing_if = "Option::is_none")]
    pub(super) focal_length: Option<f32>,
    #[serde(
        rename = "focalLengthIn35mmFilm",
        skip_serializing_if = "Option::is_none"
    )]
    pub(super) focal_length_in_35mm_film: Option<u32>,
    #[serde(rename = "fNumber", skip_serializing_if = "Option::is_none")]
    pub(super) f_number: Option<f32>,
    #[serde(rename = "maxApertureFNumber", skip_serializing_if = "Option::is_none")]
    pub(super) max_aperture_f_number: Option<f32>,
    #[serde(rename = "exposureTime", skip_serializing_if = "Option::is_none")]
    pub(super) exposure_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) iso: Option<u32>,
    #[serde(rename = "exposureProgram", skip_serializing_if = "Option::is_none")]
    pub(super) exposure_program: Option<String>,
    #[serde(rename = "exposureMode", skip_serializing_if = "Option::is_none")]
    pub(super) exposure_mode: Option<String>,
    #[serde(rename = "meteringMode", skip_serializing_if = "Option::is_none")]
    pub(super) metering_mode: Option<String>,
    #[serde(rename = "whiteBalance", skip_serializing_if = "Option::is_none")]
    pub(super) white_balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) flash: Option<String>,
    #[serde(rename = "sceneCaptureType", skip_serializing_if = "Option::is_none")]
    pub(super) scene_capture_type: Option<String>,
    #[serde(rename = "brightnessValue", skip_serializing_if = "Option::is_none")]
    pub(super) brightness_value: Option<f32>,
    #[serde(rename = "sensingMethod", skip_serializing_if = "Option::is_none")]
    pub(super) sensing_method: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct ImageMetadata {
    pub(super) orientation: u8,
    #[serde(rename = "colorSpace")]
    pub(super) color_space: String,
    #[serde(rename = "isLivePhoto")]
    pub(super) is_live_photo: bool,
    #[serde(rename = "bitDepth", skip_serializing_if = "Option::is_none")]
    pub(super) bit_depth: Option<u8>,
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

#[derive(Serialize)]
struct StateFileRef<'a> {
    files: &'a BTreeMap<String, StateEntry>,
}

impl StateEntry {
    pub(super) fn matches(&self, size: u64, mtime_ms: u64) -> bool {
        self.size == size && self.mtime_ms == mtime_ms
    }
}

impl Camera {
    pub(super) fn is_empty(&self) -> bool {
        self.make.is_none()
            && self.model.is_none()
            && self.lens_make.is_none()
            && self.lens_model.is_none()
            && self.focal_length.is_none()
            && self.focal_length_in_35mm_film.is_none()
            && self.f_number.is_none()
            && self.max_aperture_f_number.is_none()
            && self.exposure_time.is_none()
            && self.iso.is_none()
            && self.exposure_program.is_none()
            && self.exposure_mode.is_none()
            && self.metering_mode.is_none()
            && self.white_balance.is_none()
            && self.flash.is_none()
            && self.scene_capture_type.is_none()
            && self.brightness_value.is_none()
            && self.sensing_method.is_none()
    }
}
