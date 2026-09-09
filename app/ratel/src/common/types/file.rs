use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct File {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub size: String,
    pub ext: FileExtension,
    pub url: Option<String>,
    #[serde(default)]
    pub uploader_name: Option<String>,
    #[serde(default)]
    pub uploader_profile_url: Option<String>,
    #[serde(default)]
    pub uploaded_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub enum FileExtension {
    #[default]
    #[serde(alias = "jpg", alias = "jpeg", alias = "JPEG")]
    JPG,
    #[serde(alias = "png", alias = "PNG")]
    PNG,
    #[serde(alias = "pdf", alias = "PDF")]
    PDF,
    #[serde(alias = "zip", alias = "ZIP")]
    ZIP,
    #[serde(alias = "doc", alias = "docx", alias = "word", alias = "WORD")]
    WORD,
    #[serde(alias = "ppt", alias = "pptx", alias = "PPTX")]
    PPTX,
    #[serde(alias = "xls", alias = "xlsx", alias = "excel", alias = "EXCEL")]
    EXCEL,
    #[serde(alias = "mp4", alias = "MP4")]
    MP4,
    #[serde(alias = "mov", alias = "MOV")]
    MOV,
    #[serde(alias = "mkv", alias = "MKV")]
    MKV,
    #[serde(alias = "m4a", alias = "M4A")]
    M4A,
    #[serde(alias = "mp3", alias = "MP3")]
    MP3,
    #[serde(alias = "wav", alias = "WAV")]
    WAV,
    /// Anything we do not have a dedicated type for. `from_ext_str` used to
    /// fall back to `default()` — i.e. JPG — so a `.m4a` podcast (or a `.txt`,
    /// a `.hwp`, …) claimed to be an image and was rendered into the file
    /// panel's "Image previews" grid as a broken `<img>`: a black tile with
    /// the filename as alt text. Unknown must be its own thing.
    #[serde(other)]
    ETC,
}

impl FileExtension {
    /// Parse a file extension string (e.g., "pdf", "docx") into a `FileExtension`.
    /// Returns `FileExtension::ETC` for unrecognized extensions.
    pub fn from_ext_str(ext: &str) -> Self {
        if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") {
            Self::JPG
        } else if ext.eq_ignore_ascii_case("png") {
            Self::PNG
        } else if ext.eq_ignore_ascii_case("pdf") {
            Self::PDF
        } else if ext.eq_ignore_ascii_case("zip") {
            Self::ZIP
        } else if ext.eq_ignore_ascii_case("doc") || ext.eq_ignore_ascii_case("docx") {
            Self::WORD
        } else if ext.eq_ignore_ascii_case("ppt") || ext.eq_ignore_ascii_case("pptx") {
            Self::PPTX
        } else if ext.eq_ignore_ascii_case("xls") || ext.eq_ignore_ascii_case("xlsx") {
            Self::EXCEL
        } else if ext.eq_ignore_ascii_case("mp4") {
            Self::MP4
        } else if ext.eq_ignore_ascii_case("mov") {
            Self::MOV
        } else if ext.eq_ignore_ascii_case("mkv") {
            Self::MKV
        } else if ext.eq_ignore_ascii_case("m4a") {
            Self::M4A
        } else if ext.eq_ignore_ascii_case("mp3") {
            Self::MP3
        } else if ext.eq_ignore_ascii_case("wav") {
            Self::WAV
        } else {
            // NOT `default()`. That is JPG, so every unrecognised extension
            // used to pass `is_image_ext` and get rendered as an image.
            Self::ETC
        }
    }

    /// Derive a `FileExtension` from the original filename, falling back to the
    /// URL when the filename has no extension. Uses `std::path::Path::extension()`
    /// for robust parsing (ignores dot-less names, hidden files like `.gitignore`, etc.).
    pub fn from_name_or_url(name: &str, url: &str) -> Self {
        // Try the filename first
        if let Some(ext) = std::path::Path::new(name).extension().and_then(|e| e.to_str()) {
            return Self::from_ext_str(ext);
        }
        // Fall back to URL (strip query string and trailing slashes, then extract extension)
        let path = url.split('?').next().unwrap_or(url).trim_end_matches('/');
        if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) {
            return Self::from_ext_str(ext);
        }
        // No extension anywhere. Same reasoning as `from_ext_str`: guessing
        // "image" here is what put audio files in the image preview grid.
        Self::ETC
    }
}

/// Extract a human-readable filename from a URL, falling back to `"untitled"`.
pub fn extract_filename_from_url(url: &str) -> String {
    let path = url.split('?').next().unwrap_or(url);
    // Trim trailing slashes so URLs like "https://example.com/path/" fall back correctly.
    let trimmed = path.trim_end_matches('/');

    if trimmed.is_empty() {
        return "untitled".to_string();
    }

    trimmed
        .rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .unwrap_or("untitled")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- FileExtension::from_ext_str ---

    #[test]
    fn from_ext_str_case_insensitive() {
        assert_eq!(FileExtension::from_ext_str("PDF"), FileExtension::PDF);
        assert_eq!(FileExtension::from_ext_str("pdf"), FileExtension::PDF);
        assert_eq!(FileExtension::from_ext_str("Pdf"), FileExtension::PDF);
        assert_eq!(FileExtension::from_ext_str("DOCX"), FileExtension::WORD);
        assert_eq!(FileExtension::from_ext_str("Xlsx"), FileExtension::EXCEL);
    }

    #[test]
    fn from_ext_str_audio() {
        assert_eq!(FileExtension::from_ext_str("m4a"), FileExtension::M4A);
        assert_eq!(FileExtension::from_ext_str("M4A"), FileExtension::M4A);
        assert_eq!(FileExtension::from_ext_str("mp3"), FileExtension::MP3);
        assert_eq!(FileExtension::from_ext_str("wav"), FileExtension::WAV);
    }

    #[test]
    fn from_ext_str_unrecognized_is_etc_not_an_image() {
        // Regression: this used to return `default()` (JPG), so a podcast
        // `.m4a` — and any other unlisted type — passed the file panel's
        // `is_image_ext` check and was rendered as a broken <img>.
        for ext in ["txt", "rs", "hwp", "csv", ""] {
            assert_eq!(FileExtension::from_ext_str(ext), FileExtension::ETC, "{ext}");
            assert_ne!(FileExtension::from_ext_str(ext), FileExtension::JPG, "{ext}");
        }
    }

    // --- FileExtension::from_name_or_url ---

    #[test]
    fn from_name_or_url_with_extension_in_filename() {
        assert_eq!(
            FileExtension::from_name_or_url("document.pdf", "https://example.com/assets/uuid"),
            FileExtension::PDF,
        );
        assert_eq!(
            FileExtension::from_name_or_url("photo.PNG", "https://example.com/assets/uuid"),
            FileExtension::PNG,
        );
    }

    #[test]
    fn from_name_or_url_dotless_filename_falls_back_to_url() {
        assert_eq!(
            FileExtension::from_name_or_url("readme", "https://example.com/file.pdf"),
            FileExtension::PDF,
        );
    }

    #[test]
    fn from_name_or_url_dotless_filename_and_extensionless_url() {
        assert_eq!(
            FileExtension::from_name_or_url("readme", "https://example.com/assets/uuid"),
            FileExtension::ETC,
        );
    }

    #[test]
    fn from_name_or_url_hidden_file_no_extension() {
        // .gitignore has no extension per std::path::Path::extension()
        assert_eq!(
            FileExtension::from_name_or_url(".gitignore", "https://example.com/assets/uuid"),
            FileExtension::ETC,
        );
    }

    #[test]
    fn from_name_or_url_hidden_file_with_extension() {
        assert_eq!(
            FileExtension::from_name_or_url(".config.pdf", "https://example.com/assets/uuid"),
            FileExtension::PDF,
        );
    }

    #[test]
    fn from_name_or_url_url_with_query_string() {
        assert_eq!(
            FileExtension::from_name_or_url("", "https://s3.aws.com/file.pdf?X-Amz-Signature=abc"),
            FileExtension::PDF,
        );
    }

    #[test]
    fn from_name_or_url_url_with_trailing_slash() {
        assert_eq!(
            FileExtension::from_name_or_url("", "https://example.com/file.pdf/"),
            FileExtension::PDF,
        );
    }

    #[test]
    fn from_name_or_url_empty_name_and_empty_url() {
        assert_eq!(
            FileExtension::from_name_or_url("", ""),
            FileExtension::ETC,
        );
    }

    // --- extract_filename_from_url ---

    #[test]
    fn extract_filename_normal_url() {
        assert_eq!(
            extract_filename_from_url("https://example.com/assets/document.pdf"),
            "document.pdf",
        );
    }

    #[test]
    fn extract_filename_url_with_query() {
        assert_eq!(
            extract_filename_from_url("https://s3.aws.com/file.pdf?X-Amz-Signature=abc"),
            "file.pdf",
        );
    }

    #[test]
    fn extract_filename_url_with_trailing_slash() {
        assert_eq!(
            extract_filename_from_url("https://example.com/path/"),
            "path",
        );
    }

    #[test]
    fn extract_filename_empty_url() {
        assert_eq!(extract_filename_from_url(""), "untitled");
    }

    #[test]
    fn extract_filename_root_url() {
        assert_eq!(
            extract_filename_from_url("https://example.com/"),
            "example.com",
        );
    }

    #[test]
    fn extract_filename_just_slashes() {
        assert_eq!(extract_filename_from_url("///"), "untitled");
    }
}
