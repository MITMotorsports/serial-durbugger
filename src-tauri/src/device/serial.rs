use crate::config::BuilderConfig;
use crate::device::{Device, DeviceChannel, DeviceConfig, DeviceManager, DeviceRef};
use crate::err::{Error, ErrorKind};
use crate::device_pool;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serialport::SerialPort;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;

struct SerialChannel {
    port: Mutex<Box<dyn SerialPort>>,
}

impl Read for SerialChannel {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.port.lock().unwrap().read(buf)
    }
}

impl Write for SerialChannel {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.port.lock().unwrap().write(buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.port.lock().unwrap().flush()
    }
}

impl DeviceChannel for SerialChannel {
    fn available(&self) -> usize {
        self.port.lock().unwrap().bytes_to_read().unwrap_or(0) as usize
    }

    fn close(&mut self) {
        // Nothing to do
        // TODO future forcefully drop SerialPort?
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

    fn serialize(&self) -> Value { serde_json::to_value(self).unwrap() }
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
                    ErrorKind::SerialError(e.to_string()),
                    "Failed to open serial port.",
                )
            })?;

        let channel = Box::new(SerialChannel {
            port: Mutex::new(serial_port),
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
