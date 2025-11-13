use serde::Serialize;
use crate::err::ErrorKind::SerdeError;

#[derive(Serialize, Debug)]
pub struct Error {
    pub kind: ErrorKind,
    pub message: String
}

impl Error {
    pub fn new<M: Into<String>>(kind: ErrorKind, message: M) -> Self {
        Error { kind, message: message.into() }
    }
}

#[derive(Serialize, Debug)]
pub enum ErrorKind {
    // Kind, error
    IO(String, String),
    SerialError(String),
    UnknownDeviceManager(String),
    InvalidConfig,
    ChannelSendError,
    AlreadyOpen(String, String),
    NoSuchProject(),
    SerdeError
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        let kind = ErrorKind::IO(err.kind().to_string(), err.to_string());

        Error::new(
            kind,
            "IO Error"
        )
    }
}

impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Error::new(
            SerdeError,
            "Serialization Error"
        )
    }
}