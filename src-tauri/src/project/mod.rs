mod drive;

use crate::config::BuilderConfig;
use crate::device::DeviceRef;
use crate::err::{Error, ErrorKind};
use std::collections::HashMap;
use std::process::id;
use std::sync::atomic::AtomicU64;
use std::sync::Mutex;
use tauri::{command, generate_handler, State};
use crate::device_pool;

pub type Projects = Mutex<HashMap<u64, Project>>;

static REF_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub struct Project {
    id: u64,
    workspace: String,
    device: Option<DeviceRef>,
}

impl Project {
    pub fn new(workspace: String, device: Option<DeviceRef>) -> Project {
        Project {
            id: REF_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst),
            workspace,
            device,
        }
    }
}

impl<R: tauri::Runtime> BuilderConfig<R> {
    pub fn project(self) -> BuilderConfig<R> {
        self.register_commands(
            generate_handler![
                new_project,
                device_write,
                close_project,
                close_all_projects,
                drive::open_device,
                push_device
            ],
            &[
                "new_project",
                "device_write",
                "close_project",
                "close_all_projects",
                "open_device",
                "push_device"
            ],
        )
        .fold(|b| b.manage(Mutex::new(HashMap::new()) as Projects))
    }
}

#[command]
fn new_project(
    workspace: String,
    reference: Option<DeviceRef>,
    projects: State<Projects>,
) -> Result<u64, Error> {
    let project = Project::new(workspace, reference);

    let id = project.id;
    projects.lock().unwrap().insert(id, project);

    Ok(id)
}

#[command]
fn push_device(
    project: u64,
    reference: DeviceRef,
    projects: State<Projects>,
) -> Result<(), Error> {
    let mut guard = projects.lock().unwrap();
    let project = guard.get_mut(&project).ok_or(Error::new(
        ErrorKind::NoSuchProject,
        "Failed to find this project",
    ))?;

    project.device = Some(reference);

    Ok(())
}

#[command]
fn device_write(project_id: u64, buf: Vec<u8>, projects: State<Projects>) -> Result<(), Error> {
    let guard = projects.lock().unwrap();
    let project = guard
        .get(&project_id)
        .ok_or_else(|| Error::new(ErrorKind::NoSuchProject, "Cannot find this project."))?;

    if let Some(d_ref) = project.device.as_ref() {
        if let Some(x) = d_ref.use_device(|d| d.write(buf.as_slice())) {
            x?;
        }
    }


    Ok(())
}

#[command]
fn close_project(project_id: u64, projects: State<Projects>) -> Result<(), Error> {
    let mut guard = projects.lock().unwrap();

    println!("Projects: {:?}", guard);
    guard.remove(&project_id);
    println!("Projects: {:?}", guard);

    Ok(())
}

#[command]
fn close_all_projects(projects: State<Projects>) -> Result<(), Error> {
    let mut guard = projects.lock().unwrap();

    println!("Closing all projects ({})", guard.len());

    guard.iter().for_each(|(_, p)| {
        println!(
            "Closing project({:?}), rc at {:?}",
            p.device.as_ref().map(|d| d.id()),
            p.device.as_ref().map(|d| d.rc()),
        )
    });

    guard.clear();
    println!("--- Open Devices ---");
    println!("{:?}", device_pool!().list());

    Ok(())
}
