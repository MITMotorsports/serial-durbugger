// use crate::command::{Command, CommandParser};
// use crate::err::{Error, ErrorKind};
// use crate::device::{DeviceManagers, DevicePool};
// use std::sync::Mutex;
// use tauri::State;
// use crate::sink::Aggregators;
// 
// // pub(in crate::command) struct CommandCursor {
// //     internal: Mutex<usize>,
// // }
// // 
// // impl CommandCursor {
// //     pub fn new() -> CommandCursor {
// //         CommandCursor {
// //             internal: Mutex::new(0),
// //         }
// //     }
// // 
// //     pub fn query(&self) -> usize {
// //         self.internal.lock().unwrap().clone()
// //     }
// // 
// //     pub fn update(&self, incr: usize) {
// //         *self.internal.lock().unwrap() += incr;
// //     }
// // }
// 
// #[tauri::command]
// pub fn poll_commands(
//     sort: String,
//     device: String,
// 
//     aggregators: State<Aggregators>,
// ) -> Result<Vec<Command>, Error> {
//     if let Some(agg) =  aggregators.lock().unwrap().get_mut(&(sort, device.clone())) {
//          let parser = agg.use_sink::<CommandParser>().ok_or_else(|| {
//              Error::new(ErrorKind::NoSinkFound, "Internal error: Failed to find a command sink.")
//          })?;
// 
//         let mut output = Vec::<Command>::new();
// 
//         loop {
//             let current = parser.parse();
// 
//             if current.is_none() {
//                 break;
//             }
// 
//             output.push(current.unwrap());
//         }
// 
//         Ok(output)
//     } else {
//         Err(Error::new(ErrorKind::NoOpenDevice(device), "This device is not open"))
//     }
// }
