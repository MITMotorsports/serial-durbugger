import React, {useEffect, useState} from "react";
import {SessionWindow} from "../../session_manager.tsx";
import {useAlerts} from "../../alert.tsx";
import {invoke} from "@tauri-apps/api/core";
import ConfigureProject from "../configure_project.tsx";
import Input from "../../component/input.tsx";

export interface WorkspaceItemProps {
    id: string;
    // workspace: WorkspaceInfo;
    onSelect: (workspace: string) => void;
}

const WorkspaceItem: React.FC<WorkspaceItemProps> = ({id, onSelect}) => (
    <button
        onClick={() => onSelect(id)}
        className="flex items-center w-full p-4 text-left border-b border-gray-200
                   hover:bg-gray-100 focus:outline-none focus:ring-2
                   focus:ring-indigo-500 focus:bg-gray-100 rounded-lg transition-colors duration-150"
    >
        {/* Icon placeholder - similar to IntelliJ 'H2' 'W' icons */}
        <div
            className="flex-shrink-0 w-10 h-10 bg-[#E0E0E0] rounded-lg flex items-center justify-center mr-4">
            <span className="text-xl font-bold text-gray-700">
                {id.charAt(0).toUpperCase()}
            </span>
        </div>
        <div>
            <p className="text-base font-semibold">{id}</p>
            {/*<p className="text-sm text-gray-500">{workspace.path}</p>*/}
        </div>
    </button>
);

export const WorkspaceListPage: React.FC<{ setPage: SessionWindow['setPage'] }> = ({setPage}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [allWorkspaces, setAllWorkspaces] = useState<string[]>([]);
    const [filteredWorkspaces, setFilteredWorkspaces] = useState<string[]>([]);
    const alerts = useAlerts();

    // Fetch workspaces on mount
    useEffect(() => {
        invoke<string[]>("workspace_ls").then(workspaces => {
            setAllWorkspaces(workspaces);
            setFilteredWorkspaces(workspaces);
        }).catch(err => {
            alerts.showAlert("error", `Failed to load workspaces: ${err.toString()}`);
        })
    }, [alerts]);

    // Filter workspaces based on search query
    useEffect(() => {
        if (!searchQuery) {
            setFilteredWorkspaces(allWorkspaces);
            return;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        const filtered = allWorkspaces.filter(ws =>
            ws.toLowerCase().includes(lowerCaseQuery) ||
            ws.toLowerCase().includes(lowerCaseQuery)
        );
        setFilteredWorkspaces(filtered);
    }, [searchQuery, allWorkspaces]);

    // Handle selecting an existing workspace
    const handleSelectWorkspace = async (workspace: string) => {
        try {
            setPage(ConfigureProject, {workspace: workspace});
        } catch (e: any) {
            alerts.showAlert("error", `Failed to open workspace: ${e.toString()}`);
        }
    };

    return (
        <div className="w-full">
            {/*Header Bar */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-300 space-x-4">
                {/* Search Bar */}
                <div className="w-full max-w-md relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                             strokeWidth={1.5} stroke="currentColor" className="size-5 text-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
                        </svg>
                    </div>
                    <Input
                        type="text"
                        placeholder="Search workspaces..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full" // Use the custom Input component
                    />
                </div>
            </div>

            {/* Workspace List */}
            <div className="overflow-y-auto p-4">
                <div className=" mx-auto">
                    <h1 className="text-xl font-bold mb-4">Recent Workspaces</h1>
                    <div className="flex flex-col space-y-1">
                        {filteredWorkspaces.length > 0 ? (
                            filteredWorkspaces.map(ws => (
                                <WorkspaceItem
                                    key={ws}
                                    id={ws}
                                    onSelect={handleSelectWorkspace}
                                />
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p>No workspaces found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
