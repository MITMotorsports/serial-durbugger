import React from "react";
import {Project} from "../device.tsx";
import {CommandDefinition} from "./command_panel.tsx";

export type BoundingBox = {
    x: number
    y: number
    width: number
    height: number
}

export type Widget = {
    behavior: WidgetBehavior | undefined,
    pos: BoundingBox,
}

export type WidgetType = "readout" | "raw" | "timeline" | "readoutTimeline" | "logViewer" | "commandPanel"

export type WidgetBehavior = { type: WidgetType } & (
    | { type: "readout", components: string[] } // Rea
    | { type: "readoutTimeline", components: string[] } // Rea
    | { type: "raw" }
    | { type: "logViewer" }
    | {type: "commandPanel", schema: CommandDefinition[]});

export type SetBehavior = (behavior: Omit<WidgetBehavior, "type">) => void

export type ToolContainerProps = {
    children: React.ReactElement
}

export type Tool = {
    type: WidgetType,
    displayName: string,
    header: (behavior: WidgetBehavior, container: React.FC<ToolContainerProps>) => React.ReactElement,
    widget: (project: Project, behavior: WidgetBehavior) => React.ReactElement,
    configurator: (setBehavior: SetBehavior) => React.ReactElement
}