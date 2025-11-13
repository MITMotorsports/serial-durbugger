import {BoundingBox, Widget} from "../../widget/tool.ts";

export enum ResizeBorder {
    TopRight,
    Top,
    TopLeft,
    Left,
    BottomLeft,
    Bottom,
    BottomRight,
    Right
}

export type ActiveResize = {
    type: ResizeBorder,
    // No widget object here, as it would become stale.
    id: string
}

// --- NEW ---
// Type for tracking the active drag operation
export type ActiveDrag = {
    id: string,
    originalPos: BoundingBox,
    // Mouse start position relative to container (0-1)
    startMouse: { x: number, y: number }
}

// Type for tracking the potential drop target
export type DragTarget = {
    type: 'empty' | 'widget',
    id: string, // widget id or empty-region-index
    box: BoundingBox
}
// --- END NEW ---


export type WidgetRegion = {
    widget: Widget,
    id: string,
    // 'neighbors' property completely removed
}