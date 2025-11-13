import {Channel, invoke} from "@tauri-apps/api/core";
import {createContext} from "react";

export type Command = {
    action: string,
    arguments: string[]
}

export class ListenerRef {}

export type DeviceConfig = {
    name: string | undefined,
    ready: boolean
} & any

export type DeviceRef = {
    id: number
}

export type ListenerManager = {
    registerListener: {
        command: (fn: (command: Command) => void) => ListenerRef,
        raw: (fn: (content: Uint8Array) => void) => ListenerRef,
        close: (fn: () => void) => void
    },
    unregisterListener: {
        command: (ref: ListenerRef) => void,
        raw: (ref: ListenerRef) => void
    },
    localWrite(buf: Uint8Array): void
}

export type Project = {
    id: number,
    write: (string?: string | undefined, raw?: Uint8Array | undefined) => Promise<void>,
    close: () => Promise<void>
} & ListenerManager

export type Device = {
    sort: string,
    name: string,
    ref: DeviceRef,
    config: DeviceConfig,
    channel: Channel<DeviceEvent>,
    manager: ListenerManager,
}

export type ProjectManager = {
    getDevice: (sort: string, name: string) => Device | null,
    openDevice: (sort: string, config: DeviceConfig) => Promise<Device>,
    openProject: (ref: DeviceRef) => Promise<Project>
}

export class ProjectManagerImpl implements ProjectManager {
    devices: Device[];

    getDevice(sort: string, name: string): Device | null {
        const alreadyOpen = this.devices.find((p) => p.sort == sort && p.name == name)

        if (alreadyOpen) {
            return alreadyOpen
        }

        return null
    }

    async openDevice(sort: string, config: DeviceConfig): Promise<Device> {
        let channel = new Channel<DeviceEvent>()

        let res = await invoke<DeviceRef>("open_device", {
            sort: sort,
            name: config.name,
            config: config,
            channel: channel
        })

        let device: Device = {
            sort: sort,
            name: config.name,
            ref: res,
            config: config,
            channel: channel,
            manager: new ListenerManagerImpl(channel)
        }

        this.devices.push(device)

        device.manager.registerListener.close(() => {
            const pos = this.devices.indexOf(device)
            this.devices.splice(pos, 1)
        })

        return device;
    }

    async openProject(ref: DeviceRef): Promise<Project> {
        let id = await invoke<number>("new_project", {
            workspace: "idk", // TODO not actually used,
            reference: ref
        });

        let device = this.devices.find((device) => device.ref == ref)!!

        return new ProjectImpl(id, device.manager)
    }

    constructor() {
        this.devices = []
    }
}

export type DeviceEvent =
    | { type: "RecRaw"; data: Array<number> }
    | { type: "RecCommand"; data: Command }
    | { type: "Close" };

class ListenerManagerImpl implements ListenerManager {
    private commandListeners: Map<ListenerRef, (command: Command) => void> = new Map()
    private rawListeners: Map<ListenerRef, ((content: Uint8Array) => void)> = new Map()
    private closeListeners: (() => void)[] = []

    registerListener: {
        command: (fn: (command: Command) => void) => ListenerRef;
        raw: (fn: (content: Uint8Array) => void) => ListenerRef,
        close: (fn: () => void) => void
    } = {
        command: (cb) => {
            const ref = new ListenerRef()
            this.commandListeners.set(ref, cb)
            return ref
        },
        raw: (cb) => {
            const ref = new ListenerRef()
            this.rawListeners.set(ref, cb)
            return ref
        },
        close: (fn) => {
            this.closeListeners.push(fn)
        }
    }

    unregisterListener: {
        command: (ref: ListenerRef) => void;
        raw: (ref: ListenerRef) => void
    } = {
        command: (ref: ListenerRef) => {
            this.commandListeners.delete(ref)
        },
        raw: (ref: ListenerRef) => {
            this.rawListeners.delete(ref)
        }
    }

    localWrite(buf: Uint8Array): void {
        for (let [_, listener] of this.rawListeners) {
            listener(buf)
        }
    }

    constructor(channel: Channel<DeviceEvent>) {
        channel.onmessage = (c) => {
            if (c.type === "RecRaw") {
                for (let [_, listener] of this.rawListeners) {
                    listener(Uint8Array.from(c.data))
                }
            } else if (c.type === "RecCommand") {
                for (let [_, listener] of this.commandListeners) {
                    listener(c.data)
                }
            } else if (c.type === "Close") {
                this.commandListeners.clear()
                this.rawListeners.clear()
                for (let listener of this.closeListeners) {
                    listener()
                }
            }
        }
    }
}

class ProjectImpl implements Project {
    id: number;
    listenerManager: ListenerManager

    registerListener: {
        command: (fn: (command: Command) => void) => ListenerRef;
        raw: (fn: (content: Uint8Array) => void) => ListenerRef,
        close: (fn: () => void) => void
    } = {
        command: (fn) => this.listenerManager.registerListener.command(fn),
        raw: (fn) => this.listenerManager.registerListener.raw(fn),
        close: (fn) => this.listenerManager.registerListener.close(fn),
    }

    unregisterListener: {
        command: (ref: ListenerRef) => void;
        raw: (ref: ListenerRef) => void
    } = {
        command: (fn) => this.listenerManager.unregisterListener.command(fn),
        raw: (fn) => this.listenerManager.unregisterListener.raw(fn),
    }

    write: (
        string?: string | undefined,
        raw?: Uint8Array | undefined
    ) => Promise<void> = async (string, raw) => {
        let buf = string ? new TextEncoder().encode(string) : raw

        if (!buf) return

        await invoke("device_write", {
            projectId: this.id,
            buf: buf
        })

        this.localWrite(buf)
    };

    localWrite(buf: Uint8Array): void {
        this.listenerManager.localWrite(buf)
    }

    close(): Promise<void> {
        return invoke("close_project", {
            projectId: this.id,
        })
    }

    constructor(id: number, listenerManager: ListenerManager) {
        this.id = id
        this.listenerManager = listenerManager
    }
}

export const Projects = createContext<ProjectManager>(new ProjectManagerImpl())