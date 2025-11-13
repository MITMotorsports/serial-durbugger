import {BoundingBox} from "../../widget/tool.ts";
import {ActiveDrag, DragTarget, WidgetRegion} from "./types.ts";

export function recalculateMovement(e: MouseEvent, currentBound: BoundingBox, dragState: ActiveDrag) {
    const mouse = {
        x: (e.clientX - currentBound.x) / currentBound.width,
        y: (e.clientY - currentBound.y) / currentBound.height
    };

    const delta = {
        x: mouse.x - dragState.startMouse.x,
        y: mouse.y - dragState.startMouse.y
    };
    const newPreviewBox: BoundingBox = {
        x: dragState.originalPos.x + delta.x,
        y: dragState.originalPos.y + delta.y,
        width: dragState.originalPos.width,
        height: dragState.originalPos.height
    };
    return {mouse, newPreviewBox};
}

export function findDragTarget(dragState: ActiveDrag, widgets: WidgetRegion[], mouse: {
    x: number;
    y: number
}, emptyRegions: BoundingBox[]) {
    // 2. Find Drop Target
    let target: DragTarget | null = null;
    const dragId = dragState.id;

    // 2a. Check for widget swap target
    for (const w of widgets) {
        if (w.id === dragId) continue;
        const {pos} = w.widget;
        // Is mouse inside this widget?
        if (mouse.x > pos.x && mouse.x < (pos.x + pos.width) &&
            mouse.y > pos.y && mouse.y < (pos.y + pos.height)) {

            // must already meet MINIMUM_LENGTH.
            target = {type: 'widget', id: w.id, box: pos};
            break;
        }
    }
    // 2b. Check for empty region target
    if (!target) {
        for (let i = 0; i < emptyRegions.length; i++) {
            const region = emptyRegions[i];
            // Is mouse inside this region?
            if (mouse.x > region.x && mouse.x < (region.x + region.width) &&
                mouse.y > region.y && mouse.y < (region.y + region.height)) {

                target = {type: 'empty', id: `empty-${i}`, box: region};
                break;
            }
        }
    }
    return target;
}

export function recalculateWidgetsForDragEnd(dragState: ActiveDrag, dragTarget: DragTarget, currentWidgets: WidgetRegion[]) {
    const dragId = dragState.id;
    const targetId = dragTarget.id;

    const dragIndex = currentWidgets.findIndex(w => w.id === dragId);
    if (dragIndex === -1) return currentWidgets; // Widget was removed mid-drag?

    let newWidgets = [...currentWidgets];

    if (dragTarget.type === 'empty') {
        // Widget takes on the position and dimensions of the empty region
        newWidgets[dragIndex] = {
            ...newWidgets[dragIndex],
            widget: {
                ...newWidgets[dragIndex].widget,
                pos: dragTarget.box
            }
        };

    } else if (dragTarget.type === 'widget') {
        // Swap with Other Widget
        const targetIndex = currentWidgets.findIndex(w => w.id === targetId);
        if (targetIndex === -1) return currentWidgets; // Target widget removed?

        // Get the positions to be swapped
        const dragOriginalPos = newWidgets[dragIndex].widget.pos;
        const targetOriginalPos = newWidgets[targetIndex].widget.pos;

        // Atomically update the array
        newWidgets[dragIndex] = {
            ...newWidgets[dragIndex],
            widget: {
                ...newWidgets[dragIndex].widget,
                pos: targetOriginalPos // Target widget gets dragged widget's original box
            }
        };
        newWidgets[targetIndex] = {
            ...newWidgets[targetIndex],
            widget: {
                ...newWidgets[targetIndex].widget,
                pos: dragOriginalPos // Dragged widget gets target's box
            }
        };
    }

    // No recomputeNeighbors call
    return newWidgets;
}
