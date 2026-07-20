use std::{fs, path::PathBuf};

use anyhow::{Context, Result, bail};
use serde::Deserialize;

const DEFAULT_CONFIG_PATH: &str = "pipeline.toml";

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    #[serde(rename = "targetPath")]
    pub target_path: PathBuf,
    #[serde(rename = "sourcePath")]
    pub source_path: PathBuf,
    #[serde(default, rename = "sourceTags")]
    pub source_tags: Vec<String>,
    pub originals_dir: PathBuf,
    pub thumbnails_dir: PathBuf,
    pub thumbnail_width: u32,
    pub thumbnail_format: ThumbnailFormat,
    pub thumbnail_quality: u8,
    #[serde(default = "default_avif_quality")]
    pub avif_quality: u8,
    #[serde(default = "default_avif_speed")]
    pub avif_speed: u8,
    pub enable_blurhash: bool,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThumbnailFormat {
    Jpeg,
    Png,
    Webp,
}

impl Config {
    pub fn load() -> Result<Self> {
        let raw = fs::read_to_string(DEFAULT_CONFIG_PATH)
            .with_context(|| format!("failed to read {DEFAULT_CONFIG_PATH}"))?;
        let config: Self = toml::from_str(&raw)
            .with_context(|| format!("failed to parse {DEFAULT_CONFIG_PATH}"))?;
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<()> {
        if self.source_tags.iter().any(|tag| tag.trim().is_empty()) {
            bail!("sourceTags must not contain empty values");
        }

        if self.thumbnail_width == 0 {
            bail!("thumbnail_width must be greater than 0");
        }

        if self.thumbnail_quality == 0 || self.thumbnail_quality > 100 {
            bail!("thumbnail_quality must be between 1 and 100");
        }

        if self.avif_quality == 0 || self.avif_quality > 100 {
            bail!("avif_quality must be between 1 and 100");
        }

        if self.avif_speed > 10 {
            bail!("avif_speed must be between 0 and 10");
        }

        Ok(())
    }

    pub fn root_dir(&self) -> PathBuf {
        resolve_from_cwd(&self.target_path)
    }

    pub fn source_path(&self) -> PathBuf {
        resolve_from_cwd(&self.source_path)
    }

    pub fn source_tags(&self) -> &[String] {
        &self.source_tags
    }

    pub fn originals_path(&self) -> PathBuf {
        resolve_under_root(&self.root_dir(), &self.originals_dir)
    }

    pub fn thumbnails_path(&self) -> PathBuf {
        resolve_under_root(&self.root_dir(), &self.thumbnails_dir)
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.root_dir().join("manifest.json")
    }

    pub fn state_path(&self) -> PathBuf {
        self.root_dir().join("state.json")
    }
}

impl ThumbnailFormat {
    pub fn extension(self) -> &'static str {
        match self {
            Self::Jpeg => "jpg",
            Self::Png => "png",
            Self::Webp => "webp",
        }
    }
}

fn resolve_under_root(root: &std::path::Path, path: &PathBuf) -> PathBuf {
    if path.is_absolute() {
        path.clone()
    } else {
        root.join(path)
    }
}

fn resolve_from_cwd(path: &PathBuf) -> PathBuf {
    if path.is_absolute() {
        path.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    }
}

fn default_avif_quality() -> u8 {
    95
}

fn default_avif_speed() -> u8 {
    7
}
