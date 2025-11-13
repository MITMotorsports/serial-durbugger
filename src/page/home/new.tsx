import React, {useState} from "react";
import {SessionWindow} from "../../session_manager.tsx";
import {useAlerts} from "../../alert.tsx";
import {invoke} from "@tauri-apps/api/core";
import ConfigureProject from "../configure_project.tsx";
import KebabInput from "../../component/kebab_input.tsx";
import Button from "../../component/button.tsx";

export const NewWorkspacePage: React.FC<{ setPage: SessionWindow['setPage'] }> = ({setPage}) => {
    const [newWorkspaceId, setNewWorkspaceId] = useState("");
    const alerts = useAlerts();

    const handleNewWorkspace = () => {
        if (!newWorkspaceId.trim()) {
            alerts.showAlert("warning", "Please enter a workspace name.");
            return;
        }

        invoke("workspace_push", {
            workspace: {
                id: newWorkspaceId,
                widgets: []
            }
        }).then(() => {
            setPage(ConfigureProject, {workspace: newWorkspaceId});
        }).catch((err) => {
            alerts.showAlert("error", `${err}`);
        })
    };

    return (
        <div className="flex-1 p-8">
            <h1 className="text-3xl font-extrabold mb-6">Create New Workspace</h1>

            <div className="p-6 border border-gray-300 rounded-lg">
                <div className="flex items-center space-x-2">
                    <KebabInput
                        type="text"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleNewWorkspace();
                            }
                        }}
                        placeholder="New workspace name..."
                        value={newWorkspaceId}
                        onChange={(e) => setNewWorkspaceId(e.target.value)}
                        className="text-sm w-full" // Using the custom Input component
                    />
                    <Button
                        onClick={handleNewWorkspace}
                        className="inline bg-[#4CAF50] hover:bg-[#45a049] text-white px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap"
                    >
                        Create Blank
                    </Button>
                </div>
            </div>
            <div className="p-6 my-4 border border-gray-300 rounded-lg">
                <Button onClick={() => {
                    invoke("open_workspace_folder").then(() => {
                        alerts.showAlert("info", "Folder opened.");
                    })
                }}>
                    Open Workspaces Folder
                </Button>
            </div>
        </div>
    );
};
