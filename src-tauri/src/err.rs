use crate::err::ErrorKind::{SerdeError, UpdaterError};
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct Error {
    pub kind: ErrorKind,
    pub message: String,
}

impl Error {
    pub fn new<M: Into<String>>(kind: ErrorKind, message: M) -> Self {
        Error {
            kind,
            message: message.into(),
        }
    }
}

#[derive(Serialize, Debug)]
pub enum ErrorKind {
    // Kind, error
    IO,
    SerialError,
    UnknownDeviceManager,
    InvalidConfig,
    TauriError,
    AlreadyOpen,
    NoSuchProject,
    SerdeError,
    UpdaterError,
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        let kind = ErrorKind::IO;

        Error::new(kind, format!("IO Error: {}, {}", err.kind().to_string(), err.to_string()))
    }
}

impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Error::new(SerdeError, "Serialization Error")
    }
}

impl From<tauri_plugin_updater::Error> for Error {
    fn from(value: tauri_plugin_updater::Error) -> Self {
        Error::new(UpdaterError, value.to_string())
    }
}

impl From<tauri::Error> for Error {
    fn from(value: tauri::Error) -> Self {
        Error::new(
            ErrorKind::TauriError,
            value.to_string(),
        )
    }
}
