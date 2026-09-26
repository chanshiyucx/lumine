use std::{fmt::Write as _, fs::File, path::Path};

use anyhow::Result;
use exif::{DateTime as ExifDateTime, Exif, In, Reader as ExifReader, Tag, Value};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tracing::warn;

use super::catalog::{Camera, ImageMetadata, Location};

pub(super) fn extract_source_metadata(
    exif: Option<&Exif>,
    bit_depth: Option<u8>,
) -> ExtractedMetadata {
    ExtractedMetadata {
        taken_at: exif.and_then(extract_taken_at),
        location: exif.and_then(extract_location),
        camera: exif.and_then(extract_camera),
        image: extract_image_metadata(exif, bit_depth),
    }
}

pub(super) fn read_exif(path: &Path) -> Option<Exif> {
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
        lens_make: exif_text(exif, Tag::LensMake),
        lens_model: exif_text(exif, Tag::LensModel),
        focal_length: positive_rational_value(exif, Tag::FocalLength).map(round_to_hundredths_f32),
        focal_length_in_35mm_film: exif_uint(exif, Tag::FocalLengthIn35mmFilm)
            .filter(|value| *value > 0),
        f_number: positive_rational_value(exif, Tag::FNumber).map(round_to_hundredths_f32),
        max_aperture_f_number: extract_max_aperture(exif),
        exposure_time: positive_rational_value(exif, Tag::ExposureTime),
        iso: extract_iso(exif),
        exposure_program: exif_display(exif, Tag::ExposureProgram),
        exposure_mode: compact_exposure_mode(exif),
        metering_mode: exif_display(exif, Tag::MeteringMode),
        white_balance: compact_white_balance(exif),
        flash: compact_flash(exif),
        scene_capture_type: exif_display(exif, Tag::SceneCaptureType),
        brightness_value: rational_value(exif, Tag::BrightnessValue).map(round_to_hundredths_f32),
        sensing_method: exif_uint(exif, Tag::SensingMethod)
            .filter(|value| matches!(value, 2..=5 | 7 | 8))
            .and_then(|_| exif_display(exif, Tag::SensingMethod)),
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

// `iso` is the effective capture sensitivity, not a copy of a single EXIF tag.
fn extract_iso(exif: &Exif) -> Option<u32> {
    normalize_iso(
        exif_uint(exif, Tag::PhotographicSensitivity),
        exif_uint(exif, Tag::SensitivityType),
        exif_uint(exif, Tag::StandardOutputSensitivity),
        exif_uint(exif, Tag::RecommendedExposureIndex),
        exif_uint(exif, Tag::ISOSpeed),
    )
}

fn normalize_iso(
    short: Option<u32>,
    kind: Option<u32>,
    sos: Option<u32>,
    rei: Option<u32>,
    speed: Option<u32>,
) -> Option<u32> {
    if let Some(value) = short.filter(|value| *value > 0 && *value < 65535) {
        return Some(value);
    }
    let positive = |value: Option<u32>| value.filter(|value| *value > 0);
    // For combination types the SHORT field represents SOS (4/5/7) or REI (6).
    // Prefer its corresponding LONG field, then another explicitly declared one.
    match kind {
        Some(1) => positive(sos),
        Some(2) => positive(rei),
        Some(3) => positive(speed),
        Some(4) => positive(sos).or_else(|| positive(rei)),
        Some(5) => positive(sos).or_else(|| positive(speed)),
        Some(6) => positive(rei).or_else(|| positive(speed)),
        Some(7) => positive(sos)
            .or_else(|| positive(rei))
            .or_else(|| positive(speed)),
        _ => positive(speed),
    }
}

fn positive_rational_value(exif: &Exif, tag: Tag) -> Option<f64> {
    rational_value(exif, tag).filter(|value| *value > 0.0)
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
    let Value::Rational(values) = &exif.get_field(Tag::LensSpecification, In::PRIMARY)?.value
    else {
        return None;
    };
    if values.len() < 4 {
        return None;
    }
    let wide = values[2].to_f64();
    let tele = values[3].to_f64();
    if !wide.is_finite() || wide <= 0.0 || !tele.is_finite() || tele <= 0.0 {
        return None;
    }
    if (wide - tele).abs() < f64::EPSILON {
        return Some(wide);
    }
    // A variable-aperture zoom's endpoints do not describe an intermediate focal length.
    let focal_length = positive_rational_value(exif, Tag::FocalLength)?;
    if (focal_length - values[0].to_f64()).abs() < 0.01 {
        Some(wide)
    } else if (focal_length - values[1].to_f64()).abs() < 0.01 {
        Some(tele)
    } else {
        None
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

pub(super) fn source_orientation(exif: Option<&Exif>) -> u8 {
    exif.and_then(|exif| exif_uint(exif, Tag::Orientation))
        .and_then(|value| u8::try_from(value).ok())
        .unwrap_or(1)
}

pub(super) fn timestamp_ms_rfc3339(epoch_milliseconds: u64) -> Result<String> {
    let nanoseconds = i128::from(epoch_milliseconds) * 1_000_000;
    Ok(OffsetDateTime::from_unix_timestamp_nanos(nanoseconds)?.format(&Rfc3339)?)
}

pub(super) struct ExtractedMetadata {
    pub(super) taken_at: Option<String>,
    pub(super) location: Option<Location>,
    pub(super) camera: Option<Camera>,
    pub(super) image: ImageMetadata,
}
