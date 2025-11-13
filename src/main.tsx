import SessionManager from "./session_manager.tsx";
import React from "react";
import ReactDOM from "react-dom/client";
import {Tool} from "./widget/tool.ts";
import {ReadoutTimeline} from "./widget/readout/readout_timeline.tsx";
import {Raw} from "./widget/raw.tsx";
import {Readout} from "./widget/readout/readout.tsx";
import {ProjectManagerImpl, Projects} from "./device.tsx";
import {AlertProvider} from "./alert.tsx";
import {LogViewer} from "./widget/log/log_viewer.tsx";
import {CommandSender} from "./widget/command_panel.tsx";

export const toolRegistry: Tool[] = [
    ReadoutTimeline, Raw, Readout, LogViewer, CommandSender
]

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AlertProvider>
            <Projects.Provider value={new ProjectManagerImpl()}>
                <SessionManager/>
            </Projects.Provider>
        </AlertProvider>
    </React.StrictMode>,
);
