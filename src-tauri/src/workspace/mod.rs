use crate::config::BuilderConfig;
use crate::drive::{Drive, Vehicle};
use crate::err::Error;
use crate::err::ErrorKind::{IO, SerdeError};
use crate::workspace::routes::SavePath;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;
use std::fs::{DirEntry, File};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use std::{fs, io};
use tauri::{Manager, generate_handler};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Workspace {
    pub id: String,
    pub widgets: Vec<Widget>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Widget {
    pub pos: Position,
    pub behavior: WidgetBehavior,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WidgetBehavior {
    #[serde(rename_all = "camelCase")]
    Readout { components: Vec<String> },
    #[serde(rename_all = "camelCase")]
    ReadoutTimeline { components: Vec<String> },
    #[serde(rename_all = "camelCase")]
    Raw {},
    #[serde(rename_all = "camelCase")]
    LogViewer {},
    #[serde(rename_all = "camelCase")]
    CommandPanel { schema: Vec<CommandDefinition> },
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub struct CommandParameter {
    pub id: u64,
    pub display_name: String,
    #[serde(rename = "type")]
    pub value_type: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub struct CommandDefinition {
    id: String,
    name: String,
    icon: String,
    parameters: Vec<CommandParameter>,
}

impl WidgetBehavior {
    // pub fn tool(&self) -> String {
    //     match self {
    //         PanelBehavior::Readout { id, ... } => {}
    //         PanelBehavior::Stateless { .. } => {}
    //     }
    // }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Position {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct WorkspaceHandler {
    workspaces: HashMap<String, Workspace>,
}

impl WorkspaceHandler {
    pub fn from<P: Into<PathBuf>>(path: P) -> Result<WorkspaceHandler, Error> {
        let path = path.into();
        let files = if path.exists() {
            fs::read_dir(path.clone())?.collect::<Result<Vec<DirEntry>, io::Error>>()?
        } else {
            Vec::new()
        };

        let mut workspaces: HashMap<String, Workspace> = HashMap::new();

        for x in files {
            let path = x.path();

            let file = File::open(path)?;
            let workspace: Workspace = serde_json::from_reader(file)?;

            workspaces.insert(workspace.id.clone(), workspace);
        }

        Ok(WorkspaceHandler { workspaces })
    }

    pub fn save<P: Into<PathBuf>>(&mut self, path: P) -> Result<(), Error> {
        let path = path.into();

        if !path.exists() {
            fs::create_dir_all(path.clone())?;
        }

        for (name, workspace) in self.workspaces.iter() {
            let path = path.join(format!("{}.json", name));

            let output = serde_json::to_vec_pretty(&workspace)?;

            fs::write(path.clone(), output)?;
        }

        Ok(())
    }
}

struct WorkspaceDriver {
    handler: Arc<Mutex<WorkspaceHandler>>,
    last_update: Instant,
    path: PathBuf,
}

impl Drive for WorkspaceDriver {
    fn drive(&mut self) -> Result<bool, Error> {
        let now = Instant::now();

        if now.duration_since(self.last_update).as_secs() > 5 {
            self.handler.lock().unwrap().save(self.path.clone())?;
            self.last_update = now;
        }

        Ok(true)
    }
}

impl<R: tauri::Runtime> BuilderConfig<R> {
    pub fn workspace<T: Into<PathBuf>>(self, path: T) -> BuilderConfig<R> {
        let path = path.into();
        let handler = Arc::new(Mutex::new(
            WorkspaceHandler::from(path.clone()).expect("Failed to load workspaces."),
        ));

        self.register_commands(
            generate_handler![
                routes::workspace_push,
                routes::workspace_ls,
                routes::workspace_get,
                routes::open_workspace_folder
            ],
            &[
                "workspace_push",
                "workspace_ls",
                "workspace_get",
                "open_workspace_folder",
            ],
        )
        .fold(|b| {
            b.manage(handler.clone())
                .manage(SavePath { path: path.clone() })
                .setup(|app| {
                    app.state::<Vehicle>().register(WorkspaceDriver {
                        handler,
                        last_update: Instant::now(),
                        path,
                    });

                    Ok(())
                })
        })
    }
}

mod routes {
    use crate::workspace::{Workspace, WorkspaceHandler};
    use opener::open;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use tauri::State;

    pub struct SavePath {
        pub path: PathBuf,
    }

    #[tauri::command]
    pub fn open_workspace_folder(path: State<'_, SavePath>) {
        open(path.path.clone()).expect("Failed to open path.")
    }

    #[tauri::command]
    pub fn workspace_push(workspace: Workspace, handler: State<'_, Arc<Mutex<WorkspaceHandler>>>) {
        handler
            .lock()
            .unwrap()
            .workspaces
            .insert(workspace.id.clone(), workspace);
    }

    #[tauri::command]
    pub fn workspace_ls(handler: State<'_, Arc<Mutex<WorkspaceHandler>>>) -> Vec<String> {
        handler
            .lock()
            .unwrap()
            .workspaces
            .iter()
            .map(|l| l.0.clone())
            .collect()
    }

    #[tauri::command]
    pub fn workspace_get(
        id: String,
        handler: State<'_, Arc<Mutex<WorkspaceHandler>>>,
    ) -> Option<Workspace> {
        handler.lock().unwrap().workspaces.get(&id).cloned()
    }
}
