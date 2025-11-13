use crate::command::{Command, CommandParser};
use crate::device::{DeviceManagers, DeviceRef};
use crate::device_pool;
use crate::drive::{Drive, Vehicle};
use crate::err::{Error, ErrorKind};
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;
use tauri::{command, AppHandle, Emitter, State};

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
pub enum DeviceEvent {
    RecRaw(Vec<u8>),
    RecCommand(Command),
    Close,
}

#[command]
pub fn open_device(
    sort: String,
    name: String,
    config: Value,

    channel: Channel<DeviceEvent>,

    managers: State<DeviceManagers>,
    driver: State<Vehicle>,
) -> Result<DeviceRef, Error> {
    let manager = managers.get(&sort).ok_or_else(|| {
        Error::new(
            ErrorKind::UnknownDeviceManager(sort.clone()),
            "Unknown Device type",
        )
    })?;

    // // todo need this check?
    // if device_pool!().has(&name) {
    //     return Err(Error::new(
    //         ErrorKind::AlreadyOpen(sort, name),
    //         "Device is already open",
    //     ));
    // }

    let device = manager.open(config)?;

    let drive = ProjectDrive {
        channel,
        parser: CommandParser::new(),
        device: device.clone(),
        drive: false,
    };

    driver.register(drive);

    Ok(device)
}

struct ProjectDrive {
    channel: Channel<DeviceEvent>,
    parser: CommandParser,
    device: DeviceRef,
    drive: bool,
}

impl Drive for ProjectDrive {
    fn drive(&mut self) -> Result<bool, Error> {
        if self.device.rc() > 1 && !self.drive {
            self.drive = true
        }

        if self.device.rc() == 1 && self.drive {
            self.device.close();

            self.channel.send(DeviceEvent::Close).map_err(|_| {
                Error::new(
                    ErrorKind::ChannelSendError,
                    "Failed to send message through channel",
                )
            })?;
            return Ok(false);
        }

        if !self.drive {
            return Ok(true);
        }

        let content = self.device.use_device(|d| d.read_available());
        let content = if let Some(x) = content {
            x?
        } else {
            self.channel.send(DeviceEvent::Close).map_err(|_| {
                Error::new(
                    ErrorKind::ChannelSendError,
                    "Failed to send message through channel",
                )
            })?;

            return Ok(false);
        };

        self.parser.extend(content.as_slice())?;

        self.channel
            .send(DeviceEvent::RecRaw(content.clone()))
            .map_err(|_| {
                Error::new(
                    ErrorKind::ChannelSendError,
                    "Failed to send message through channel",
                )
            })?;

        let mut parsing = true;
        while parsing {
            if let Some(c) = self.parser.parse() {
                self.channel
                    .send(DeviceEvent::RecCommand(c))
                    .map_err(|_| {
                        Error::new(
                            ErrorKind::ChannelSendError,
                            "Failed to send message through channel",
                        )
                    })?;
            } else {
                parsing = false
            }
        }

        Ok(true)
    }
}
