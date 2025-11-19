use std::env::home_dir;
use std::path::PathBuf;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use crate::config::BuilderConfig;
use tauri::Wry;
use crate::device::pool::{DevicePool, DEVICE_POOL};

mod config;
mod workspace;
pub mod command;
pub mod device;
pub mod any;
pub mod drive;
pub mod err;
pub mod project;
mod update;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Ok(_) = DEVICE_POOL.set(DevicePool::new()) {
        // Rust not throwing warnings
    }

    let home = homedir::my_home().unwrap_or_else(|_| None).unwrap_or_else(|| PathBuf::from("dat/"))
        .join(".serialdebugger");

    let workspace_path = home.join("workspace");

    BuilderConfig::<Wry>::new()
        .update_handler()
        .commands()
        .device()
        .serial()
        .mock()
        .drive(50)
        .workspace(workspace_path) // Poll every 50 ms
        .project()
        .build()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

