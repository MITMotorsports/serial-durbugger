use crate::config::BuilderConfig;
use crate::device::{Device, DeviceChannel, DeviceConfig, DeviceManager, DeviceRef};
use crate::device_pool;
use crate::err::{Error, ErrorKind};
use rand::prelude::SliceRandom;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io;
use std::io::{Read, Write};
use rand::{random, Rng};

#[derive(Deserialize, Serialize)]
pub struct MockConfig {
    pub name: String,
}

impl DeviceConfig for MockConfig {
    fn name(&self) -> String {
        self.name.clone()
    }

    fn serialize(&self) -> Value { serde_json::to_value(self).unwrap() }
}

pub struct MockDeviceManager {}

impl DeviceManager for MockDeviceManager {
    fn sort(&self) -> &'static str {
        "mock"
    }

    fn open(&self, config: Value) -> Result<DeviceRef, Error> {
        let config = serde_json::from_value::<MockConfig>(config).map_err(|_| {
            Error::new(
                ErrorKind::InvalidConfig,
                "Internal error: the config passed to this handler is not valid",
            )
        })?;

        let channel = Box::new(MockChannel {});
        let device = Device::new(
            config.name.clone(),
            channel,
            Box::new(config)
        );

        let reference = DeviceRef::new();
        device_pool!().register(device, &reference);

        Ok(reference)
    }

    fn available(&self) -> Vec<String> {
        vec!["mock".to_string()]
    }
}

impl<R: tauri::Runtime> BuilderConfig<R> {
    pub fn mock(self) -> BuilderConfig<R> {
        self.register_device_manager(Box::new(MockDeviceManager {}))
    }
}

pub struct MockChannel {}

impl Read for MockChannel {
    fn read(&mut self, mut buf: &mut [u8]) -> io::Result<usize> {
        // buf.write(format!("idk$={}\n", random::<f64>()).as_bytes())?;
        // buf.write(format!("poop$={}\n", random::<f64>()).as_bytes())?;
        // buf.write("[ERROR Time: 1678886400 File: database/connect.ts Line: 121] Failed to establish database connection: timeout.\n".as_bytes())?;

        let mut rng = rand::thread_rng();

        // if rng.gen_bool(0.0001) {
        //     return Err(io::Error::new(io::ErrorKind::Other, "mock channel closed"))
        // }

        // Static data for generating varied logs
        const LEVELS: &[&str] = &["ERROR", "WARN", "INFO", "DEBUG"];
        const FILES: &[&str] = &["src/main.rs", "database/connect.ts", "api/user.rs", "core/engine.rs"];
        const MESSAGES: &[&str] = &[
            "Failed to establish database connection: timeout.",
            "User login attempt failed: invalid credentials.",
            "Request processed successfully.",
            "Cache hit for key: user_session_123",
            "Starting background task: data_cleanup",
            "High memory usage detected.",
        ];

        // Randomly decide which log format to use
        let log_line = if rng.gen_bool(0.7) {
            // 70% chance of a standard formatted log
            let level = LEVELS[rng.gen_range(0..LEVELS.len())];
            let file = FILES[rng.gen_range(0..FILES.len())];
            let line = rng.gen_range(10..300);
            let timestamp = 1678886400 + rng.gen_range(0..86400); // Random time
            let message = MESSAGES[rng.gen_range(0..MESSAGES.len())];

            format!("[{level} Time: {timestamp} File: {file} Line: {line}] {message}\n")
        } else {
            const COMPONENTS: &[&str] = &[
                "motor_speed",
                "fan_level",
                "fan_speed",
                "torque",
                "battery_level",
                "ground_speed"
            ];

            let key = COMPONENTS[rng.gen_range(0..COMPONENTS.len())];
            format!("{key} = {}\n", random::<f64>())
        };

        // Write the generated string as bytes into the buffer
        // This will return Ok(bytes_written) or Err
        buf.write(log_line.as_bytes())
        // if buf.is_empty() {
        //     return Ok(0);
        // }
        //
        // const ACTIONS: &[&str] = &[
        //     "Initialized system",
        //     "Connecting to server",
        //     "Disconnected",
        //     "Performing handshake",
        //     "Reading config",
        //     "Updating cache",
        //     "Flushing buffer",
        //     "Starting background task",
        //     "Reconnecting",
        //     "Writing data",
        //     "Shutting down",
        //     "Compiling resources",
        //     "Processing request",
        //     "Authenticating user",
        //     "Checking status",
        //     "Cleaning up temporary files",
        //     "Validating input",
        //     "Saving state",
        //     "Restarting service",
        //     "Completed successfully",
        // ];
        //
        // let mut rng = rand::thread_rng();
        // let mut out = Vec::with_capacity(buf.len());
        //
        // while out.len() + 6 < buf.len() {
        //     // "[log ]\n" = 6 chars minimum
        //     let msg = ACTIONS.choose(&mut rng).unwrap();
        //     let log_line = format!("[log {}]\n", msg);
        //
        //     // Stop before writing if it won’t fit
        //     if out.len() + log_line.len() > buf.len() {
        //         break;
        //     }
        //
        //     out.extend_from_slice(log_line.as_bytes());
        // }
        //
        // buf[..out.len()].copy_from_slice(&out);

    }
}

impl Write for MockChannel {
    fn write(&mut self, _: &[u8]) -> io::Result<usize> {
        Ok(0)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl DeviceChannel for MockChannel {
    fn available(&self) -> std::io::Result<usize> {
        Ok(256)
    }

    fn close(&mut self) {
        // Nothing to do
    }
}
