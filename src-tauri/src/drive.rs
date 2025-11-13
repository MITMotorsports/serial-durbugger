use crate::config::BuilderConfig;
use crate::err::Error;
use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::thread::sleep;
use std::time::Duration;
use tauri::Runtime;

impl<R: Runtime> BuilderConfig<R> {
    pub fn drive(self, rate: u64) -> Self {
        self.fold(|b| {
            let vehicle = Vehicle::new(rate);
            vehicle.start();
            b.manage(vehicle)
        })
    }
}

pub trait Drive: Send + Sync {
    fn drive(&mut self) -> Result<bool, Error>;
}

pub struct Vehicle {
    channel: Arc<Mutex<(Sender<VehicleEvent>, Option<Receiver<VehicleEvent>>)>>,
    rate: u64,
}

enum VehicleEvent {
    Register(Box<dyn Drive>),
    // Unregister(String)
    Stop,
}

impl Vehicle {
    fn new(rate: u64) -> Vehicle {
        let (sender, receiver) = mpsc::channel();

        Vehicle {
            channel: Arc::new(Mutex::new((sender, Some(receiver)))),
            rate,
        }
    }

    pub fn register<T: 'static + Drive>(&self, drive: T) {
        self.channel
            .lock()
            .unwrap()
            .0
            .send(VehicleEvent::Register(Box::new(drive)))
            .expect("Failed to register vehicle"); // Will never happen
    }

    pub fn stop(&self) {
        self.channel
            .lock()
            .unwrap()
            .0
            .send(VehicleEvent::Stop)
            .expect("Failed to stop vehicle"); // Will never happen
    }

    pub fn start(&self) {
        let receiver = self.channel.lock().unwrap().1.take().unwrap();

        let rate = self.rate;
        thread::spawn(move || {
            let receiver = receiver;

            let mut vehicles: Vec<Box<dyn Drive>> = Vec::new();

            loop {
                // Remove all vehicles
                vehicles.retain_mut(|vehicle| {
                    match vehicle.drive() {
                        Err(e) => {
                            println!("Failed to drive vehicle: {:?}", e);
                            false
                        }
                        Ok(ok) => { ok }
                    }
                });

                match receiver.try_recv() {
                    Ok(update) => match update {
                        VehicleEvent::Register(v) => {
                            vehicles.push(v);
                        }
                        VehicleEvent::Stop => return,
                    },
                    Err(err) => match err {
                        TryRecvError::Empty => {}
                        TryRecvError::Disconnected => {
                            return;
                        }
                    },
                }

                sleep(Duration::from_millis(rate));
            }
        });
    }
}
