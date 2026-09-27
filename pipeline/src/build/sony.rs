use exif::{Exif, In, Tag, Value};

use super::catalog::CreativeLook;

pub(super) fn extract_creative_look(exif: &Exif) -> Option<CreativeLook> {
    let Value::Ascii(make) = &exif.get_field(Tag::Make, In::PRIMARY)?.value else {
        return None;
    };
    if !make.first()?.eq_ignore_ascii_case(b"SONY") {
        return None;
    }
    let Value::Undefined(note, offset) = &exif.get_field(Tag::MakerNote, In::PRIMARY)?.value else {
        return None;
    };
    parse_creative_look(note, usize::try_from(*offset).ok()?, exif.little_endian())
}

// Sony's IFD follows a 12-byte header, uses the enclosing TIFF byte order,
// and stores external value offsets relative to the enclosing TIFF buffer.
// Only the documented Creative Look tags are read; other MakerNotes are ignored.
fn parse_creative_look(note: &[u8], base: usize, little: bool) -> Option<CreativeLook> {
    if !note.starts_with(b"SONY DSC \0\0\0") && !note.starts_with(b"SONY CAM \0\0\0") {
        return None;
    }
    let count = usize::from(read_u16(note.get(12..14)?, little)?);
    let entries = note.get(14..14_usize.checked_add(count.checked_mul(12)?)?)?;
    let entry = |tag: u16| {
        entries
            .chunks_exact(12)
            .find(|data| read_u16(&data[..2], little) == Some(tag))
    };
    let name_entry = entry(0xb020)?;
    if read_u16(&name_entry[2..4], little)? != 2 {
        return None;
    }
    let length = usize::try_from(read_u32(&name_entry[4..8], little)?).ok()?;
    if !(1..=64).contains(&length) {
        return None;
    }
    let name_data = if length <= 4 {
        name_entry.get(8..8 + length)?
    } else {
        let start = usize::try_from(read_u32(&name_entry[8..12], little)?)
            .ok()?
            .checked_sub(base)?;
        note.get(start..start.checked_add(length)?)?
    };
    let name = std::str::from_utf8(name_data.split(|byte| *byte == 0).next()?)
        .ok()?
        .trim();
    let name = match name {
        "Standard" => "ST",
        "Portrait" => "PT",
        "Neutral" => "NT",
        "Vivid" => "VV",
        "Sepia" => "SE",
        "" | "None" | "Off" => return None,
        other if other.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ') => other,
        _ => return None,
    };
    let setting = |tag, min, max| {
        let data = entry(tag)?;
        if read_u16(&data[2..4], little)? != 9 || read_u32(&data[4..8], little)? != 1 {
            return None;
        }
        let bytes = data[8..12].try_into().ok()?;
        let value = if little {
            i32::from_le_bytes(bytes)
        } else {
            i32::from_be_bytes(bytes)
        };
        (min..=max).contains(&value).then_some(value)
    };
    Some(CreativeLook {
        name: name.to_owned(),
        contrast: setting(0x2004, -9, 9),
        highlights: setting(0x2033, -9, 9),
        shadows: setting(0x2032, -9, 9),
        fade: setting(0x2034, 0, 9),
        saturation: setting(0x2005, -9, 9),
        sharpness: setting(0x2006, 0, 9),
        sharpness_range: setting(0x2035, 1, 5),
        clarity: setting(0x2036, 0, 9),
    })
}

fn read_u16(data: &[u8], little: bool) -> Option<u16> {
    let bytes = data.try_into().ok()?;
    Some(if little {
        u16::from_le_bytes(bytes)
    } else {
        u16::from_be_bytes(bytes)
    })
}

fn read_u32(data: &[u8], little: bool) -> Option<u32> {
    let bytes = data.try_into().ok()?;
    Some(if little {
        u32::from_le_bytes(bytes)
    } else {
        u32::from_be_bytes(bytes)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(little: bool, name: &str) -> Vec<u8> {
        let u16_bytes = |value: u16| {
            if little {
                value.to_le_bytes()
            } else {
                value.to_be_bytes()
            }
        };
        let u32_bytes = |value: u32| {
            if little {
                value.to_le_bytes()
            } else {
                value.to_be_bytes()
            }
        };
        let mut note = b"SONY DSC \0\0\0".to_vec();
        note.extend(u16_bytes(9));
        note.extend(u16_bytes(0xb020));
        note.extend(u16_bytes(2));
        note.extend(u32_bytes(16));
        // The value is outside the IFD and its offset includes the enclosing TIFF base.
        note.extend(u32_bytes(37 + 14 + 9 * 12 + 4));
        for (tag, value) in [
            (0x2004, 5_i32),
            (0x2033, -3),
            (0x2032, 0),
            (0x2034, 0),
            (0x2005, -2),
            (0x2006, 4),
            (0x2035, 3),
            (0x2036, 8),
        ] {
            note.extend(u16_bytes(tag));
            note.extend(u16_bytes(9));
            note.extend(u32_bytes(1));
            note.extend(if little {
                value.to_le_bytes()
            } else {
                value.to_be_bytes()
            });
        }
        note.extend([0; 4]);
        let mut name_data = [0; 16];
        name_data[..name.len()].copy_from_slice(name.as_bytes());
        note.extend(name_data);
        note
    }

    #[test]
    fn reads_settings_and_absolute_offsets_in_both_byte_orders() {
        for little in [true, false] {
            let look = parse_creative_look(&fixture(little, "Portrait"), 37, little).unwrap();
            assert_eq!(look.name, "PT");
            assert_eq!(look.contrast, Some(5));
            assert_eq!(look.highlights, Some(-3));
            assert_eq!(look.shadows, Some(0));
            assert_eq!(look.fade, Some(0));
            assert_eq!(look.saturation, Some(-2));
            assert_eq!(look.sharpness, Some(4));
            assert_eq!(look.sharpness_range, Some(3));
            assert_eq!(look.clarity, Some(8));
        }
    }

    #[test]
    fn reads_inline_names_and_omits_invalid_settings() {
        let mut note = fixture(true, "VV2");
        note[18..22].copy_from_slice(&4_u32.to_le_bytes());
        note[22..26].copy_from_slice(b"VV2\0");
        note[34..38].copy_from_slice(&10_i32.to_le_bytes());
        // A multi-value setting is not a valid scalar configuration value.
        note[42..46].copy_from_slice(&2_u32.to_le_bytes());
        let look = parse_creative_look(&note, 37, true).unwrap();
        assert_eq!(look.name, "VV2");
        assert_eq!(look.contrast, None);
        assert_eq!(look.highlights, None);
        assert_eq!(look.shadows, Some(0));
    }

    #[test]
    fn ignores_foreign_disabled_and_corrupt_notes() {
        let note = fixture(true, "FL");
        assert!(parse_creative_look(&fixture(true, "None"), 37, true).is_none());
        let mut foreign = note.clone();
        foreign[..4].copy_from_slice(b"APPL");
        assert!(parse_creative_look(&foreign, 37, true).is_none());
        let mut bad_offset = note.clone();
        bad_offset[22..26].copy_from_slice(&1_u32.to_le_bytes());
        assert!(parse_creative_look(&bad_offset, 37, true).is_none());
        let mut bad_count = note.clone();
        bad_count[12..14].copy_from_slice(&u16::MAX.to_le_bytes());
        assert!(parse_creative_look(&bad_count, 37, true).is_none());
        for length in 0..note.len() {
            let _ = parse_creative_look(&note[..length], 37, true);
        }
    }
}
