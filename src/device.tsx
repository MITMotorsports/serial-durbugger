import {Channel, invoke} from "@tauri-apps/api/core";
import {createContext} from "react";

export type Command = {
    action: string,
    arguments: string[]
}

export class ListenerRef {
}

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
    push(event: DeviceEvent): void
    // moveListeners: (other: ListenerManager) => void
    // localWrite(buf: Uint8Array): void
}

export type Project = {
    id: number,
    device: Device,
    write: (string?: string | undefined, raw?: Uint8Array | undefined) => Promise<void>,
    close: () => Promise<void>,
    reopen: () => Promise<boolean>,
} & ListenerManager

export type Device = {
    sort: string,
    name: string,
    ref: DeviceRef,
    config: DeviceConfig,
    channel: Channel<DeviceEvent>,
    listeners: ListenerManager,
    open: boolean,
}

export type ProjectManager = {
    getDevice: (sort: string, name: string) => Device | null,
    openDevice: (sort: string, config: DeviceConfig) => Promise<Device>,
    openProject: (device: Device) => Promise<Project>
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
            listeners: new ListenerManagerImpl(),
            open: true
        }

        this.devices.push(device)

        device.listeners.registerListener.close(() => {
            const pos = this.devices.indexOf(device)
            this.devices.splice(pos, 1)
            device.open = false
        })

        return device;
    }

    async openProject(d: Device): Promise<Project> {
        let id = await invoke<number>("new_project", {
            workspace: "idk", // TODO not actually used,
            reference: d.ref
        });

        let device = this.devices.find((device) => device.ref == d.ref)!!

        return new ProjectImpl(id, device, this)
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

    push(e: DeviceEvent): void {
        if (e.type === "RecRaw") {
            for (let [_, listener] of this.rawListeners) {
                listener(Uint8Array.from(e.data))
            }
        } else if (e.type === "RecCommand") {
            for (let [_, listener] of this.commandListeners) {
                listener(e.data)
            }
        } else if (e.type === "Close") {
            for (let listener of this.closeListeners) {
                listener()
            }
        }
    }

    // moveListeners(other: ListenerManager): void {
    //     this.closeListeners.forEach(cb => {
    //         other.registerListener.close(cb)
    //     })
    //     this.commandListeners.forEach(cb => {
    //         other.registerListener.command(cb)
    //     })
    //     this.rawListeners.forEach(cb => {
    //         other.registerListener.raw(cb)
    //     })
    //     // this.commandListeners = new Map()
    //     // this.rawListeners = new Map()
    // }

    constructor() {}
}

class ProjectImpl implements Project {
    id: number;
    listenerManager: ListenerManager
    device: Device;
    private projectManager: ProjectManager;

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

    // moveListeners(other: ListenerManager) {
    //     this.listenerManager.moveListeners(other)
    // }

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

        this.push({
            type: "RecRaw",
            data: Array.from(buf)
        })
    };

    close(): Promise<void> {
        return invoke("close_project", {
            projectId: this.id,
        })
    }

    async reopen(): Promise<boolean> {
        // if (this.device.open) return true
        this.device = await this.projectManager.openDevice(
            this.device.sort,
            this.device.config
        )

        await invoke("push_new_device", {
            project: this.id,
            reference: this.device.ref
        })

        console.log("Pushed and everything")

        this.registerListeners()

        return true
    };

    push(event: DeviceEvent): void {
        this.listenerManager.push(event)
    }

    registerListeners() {
        this.device.channel.onmessage = (event: DeviceEvent) => {
            this.listenerManager.push(event)
        }
    }

    constructor(id: number, device: Device, projectManager: ProjectManager) {
        this.device = device
        this.id = id
        this.listenerManager = new ListenerManagerImpl()
        this.projectManager = projectManager
        this.registerListeners()
    }
}

export const Projects = createContext<ProjectManager>(new ProjectManagerImpl())