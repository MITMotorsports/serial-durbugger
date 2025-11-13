mod route;

use std::fmt::Display;
use crate::config::BuilderConfig;
use crate::err::Error;
use serde::Serialize;
use std::io::{Cursor, Read};
use std::sync::Mutex;
use tauri::generate_handler;

/**
Command examples:

[log warn/info/error ""]     # logging
[help [--schema]]       # readable scheme, or send back schema
[set_schema <schema>]        # computer readable set
[number <id> <value>]        #
*/

impl<R: tauri::Runtime> BuilderConfig<R> {
    pub fn commands(self) -> BuilderConfig<R> {
        // self
        // .register_commands(generate_handler![
        //     route::poll_commands,
        // ], &["poll_commands"])
        // .register_sink_factory(|| Box::new(CommandParser { buffer: vec![] }))
        self
    }
}

#[derive(Serialize, Clone)]
pub struct Command {
    pub action: String,
    pub arguments: Vec<String>,
}

impl Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", format!("Command [{} -> {}]", self.action, self.arguments.join(", ")))
    }
}

pub trait CommandHandler {
    fn action(&self) -> String;

    fn handle(&self, command: &Command);
}

pub struct CommandParser {
    buffer: Vec<u8>,
}
//
// impl DataSink for CommandParser {
//     fn sink(&mut self, buf: &[u8]) -> Result<(), Error> {
//         self.buffer.extend_from_slice(buf);
//
//         Ok(())
//     }
// }

impl CommandParser {
    pub fn new() -> CommandParser {
        CommandParser { buffer: Vec::new() }
    }

    pub fn extend(&mut self, buf: &[u8]) -> Result<(), Error> {
        self.buffer.extend_from_slice(buf);

        Ok(())
    }

    pub fn parse(&mut self) -> Option<Command> {
        let start = if let Some(start) = self.buffer.iter().position(|b| *b == b'[') {
            start
        } else {
            self.buffer.clear();

            return None;
        };

        self.buffer.drain(..=start); // Dont care about these bytes
        let end = self.buffer.iter().position(|b| *b == b']')?;

        let str = String::from_utf8(self.buffer[..end].to_vec()).ok()?;

        let parts = str.split(' ').into_iter().collect::<Vec<&str>>();

        let action = parts.first()?.to_string();

        let command = Command {
            action,
            arguments: if (parts.len() == 1) {
                vec![]
            } else {
                parts[1..].iter().map(|s| s.to_string()).collect()
            },
        };

        Some(command)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parsing() {
        let mut parser = CommandParser::new();

        let text = "asdf [hey do this!] slakdjf";
        parser.extend(text.as_bytes()).unwrap();
        let command = parser.parse().unwrap();
        assert_eq!(command.action, "hey");
        assert_eq!(command.arguments, vec!["do", "this!"]);
    }
}
