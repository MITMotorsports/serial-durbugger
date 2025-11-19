use crate::any::CoerceAny;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::ipc::Invoke;
use tauri::{Builder, Runtime, Wry};

pub struct BuilderConfig<R: Runtime> {
    builder: Builder<R>,
    config: HashMap<&'static str, Box<dyn Configuration<R>>>,
}

pub trait Configuration<R: Runtime>: CoerceAny {
    fn configure(self: Box<Self>, builder: Builder<R>) -> Builder<R>;
}

impl<R: Runtime> BuilderConfig<R> {
    pub fn fold<F>(self, f: F) -> Self
    where
        F: FnOnce(Builder<R>) -> Builder<R>,
    {
        let config = self.config;

        let builder = f(self.builder);

        BuilderConfig {
            builder,
            config,
        }
    }

    pub fn get_config<T: 'static>(mut self, name: &'static str, call: impl FnOnce(T) -> T) -> Self
    where
        T: Configuration<R>,
    {
        if let Some(x) = self.config.remove(&name) {
            if let Ok(x) = x.into_any().downcast::<T>() {
                let ret = call(*x);

                self.config.insert(name, Box::new(ret));
            }
        }

        self
    }

    pub fn register_config(
        mut self,
        name: &'static str,
        config: impl FnOnce() -> Box<dyn Configuration<R>>,
    ) -> BuilderConfig<R> {
        if !self.config.contains_key(name) {
            self.config.insert(name, config());
        }

        self
    }

    pub fn build(self) -> Builder<R> {
        let mut fold = self.builder;
        for (_, x) in self.config.into_iter() {
            fold = x.configure(fold);
        }

        fold
    }
}

///
/// Configuration for Tauri Commands
///
struct CommandConfiguration<R: Runtime> {
    commands: Arc<
        Mutex<
            Vec<(
                HashSet<&'static str>,
                Box<dyn Fn(Invoke<R>) -> bool + Send + Sync + 'static>,
            )>,
        >,
    >,
}

impl<R: Runtime> Configuration<R> for CommandConfiguration<R> {
    fn configure(self: Box<Self>, builder: Builder<R>) -> Builder<R> {
        let commands = Arc::clone(&self.commands);

        builder.invoke_handler(move |invoke| {
            let target = invoke.message.command();

            for (commands, handler) in commands.lock().unwrap().iter() {
                if commands.contains(target) {
                    return handler(invoke);
                }
            }
            true
        })
    }
}

impl<R: Runtime> BuilderConfig<R> {
    pub fn register_commands<F>(self, invoke_handler: F, commands: &[&'static str]) -> Self
    where
        F: Fn(Invoke<R>) -> bool + Send + Sync + 'static,
    {
        self.register_config(
            "commands",
            || Box::new(CommandConfiguration {
                commands: Arc::new(Mutex::new(vec![])),
            }),
        )
        .get_config::<CommandConfiguration<R>>("commands", |c| {
            c.commands.lock().unwrap().push((
                HashSet::from_iter(commands.iter().copied()),
                Box::new(invoke_handler),
            ));

            c
        })
    }
}

impl BuilderConfig<Wry> {
    pub fn new() -> Self {
        BuilderConfig {
            builder: Builder::new()
                .plugin(tauri_plugin_opener::init())
                .plugin(tauri_plugin_updater::Builder::new().build()),
            config: HashMap::new(),
        }
    }
}
