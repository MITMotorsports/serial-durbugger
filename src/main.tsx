import SessionManager from "./session_manager.tsx";
import ReactDOM from "react-dom/client";
import {WidgetHandler} from "./widget/widget.ts";
import {ReadoutTimeline} from "./widget/readout/readout_timeline.tsx";
import {Raw} from "./widget/raw.tsx";
import {Readout} from "./widget/readout/readout.tsx";
import {ProjectManagerImpl, Projects} from "./device.tsx";
import {AlertProvider} from "./alert.tsx";
import {LogViewer} from "./widget/log/log_viewer.tsx";
import {CommandSender} from "./widget/command_panel.tsx";
import {invoke} from "@tauri-apps/api/core";

export const toolRegistry: WidgetHandler<any>[] = [
    ReadoutTimeline, Raw, Readout, LogViewer, CommandSender
]

invoke("close_all_projects").then(() => {
    console.log("All projects successfully closed.")
})

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    // TODO decide if we want strict mode. Currently the double rendering is causing device open/close problems in useEffect.
    // <React.StrictMode>
        <AlertProvider>
            {/*<UpdateHelper>*/}
                <Projects.Provider value={new ProjectManagerImpl()}>
                    <SessionManager/>
                </Projects.Provider>
            {/*</UpdateHelper>*/}
        </AlertProvider>
    // </React.StrictMode>,
);
