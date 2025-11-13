import React, {ReactNode, useEffect, useState} from 'react';
import {SessionWindow} from "../../session_manager.tsx";
import {WorkspaceListPage} from "./recent_workspaces.tsx";
import {NewWorkspacePage} from "./new.tsx";
import {SettingsPage} from "./settings.tsx"; // Assuming useAlerts returns AlertsContextType

// Page state
type ActivePage = 'workspaces' | 'new_workspace' | 'settings';

type SidebarLinkProps = {
    icon: ReactNode,
    label: string,
    isActive?: boolean,
    onClick: () => void
}

const SidebarLink: React.FC<SidebarLinkProps> = ({icon, label, isActive, onClick}) => (
    <button
        onClick={onClick}
        className={`
            flex items-center w-full px-4 py-3 text-left text-sm font-medium rounded-lg
            transition-colors duration-150
            ${
            isActive
                ? 'bg-[#E0E0E0]'
                : 'hover:bg-gray-200'
        }
        `}
    >
        <span className="mr-3">{icon}</span>
        {label}
    </button>
);

interface SidebarProps {
    activePage: ActivePage;
    setActivePage: (page: ActivePage) => void;
}

const Sidebar: React.FC<SidebarProps> = ({activePage, setActivePage}) => (
    <nav className="w-64 flex-shrink-0 bg-gray-100 p-4 border-r border-gray-300 space-y-2">
        {/* Workspaces Icon */}
        <SidebarLink
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                     stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/>
                </svg>
            )}
            label="Workspaces"
            isActive={activePage === 'workspaces'}
            onClick={() => setActivePage('workspaces')}
        />
        {/* New Workspace Icon */}
        <SidebarLink
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                     stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                </svg>
            )}
            label="New Workspace"
            isActive={activePage === 'new_workspace'}
            onClick={() => setActivePage('new_workspace')}
        />
        {/* Settings Icon */}
        <SidebarLink
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                     stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>
                </svg>
            )}
            label="Settings"
            isActive={activePage === 'settings'}
            onClick={() => setActivePage('settings')}
        />
    </nav>
);
const WorkspaceSelection: React.FC<SessionWindow> = ({setPage, setName}) => {
    const [activePage, setActivePage] = useState<ActivePage>('workspaces');

    useEffect(() => {
        setName("Home")
    }, [])

    const renderPage = () => {
        switch (activePage) {
            case 'workspaces':
                return <WorkspaceListPage
                    setPage={setPage}
                />;
            case 'new_workspace':
                return <NewWorkspacePage setPage={setPage}/>;
            case 'settings':
                return <SettingsPage/>;
            default:
                return <WorkspaceListPage
                    setPage={setPage}
                />;
        }
    }

    return (
        <div className="flex h-screen bg-white">
            {/* Left Sidebar */}
            <Sidebar activePage={activePage} setActivePage={setActivePage}/>

            {/* Main Content Area */}
            {renderPage()}
        </div>
    );
}

export default WorkspaceSelection;