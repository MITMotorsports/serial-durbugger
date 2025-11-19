use crate::config::BuilderConfig;
use crate::err::Error;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Wry, generate_handler};
use tauri_plugin_updater::UpdaterExt;

impl BuilderConfig<Wry> {
    pub fn update_handler(self) -> BuilderConfig<Wry> {
        self.register_commands(generate_handler![update], &["update"])
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum UpdateStatus {
    Downloading { value: f64 },
    Installing,
    Error(String),
    Done,
}

// Returns false if there is no update.
#[tauri::command]
pub async fn update(
    app: AppHandle,
    // app: AppHandle,
    channel: Channel<UpdateStatus>,
) -> Result<bool, Error> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;
        let mut length = 0;
        let bytes = update
            .download(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    if let Some(len) = content_length {
                        length = len;
                    }
                    channel
                        .send(UpdateStatus::Downloading {
                            value: (downloaded as f64) / (length as f64),
                        })
                        .expect("Failed to send Progress to channel");
                },
                || {
                    channel
                        .send(UpdateStatus::Downloading {
                            value: 1f64,
                        })
                        .expect("Failed to send Done to channel");
                },
            )
            .await?;
        
        channel.send(UpdateStatus::Installing).expect("Failed to send Installing");
        update.install(bytes)?;
        channel.send(UpdateStatus::Done).expect("Failed to send Done");

        app.restart();
    };

    Ok(false)
}
