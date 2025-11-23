import React from "react";
import {Project} from "../device.tsx";
import {CommandDefinition} from "./command_panel.tsx";

export type BoundingBox = {
    x: number
    y: number
    width: number
    height: number
}

export type WidgetType = "raw" | "logs" | "readout" | "readout-graph" | "command-panel"

export type Widget<T extends WidgetBehavior<BehaviorType>> = {
    type: WidgetType,
    behavior: T,
    pos: BoundingBox,
}

export type BehaviorType = "none" | "readout" | "commandPanel" | "logs"

export type WidgetBehavior<T extends BehaviorType> = { type: T } & (
    | { type: "readout", components: string[] }
    | { type: "none" }
    | { type: "logs", filter: string[]}
    | { type: "commandPanel", schema: CommandDefinition[] });

export type SetBehavior<T extends BehaviorType> = (behavior: Omit<WidgetBehavior<T>, "type">) => void

export type ToolContainerProps = {
    children: React.ReactElement
}

export type WidgetHandler<T extends BehaviorType> = {
    type: WidgetType,
    behaviorType: BehaviorType,
    displayName: string,
    header: (behavior: WidgetBehavior<T>, container: React.FC<ToolContainerProps>) => React.ReactElement,
    widget: (project: Project, behavior: WidgetBehavior<T>) => React.ReactElement,
    configurator: (items: {
        project: Project,
        behavior: WidgetBehavior<T> | null,
        setBehavior: SetBehavior<T>
    }) => React.ReactElement
}