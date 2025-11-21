use crate::config::BuilderConfig;
use crate::device::{Device, DeviceChannel, DeviceConfig, DeviceManager, DeviceRef};
use crate::device_pool;
use crate::err::{Error, ErrorKind};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serialport::SerialPort;
use std::io::{Read, Write};
use std::ops::{Deref, DerefMut};
use std::sync::Mutex;
use std::time::Duration;

struct SerialChannel {
    port: Mutex<Option<Box<dyn SerialPort>>>,
}

impl SerialChannel {
    fn use_port<T>(
        &self,
        block: impl FnOnce(&mut Box<dyn SerialPort>) -> std::io::Result<T>,
    ) -> std::io::Result<T> {
        let mut guard = self.port.lock().unwrap();
        if let Some(p) = guard.deref_mut() {
            block(p)
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Serial port is closed.",
            ))
        }
    }
}

impl Read for SerialChannel {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.use_port(|p| p.read(buf))
    }
}

impl Write for SerialChannel {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.use_port(|p| p.write(buf))
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.use_port(|p| p.flush())
    }
}

impl DeviceChannel for SerialChannel {
    fn available(&self) -> std::io::Result<usize> {
        self.use_port(|p| p.bytes_to_read().map(|b| b as usize).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("{:?}", e))
        }))
    }

    fn close(&mut self) {
        self.port.lock().unwrap().take();
    }
}

#[derive(Deserialize, Serialize)]
struct SerialConfig {
    name: String,
    pub(in crate::device::serial) baud_rate: u32,
    pub(in crate::device::serial) timeout: u64,
}

impl DeviceConfig for SerialConfig {
    fn name(&self) -> String {
        self.name.clone()
    }

    fn serialize(&self) -> Value {
        serde_json::to_value(self).unwrap()
    }
}

struct SerialManager {}

impl DeviceManager for SerialManager {
    fn sort(&self) -> &'static str {
        "serial"
    }

    fn open(&self, config: Value) -> Result<DeviceRef, Error> {
        let config: SerialConfig = serde_json::from_value(config).map_err(|_| {
            Error::new(
                ErrorKind::InvalidConfig,
                "Internal error: the config passed to this handler is not valid",
            )
        })?;

        let serial_port = serialport::new(config.name(), config.baud_rate)
            .timeout(Duration::from_millis(config.timeout))
            .open()
            .map_err(|e| {
                Error::new(
                    ErrorKind::SerialError,
                    format!("Failed to open serial port. {}", e.description),
                )
            })?;

        let channel = Box::new(SerialChannel {
            port: Mutex::new(Some(serial_port)),
        });

        let device = Device::new(config.name.clone(), channel, Box::new(config));

        let reference = DeviceRef::new();

        device_pool!().register(device, &reference);

        Ok(reference)
    }

    fn available(&self) -> Vec<String> {
        let ports = serialport::available_ports().unwrap_or(Vec::new());

        ports.iter().map(|p| p.port_name.clone()).collect()
    }
}

impl<R: tauri::Runtime> BuilderConfig<R> {
    pub fn serial(self) -> BuilderConfig<R> {
        self.register_device_manager(Box::new(SerialManager {}))
    }
}

#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Write;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_read_serial() {
        let ports = serialport::available_ports().expect("No ports found!");
        for p in ports {
            println!("{}", p.port_name);
        }

        let port = serialport::new("/dev/tty.usbmodem211302", 115_200)
            .timeout(Duration::from_millis(1))
            .open();

        if let Err(e) = port {
            println!("Err {:?}, {:?}", e, e.kind());

            return;
        };

        let mut port = if let Ok(port) = port { port } else { return };

        let mut file = File::create("test.txt").unwrap();

        loop {
            let mut serial_buf: Vec<u8> = vec![0; 32];
            if let Ok(size) = port.read(serial_buf.as_mut_slice()) {
                file.write(&serial_buf[0..size]).unwrap();
                // println!("{}", String::from_utf8(serial_buf).unwrap());
            }
            sleep(Duration::from_millis(100));
        }
    }
}
