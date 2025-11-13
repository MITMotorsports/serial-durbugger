import React, {ReactNode, useContext, useEffect, useState} from 'react';
import {invoke} from "@tauri-apps/api/core";
import {Dropdown, DropdownItem} from "../component/dropdown";
import Input from "../component/input";
import Button from "../component/button";
import {SessionWindow} from "../session_manager";
import {DeviceConfig, Projects} from "../device";
import {useAlerts} from "../alert";
import Workspace from "./workspace/page.tsx";
import Home from "./home/home.tsx";


// ====================================================================
// CONNECTION MANAGER SUB-COMPONENTS
// ====================================================================

const tabs = [
    {
        name: 'serial', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                 stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"/>
            </svg>
        )
    },
    {
        name: 'mock', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                 stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082"/>
            </svg>
        )
    },
    {
        name: 'wifi', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                 stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"/>
            </svg>
        )
    },
];

interface TabButtonProps {
    name: 'serial' | 'mock' | 'wifi';
    connectionType: string;
    setConnectionType: (type: 'serial' | 'mock' | 'wifi') => void;
    icon: ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({name, connectionType, setConnectionType, icon}) => {
    const isActive = connectionType === name;

    return (
        <button
            onClick={() => setConnectionType(name)}
            className={`
                flex items-center justify-center py-3 px-4 text-sm capitalize
                ${
                isActive
                    ? 'border-b-2 border-gray-400 font-semibold'
                    : 'border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 font-medium'
            }
                transition-colors duration-200 ease-in-out w-1/3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-t
            `}
        >
            <span className={"mr-2"}>
            {icon}
            </span>
            {name}
        </button>
    );
};

// ====================================================================
// CONFIGURATION PANELS
// ====================================================================

type ConfigProps = {
    config: DeviceConfig
    setConfig: (value: DeviceConfig) => DeviceConfig,
    disabled: boolean
}

const SerialConfigPanel: React.FC<ConfigProps> = ({config, setConfig, disabled}) => {
    useEffect(() => {
        // Only set defaults if not disabled (i.e., not loading an existing device)
        if (!disabled) {
            setConfig((c: DeviceConfig) => {
                return {
                    ...c,
                    baud_rate: 115200,
                    timeout: 1000,
                    ready: true,
                }
            })
        }
    }, [disabled, setConfig]);

    return (
        <div className="space-y-4 w-full">
            <div className={"flex justify-between items-center w-full"}>
                <p className="font-medium ">Baud rate:</p>
                <div className="w-48">
                    <Input
                        disabled={disabled}
                        onChange={(it) => {
                            const value = it.target.value
                            setConfig({
                                ...config,
                                baud_rate: Number.parseInt(value),
                            })
                        }}
                        value={config.baud_rate || 115200}
                    />
                </div>
            </div>
            <div className={"flex justify-between items-center w-full"}>
                <p className="font-medium">Timeout:</p>
                <div className="w-48 flex flex-row justify-between items-center gap-2">
                    <Input
                        disabled={disabled}
                        onChange={(it) => {
                            const value = it.target.value
                            setConfig({
                                ...config,
                                timeout: Number.parseInt(value),
                            })
                        }}
                        value={config.timeout || 1000}
                    />
                    <span className="text-sm">ms</span>
                </div>
            </div>
        </div>
    );
}

const MockConfigPanel: React.FC<ConfigProps> = ({setConfig, disabled}) => {
    useEffect(() => {
        if (!disabled) {
            setConfig((c: DeviceConfig) => ({...c, ready: true}));
        }
    }, [disabled, setConfig]);

    return (
        <div className="p-4 bg-yellow-50 rounded-lg text-center border border-yellow-200 w-full">
            <p className="text-sm font-medium text-yellow-800">
                Nothing here to configure!
            </p>
            <p className="text-xs text-yellow-600 mt-1">
                There is only 1 mocked input currently available.
            </p>
        </div>
    );
}

const WifiConfigPanel: React.FC<ConfigProps> = ({setConfig, disabled}) => {
    useEffect(() => {
        if (!disabled) {
            setConfig((c: DeviceConfig) => ({...c, ready: true}));
        }
    }, [disabled, setConfig]);

    return (
        <div className="p-4 bg-yellow-50 rounded-lg text-center border border-yellow-200 w-full">
            <p className="text-sm font-medium text-yellow-800">
                WIFI Configuration does not require device-specific settings here.
            </p>
            <p className="text-xs text-yellow-600 mt-1">
                Connection details will be managed by the application at runtime.
            </p>
        </div>
    );
}

// ====================================================================
// MAIN CONFIGURE PROJECT COMPONENT
// ====================================================================

const ConfigureProject: React.FC<{ workspace: string } & SessionWindow> = ({workspace, setPage, setName}) => {
    // State initialization with explicit types
    const alerts = useAlerts();

    const [availableDevices, setAvailableDevices] = useState<string[]>([]);
    const projectManager = useContext(Projects)

    const [config, setConfig] = useState<DeviceConfig>({});

    const [connectionSort, setConnectionSort] = useState<'serial' | 'mock' | 'wifi'>('serial');
    const [disabledConfig, setDisabledConfig] = useState<boolean>(false);

    useEffect(() => {
        setName("Configure Project")
    }, [])

    useEffect(() => {
        invoke("device_available", {
            sort: connectionSort
        }).then((it) => {
            setAvailableDevices(it as string[]);
        }).catch((e) => {
            console.log(e.toString())
        })
    }, [connectionSort]);

    const handleConnectionTypeChange = (type: 'serial' | 'mock' | 'wifi') => {
        setConnectionSort(type);
        // Reset config when changing type, unless a device is already selected
        const currentName = config.name;
        const device = projectManager.getDevice(type, currentName);
        if (device) {
            handleDeviceChange(currentName, type);
        } else {
            setConfig({ready: false}); // Keep name if it exists, but clear other config
            setDisabledConfig(false);
        }
    };

    const renderDeviceConfig = (disabled: boolean): ReactNode => {
        switch (connectionSort) {
            case 'serial':
                return <SerialConfigPanel disabled={disabled} config={config} setConfig={setConfig}/>
            case 'mock':
                return <MockConfigPanel disabled={disabled} config={config} setConfig={setConfig}/>
            case 'wifi':
                return <WifiConfigPanel disabled={disabled} config={config} setConfig={setConfig}/>
            default:
                return null;
        }
    };

    const handleCreateNew = async () => {
        if (!config.name) {
            alerts.showAlert("warning", "No device specified.")
            return
        }
        if (!config.ready) {
            alerts.showAlert("warning", "Configuration not finalized.")
            return
        }

        const {ready, ...finalConfig} = config;

        const device = projectManager.getDevice(connectionSort, config.name) ?? await projectManager.openDevice(
            connectionSort, finalConfig
        )

        let project = await projectManager.openProject(device.ref)

        setPage(Workspace, {
            id: workspace,
            project: project,
        })
    };

    const handleDeviceChange = (name: string, type: 'serial' | 'mock' | 'wifi' = connectionSort) => {
        const device = projectManager.getDevice(type, name)

        if (device) {
            setDisabledConfig(true)
            setConfig({
                ...device.config,
                ready: true
            })
        } else {
            setDisabledConfig(false)
            // Reset config, but keep the name
            setConfig({
                ...config,
                name: name,
            })
        }
    }

    return (
        <div className="p-8 font-inter h-full w-3/4 m-auto justify-center align-middle ">
            <div className="mx-auto space-y-8 min-w-2/5">
                <div className="flex flex-row gap-3  items-center">
                    <button className={"rounded-3xl hover:bg-gray-100 p-3 transition-all duration-300"} onClick={() => {
                        setPage(Home, {})
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                             stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/>
                        </svg>
                    </button>

                    <h1 className="text-2xl font-bold">
                        Configure Workspace: <span
                        className="border-b-2 border-orange-500 font-extrabold text-orange-500">{workspace}</span>
                    </h1>
                </div>

                {/* Connection Section */}
                <div className="p-6 space-y-6">
                    <h2 className="text-xl font-bold">Attach Device:</h2>

                    {/* Tab Bar */}
                    <div className={"flex flex-row border-b border-gray-300"}>
                        {tabs.map((tab) => (
                            <TabButton
                                key={tab.name}
                                name={tab.name as 'serial' | 'mock' | 'wifi'}
                                icon={tab.icon}
                                connectionType={connectionSort}
                                setConnectionType={handleConnectionTypeChange}
                            />
                        ))}
                    </div>

                    <div className={"items-center flex flex-col space-y-4"}>
                        <div className={"flex justify-between items-center w-full"}>
                            <p className="font-medium ">Device:</p>
                            <Dropdown className={"min-w-48"} onSelect={handleDeviceChange} value={config.name}>
                                {availableDevices.map((id) => {
                                    return <DropdownItem key={id} value={id}>{id}</DropdownItem>
                                })}
                            </Dropdown>
                        </div>

                        {disabledConfig ?
                            <div className="p-4 bg-yellow-50 rounded-lg text-center border border-yellow-200 w-full">
                                <p className="text-sm font-medium text-yellow-800">
                                    Configuration for this device is disabled.
                                </p>
                                <p className="text-xs text-yellow-600 mt-1">
                                    This device is already open in at least one other project, close it to modify this
                                    device's configuration.
                                </p>
                            </div> : <></>}
                        {renderDeviceConfig(disabledConfig)}
                    </div>
                </div>

                <Button
                    onClick={() => {
                        handleCreateNew().catch((e) => {
                            alerts.showAlert("warning", e.toString())
                        })
                    }}
                    disabled={!config.ready || !config.name}
                    className="inline-block bg-[#4CAF50] hover:bg-[#45a049] text-white px-4 py-3 text-base font-semibold transition-all w-full rounded-lg
                               disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    Create and Connect
                </Button>
            </div>
        </div>
    )
}

export default ConfigureProject;

