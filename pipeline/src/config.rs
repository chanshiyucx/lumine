use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::Deserialize;

const DEFAULT_CONFIG_PATH: &str = "pipeline.toml";

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    target_path: PathBuf,
    source_path: PathBuf,
    public: VisibilityConfig,
    private: VisibilityConfig,
    originals_dir: PathBuf,
    thumbnails_dir: PathBuf,
    pub thumbnail_width: u32,
    pub thumbnail_format: ThumbnailFormat,
    pub thumbnail_quality: u8,
    #[serde(default = "default_avif_quality")]
    pub avif_quality: u8,
    #[serde(default = "default_avif_speed")]
    pub avif_speed: u8,
}

/// One output tree under target_path, selected by macOS Finder tags.
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VisibilityConfig {
    dir: PathBuf,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Visibility {
    Public,
    Private,
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
        for (field, tags) in [
            ("public.tags", &self.public.tags),
            ("private.tags", &self.private.tags),
        ] {
            if tags.iter().any(|tag| tag.trim().is_empty()) {
                bail!("{field} must not contain empty values");
            }
        }
        if self.private.tags.is_empty() {
            bail!("private.tags must contain at least one tag");
        }
        if let Some(tag) = self
            .public
            .tags
            .iter()
            .find(|tag| self.private.tags.contains(tag))
        {
            bail!("tag {tag:?} must not be listed in both public.tags and private.tags");
        }

        validate_direct_child_dir("public.dir", &self.public.dir)?;
        validate_direct_child_dir("private.dir", &self.private.dir)?;
        if self
            .public
            .dir
            .as_os_str()
            .eq_ignore_ascii_case(self.private.dir.as_os_str())
        {
            bail!("public.dir and private.dir must be different");
        }

        validate_direct_child_dir("originals_dir", &self.originals_dir)?;
        validate_direct_child_dir("thumbnails_dir", &self.thumbnails_dir)?;
        if self.originals_dir == self.thumbnails_dir {
            bail!("originals_dir and thumbnails_dir must be different");
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

        if self.avif_speed == 0 || self.avif_speed > 10 {
            bail!("avif_speed must be between 1 and 10");
        }

        Ok(())
    }

    pub fn root_dir(&self) -> PathBuf {
        resolve_from_cwd(&self.target_path)
    }

    pub fn source_path(&self) -> PathBuf {
        resolve_from_cwd(&self.source_path)
    }

    pub fn tags(&self, visibility: Visibility) -> &[String] {
        &self.visibility(visibility).tags
    }

    /// Root of one visibility's output; manifest asset URLs are relative to it.
    pub fn tree_path(&self, visibility: Visibility) -> PathBuf {
        self.root_dir().join(&self.visibility(visibility).dir)
    }

    pub fn originals_path(&self, visibility: Visibility) -> PathBuf {
        self.tree_path(visibility).join(&self.originals_dir)
    }

    pub fn thumbnails_path(&self, visibility: Visibility) -> PathBuf {
        self.tree_path(visibility).join(&self.thumbnails_dir)
    }

    pub fn manifest_path(&self, visibility: Visibility) -> PathBuf {
        self.tree_path(visibility).join("manifest.json")
    }

    pub fn state_path(&self) -> PathBuf {
        self.root_dir().join("state.json")
    }

    fn visibility(&self, visibility: Visibility) -> &VisibilityConfig {
        match visibility {
            Visibility::Public => &self.public,
            Visibility::Private => &self.private,
        }
    }
}

impl Visibility {
    pub const ALL: [Self; 2] = [Self::Public, Self::Private];

    pub fn other(self) -> Self {
        match self {
            Self::Public => Self::Private,
            Self::Private => Self::Public,
        }
    }
}

fn validate_direct_child_dir(field: &str, path: &Path) -> Result<()> {
    let mut components = path.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        bail!("{field} must be a single directory name");
    }

    Ok(())
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

fn resolve_from_cwd(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
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
    6
}
