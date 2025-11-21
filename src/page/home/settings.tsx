import React, {useEffect, useState} from "react";
import {getVersion} from "@tauri-apps/api/app";

export const SettingsPage: React.FC = () => {
    const [version, setVersion] = useState<string>();

    useEffect(() => {
        getVersion().then((v) => {
            setVersion(v);
        })
    }, [])

    return <div className="flex-1 p-8">
        <h1 className="text-3xl font-extrabold">Settings</h1>
        <h2 className={"text-gray-500 my-2"}>Build version: v{version}</h2>
        <p className="mt-4 text-gray-600">
            No settings available yet. Poll rates and other options will be configurable in a future release.
        </p>
    </div>
}
