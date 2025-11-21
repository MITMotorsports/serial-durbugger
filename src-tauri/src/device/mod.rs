use crate::config::{BuilderConfig, Configuration};
use crate::device_pool;
use crate::err::{Error, ErrorKind};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::AtomicU64;
use tauri::{generate_handler, Builder, Runtime};

mod mock;
pub mod serial;

///
/// A representation of all currently open sockets
///
pub mod pool {
    use crate::device::{Device, DeviceRef};
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex, OnceLock};

    type RefId = u64;

    pub static DEVICE_POOL: OnceLock<Arc<Mutex<DevicePool>>> = OnceLock::new();

    #[macro_export]
    macro_rules! device_pool {
        () => {{
            use $crate::device::pool::DEVICE_POOL;

            let guard = DEVICE_POOL.get().unwrap().lock().unwrap();
            guard
        }};
    }

    pub struct DevicePool {
        devices: HashMap<RefId, Inner>,
    }

    struct Inner {
        device: Option<Device>,
        ref_counter: u8,
    }

    impl DevicePool {
        pub(crate) fn new() -> Arc<Mutex<DevicePool>> {
            Arc::new(Mutex::new(DevicePool {
                devices: Default::default(),
            }))
        }

        pub fn register(&mut self, device: Device, reference: &DeviceRef) {
            // let name = device.name.clone();
            let inner = Inner {
                device: Some(device),
                ref_counter: 1,
            };

            self.devices.insert(reference.id, inner);
        }

        pub fn push(&mut self, reference: &DeviceRef) -> bool {
            let inner = if let Some(inner) = self.devices.get_mut(&reference.id) {
                inner
            } else {
                return false;
            };

            inner.ref_counter += 1;

            // println!("Device ({}), new RC: {})",&reference.id, inner.ref_counter);

            true
        }

        pub fn close(&mut self, reference: &DeviceRef) -> Option<Device> {
            let remove = if let Some(d) = self.devices.get_mut(&reference.id) {
                d.ref_counter -= 1;

                println!("Device ({}), new RC: {})",&reference.id, d.ref_counter);

                d.ref_counter == 0
            } else {
                false
            };

            if remove {
                if let Some(mut d) = self.devices.remove(&reference.id) {
                    return d.device.take();
                }
            }

            None
        }

        pub fn rc(&mut self, reference: &DeviceRef) -> u8 {
            if let Some(inner) = self.devices.get_mut(&reference.id) {
                inner.ref_counter
            } else {
                0
            }
        }

        pub fn use_device<F, T>(&mut self, reference: &DeviceRef, block: F) -> Option<T>
        where
            F: FnOnce(&mut Device) -> T,
        {
            if let Some(inner) = self.devices.get_mut(&reference.id) {
                if let Some(x) = inner.device.as_mut() {
                    Some(block(x))
                } else {
                    None
                }
            } else {
                None
            }
        }

        pub fn list(&self) -> Vec<RefId> {
            self.devices.iter().filter(|(k, v)| {
                v.ref_counter != 0 && v.device.is_some()
            }).map(|k| k.0.clone()).collect()
        }
    }
}

///
/// Options:
///  - Device ref references the device itself and holds state about closure
///  - Device ref holds pointer to manager + calls close if need be.
///  -
///
static REF_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Debug)]
pub struct DeviceRef {
    id: u64,
}

impl<'r> Deserialize<'r> for DeviceRef {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'r>,
    {
        #[derive(Deserialize)]
        struct ProxyType { id: u64, }

        let id = ProxyType::deserialize(deserializer)?.id;

        let reference = DeviceRef { id };
        device_pool!().push(&reference);

        Ok(reference)
    }
}

impl Drop for DeviceRef {
    fn drop(&mut self) {
        self.close()
    }
}

impl Clone for DeviceRef {
    fn clone(&self) -> Self {
        let new = DeviceRef { id: self.id };

        device_pool!().push(&new);

        new
    }
}

impl DeviceRef {
    pub fn new() -> DeviceRef {
        DeviceRef {
            id: REF_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst),
        }
    }

    pub fn id(&self) -> u64 {
        self.id
    }

    pub fn rc(&self) -> u8 {
        device_pool!().rc(&self)
    }

    pub fn use_device<F, T>(&self, block: F) -> Option<T>
    where
        F: FnOnce(&mut Device) -> T,
    {
        device_pool!().use_device(self, block)
    }

    pub fn close(&mut self) {
        if let Some(mut d) = device_pool!().close(self) {
            d.channel.close()
        }
    }
}

pub trait DeviceConfig: Send + Sync {
    fn name(&self) -> String;

    fn serialize(&self) -> Value;
}

pub trait DeviceManager: Send + Sync {
    fn sort(&self) -> &'static str;

    fn open(&self, config: Value) -> Result<DeviceRef, Error>;

    fn available(&self) -> Vec<String>;
}

pub type DeviceManagers = HashMap<String, Box<dyn DeviceManager>>;

///
/// Configuration for device managers
///

struct DeviceManagerConfig {
    device_managers: HashMap<String, Box<dyn DeviceManager>>,
}

impl<R: Runtime> Configuration<R> for DeviceManagerConfig {
    fn configure(self: Box<Self>, builder: Builder<R>) -> Builder<R> {
        builder.manage(self.device_managers)
    }
}

impl<R: Runtime> BuilderConfig<R> {
    pub fn register_device_manager(self, manager: Box<dyn DeviceManager>) -> Self {
        self.register_config("device_manager", || {
            Box::new(DeviceManagerConfig {
                device_managers: Default::default(),
            })
        })
        .get_config::<DeviceManagerConfig>("device_manager", |mut c| {
            c.device_managers
                .insert(manager.sort().to_string(), manager);
            c
        })
    }
}

mod routes {
    use crate::device::DeviceManagers;
    use tauri::State;

    #[tauri::command]
    pub fn device_available(sort: String, manager: State<DeviceManagers>) -> Vec<String> {
        manager.get(&sort).map_or(Vec::new(), |m| m.available())
    }
}

///
/// Configuration for general socket integration with Tauri
///
impl<R: Runtime> BuilderConfig<R> {
    pub fn device(self) -> BuilderConfig<R> {
        self.register_config("device_manager", || {
            Box::new(DeviceManagerConfig {
                device_managers: Default::default(),
            })
        })
        .register_commands(
            generate_handler![
                routes::device_available,
                // routes::device_open,
                // routes::device_write,
                // routes::device_close
            ],
            &[
                "device_available",
                // "device_open",
                // "device_write",
                // "device_close",
            ],
        )
    }
}

///
/// A raw read/write connection to a physical or virtual socket
///
pub trait DeviceChannel: Send + Sync + Read + Write {
    fn available(&self) -> std::io::Result<usize>;

    fn close(&mut self);
}

///
/// A smart pointer wrapper to the internal device, provides
/// utilities to interact with the underlying type.
///
pub struct Device {
    pub name: String,
    channel: Box<dyn DeviceChannel>,
    config: Box<dyn DeviceConfig>,
}

impl Device {
    pub fn new(
        name: String,
        channel: Box<dyn DeviceChannel>,
        config: Box<dyn DeviceConfig>,
    ) -> Self {
        Device {
            name,
            channel,
            config,
        }
    }

    pub fn read_available(&mut self) -> Result<Vec<u8>, Error> {
        let available = self.channel.available()?;

        // Available is not always reliable
        if available == 0 {
            // available = 64
            return Ok(vec![]);
        }

        let mut vec = vec![0u8; available]; // Vec::with_capacity(self.channel.available());

        self.read(&mut vec)?;

        Ok(vec)
    }

    // pub fn available(&mut self) -> usize {
    //    self.channel.available()
    // }

    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, Error> {
        Ok(self.channel.read(buf)?)
    }

    pub fn write(&mut self, buf: &[u8]) -> Result<usize, Error> {
        Ok(self.channel.write(buf)?)
    }

    pub fn flush(&mut self) -> Result<(), Error> {
        Ok(self.channel.flush()?)
    }
}

#[cfg(test)]
mod tests {
    use crate::device::mock::{MockChannel, MockConfig};
    use crate::device::pool::{DevicePool, DEVICE_POOL};
    use crate::device::{Device, DeviceRef};
    use crate::device_pool;

    #[test]
    fn test_rc() {
        DEVICE_POOL.set(DevicePool::new());

        let dev = Device::new(
            "test".to_string(),
            Box::new(MockChannel {}),
            Box::new(MockConfig {
                name: "test".to_string(),
            }),
        );

        let mut ref1 = DeviceRef::new();

        device_pool!().register(dev, &ref1);
        assert_eq!(ref1.rc(), 1);

        let mut ref2 = ref1.clone();
        assert_eq!(ref1.rc(), 2);

        ref1.close();
        assert_eq!(ref1.rc(), 1);

        ref2.close();
        assert_eq!(ref1.rc(), 0);
    }
}
