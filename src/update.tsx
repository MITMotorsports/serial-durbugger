import React, {ReactNode, useEffect, useState} from 'react';
import {Channel, invoke} from "@tauri-apps/api/core";
import {BackendError} from "./err.ts";

type UpdateStatus = {
    type: "downloading",
    value: number
} | { type: "done" | "installing" | "error" }

// Define the possible states for our updater UI
type UpdateState =
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'installing'
    | 'uptodate'
    | "restarting"
    | 'error';

/**
 * --- SVG Icons ---
 * A few simple icons for different states.
 */
const Icons = {
    Update: () => (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"
             xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
    ),
    CheckCircle: () => (
        <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
             xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    ),
    AlertCircle: () => (
        <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
             xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    ),
    DownloadCloud: () => (
        <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
             xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h.5A3.5 3.5 0 0111 5.5V9a3.5 3.5 0 01-3.5 3.5h-1zM10 5l-2-2m2 2l2-2m-2 2v6m-2-2h-2m10-4.5a3.5 3.5 0 013.5 3.5V17a4 4 0 01-4 4h-1.5a3.5 3.5 0 01-3.5-3.5V14m0-2l2-2m-2 2l-2-2m2 2V8m2 2h2"></path>
        </svg>
    ),
    Spinner: () => (
        <div
            className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"
            role="status"
            aria-label="Loading..."
        ></div>
    )
};

/**
 * --- Progress Bar Component ---
 * A visual bar to show download progress.
 */
interface ProgressBarProps {
    progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({progress}) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{width: `${progress}%`}}
        ></div>
    </div>
);

/**
 * --- Material-style Button Component ---
 * A reusable button with Material-like styles.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({children, onClick, variant = 'primary', disabled}) => {
    const baseStyle = "px-6 py-2.5 rounded-lg font-medium uppercase text-sm tracking-wider shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
    const primaryStyle = "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg focus:ring-blue-500";
    const secondaryStyle = "bg-gray-100 text-blue-600 hover:bg-gray-200 focus:ring-blue-500";
    const disabledStyle = "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none";

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${disabled ? disabledStyle : (variant === 'primary' ? primaryStyle : secondaryStyle)}`}
        >
            {children}
        </button>
    );
};

/**
 * --- Main App Component ---
 * The core updater page component.
 */
const Updater: React.FC<{
    onFinish: () => void;
}> = ({onFinish}) => {
    const [status, setStatus] = useState<UpdateState>('idle');
    // const [manifest, setManifest] = useState<UpdateManifest | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const execute = () => {
        const channel = new Channel<UpdateStatus>();

        channel.onmessage = (event) => {
            if (event.type == "downloading") {
                setStatus("downloading")
                setDownloadProgress(event.value * 100)
            } else if (event.type == "installing") {
                setStatus("installing")
            } else if (event.type == "done") {
                setStatus("restarting")
            } else if (event.type == "error") {
                setStatus("error")
            }
        }

        setStatus("checking")

        invoke<boolean>("update", {
            channel: channel
        }).then((result) => {
            if (!result) {
                setStatus('uptodate');

                setTimeout(() => {
                    onFinish()
                }, 1000)
            }
        }).catch((err) => {
            setStatus("error");
            setError((err as BackendError).message);
        })
    }

    // --- Effect to Run Initial Check on Mount ---
    useEffect(() => {
        execute();
    }, []);

    // --- Render different UI based on state ---
    const renderContent = () => {
        switch (status) {
            case 'checking':
                return (
                    <div className="flex flex-col items-center space-y-4 py-8">
                        <Icons.Spinner/>
                        <p className="text-gray-600">Checking for updates...</p>
                    </div>
                );

            case 'uptodate':
                return (
                    <div className="flex flex-col items-center space-y-4 py-8">
                        <Icons.CheckCircle/>
                        <h2 className="text-xl font-medium text-gray-800">You're up to date!</h2>
                        <p className="text-gray-600">This app is up to date with the latest version</p>
                        {/*<Button variant="secondary" onClick={handleCheckUpdate}>Check Again</Button>*/}
                    </div>
                );

            case 'downloading':
                return (
                    <div className="flex flex-col items-center space-y-6 py-8 w-full">
                        <Icons.Spinner/>
                        <h2 className="text-xl font-medium text-gray-800">Downloading Update...</h2>
                        <p className="text-gray-600">{downloadProgress}%</p>
                        <ProgressBar progress={downloadProgress}/>
                    </div>
                );
            case 'installing':
                return (
                    <div className="flex flex-col items-center space-y-6 py-8 w-full">
                        <Icons.Spinner/>
                        <h2 className="text-xl font-medium text-gray-800">Installing Update...</h2>
                    </div>
                );
            case 'restarting':
                return (
                    <div className="flex flex-col items-center space-y-6 py-8 w-full">
                        <Icons.Spinner/>
                        <h2 className="text-xl font-medium text-gray-800">Restarting App...</h2>
                    </div>
                );

            case 'error':
                return (
                    <div className="flex flex-col items-center space-y-4 text-center py-8">
                        <Icons.AlertCircle/>
                        <h2 className="text-xl font-medium text-red-700">Update Failed</h2>
                        <p className="text-gray-600 w-full break-words px-4">{error ?? "Unknown error"}</p>
                        <div className={"flex flex-row gap-3"}>
                            <Button variant="primary" onClick={execute}>
                                Try Again
                            </Button>
                            <Button variant="secondary" onClick={() => {
                                onFinish();
                            }}>Ignore</Button>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="flex flex-col items-center space-y-4 py-8">
                        <p className="text-gray-600">Initializing updater...</p>
                    </div>
                );
        }
    };

    return (
        <div className="bg-gray-100 flex items-center justify-center min-h-screen font-sans p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full">
                {/* Card Header */}
                <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-200">
                    <Icons.Update/>
                    <h1 className="text-2xl font-bold text-gray-800">Updater</h1>
                </div>

                {/* Card Body: Dynamic Content */}
                <div className="min-h-[250px] flex items-center justify-center">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

const UpdateHelper: React.FC<{ children: ReactNode }> = ({children}) => {
    const [finished, setFinished] = useState<boolean>(false);

    return <>
        {finished ? children : <Updater onFinish={() => setFinished(true)}/>}
    </>
}

export default UpdateHelper;