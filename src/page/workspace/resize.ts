import React from "react";
import {BoundingBox, Widget} from "../../widget/widget.ts";
import {ActiveResize, ResizeBorder, WidgetRegion} from "./types.ts";
import {findAffectedWidgets, mergeActiveList, overlaps, snapBoundingBox} from "./utils.ts";
import {EPSILON, MINIMUM_LENGTH, SNAP_THRESHOLD} from "./const.tsx";

export function recalculateWidgetsForResize(activeResizeRef: React.RefObject<ActiveResize[]>, currentWidgets: WidgetRegion[], container: React.RefObject<HTMLDivElement | null>, e: MouseEvent) {
    // Get the *current* active list from the ref
    const currentActive = activeResizeRef.current;
    if (currentActive.length === 0) return currentWidgets;

    const current = container.current?.getBoundingClientRect();
    if (!current) return currentWidgets;

    // Helper to get the *current* widget data from the state
    const getWidgetFromState = (id: string) => currentWidgets.find(w => w.id === id);

    const primaryActive = currentActive[0];
    const primaryWidgetRegion = getWidgetFromState(primaryActive.id);
    if (!primaryWidgetRegion) return currentWidgets; // Widget removed? Abort.
    const primaryWidget = primaryWidgetRegion.widget;


    const neighborsActive = currentActive.slice(1);
    const neighborsWidgets = neighborsActive.map(n => {
        const region = getWidgetFromState(n.id);
        // This can happen if a widget is removed mid-drag, though unlikely
        if (!region) return null;
        return {...n, widget: region.widget};
    }).filter(n => n !== null) as (ActiveResize & { widget: Widget<any> })[]; // Filter out nulls


    // % mouse position
    const mouse = {
        x: (e.clientX - current.x) / current.width,
        y: (e.clientY - current.y) / current.height
    }

    // 1. Calculate primary box
    let primaryBox: BoundingBox;
    switch (primaryActive.type) {
        case ResizeBorder.TopLeft:
            primaryBox = {
                x: mouse.x, y: mouse.y,
                width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
                height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y),
            };
            break;
        case ResizeBorder.BottomLeft:
            primaryBox = {
                x: mouse.x, y: primaryWidget.pos.y,
                width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
                height: mouse.y - primaryWidget.pos.y
            };
            break;
        case ResizeBorder.BottomRight:
            primaryBox = {
                x: primaryWidget.pos.x, y: primaryWidget.pos.y,
                width: mouse.x - primaryWidget.pos.x,
                height: mouse.y - primaryWidget.pos.y
            };
            break;
        case ResizeBorder.TopRight:
            primaryBox = {
                x: primaryWidget.pos.x, y: mouse.y,
                width: mouse.x - primaryWidget.pos.x,
                height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y)
            };
            break;
        case ResizeBorder.Top:
            primaryBox = {
                x: primaryWidget.pos.x, y: mouse.y,
                width: primaryWidget.pos.width,
                height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y)
            };
            break;
        case ResizeBorder.Left:
            primaryBox = {
                x: mouse.x, y: primaryWidget.pos.y,
                width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
                height: primaryWidget.pos.height
            };
            break;
        case ResizeBorder.Bottom:
            primaryBox = {
                x: primaryWidget.pos.x, y: primaryWidget.pos.y,
                width: primaryWidget.pos.width,
                height: mouse.y - primaryWidget.pos.y
            };
            break;
        case ResizeBorder.Right:
            primaryBox = {
                x: primaryWidget.pos.x, y: primaryWidget.pos.y,
                width: mouse.x - primaryWidget.pos.x,
                height: primaryWidget.pos.height
            };
            break;
    }

    // 2. Snap primary box
    let newPrimaryPos = snapBoundingBox(primaryBox);

    // --- PUSH/LOCK & COLLISION DETECTION ---
    const activeIds = new Set(currentActive.map(n => n.id));

    for (const widget of currentWidgets) {
        if (activeIds.has(widget.id)) {
            continue; // Skip self and all *other* active widgets
        }

        let didLockToThisWidget = false;

        const {pos: otherPos} = widget.widget;
        const p = newPrimaryPos; // shorthand

        // This overlap check is for "pushing" and must be strict (not just touching)
        const yOverlapPush = (p.y < (otherPos.y + otherPos.height - EPSILON)) && (p.y + p.height > (otherPos.y + EPSILON));
        const xOverlapPush = (p.x < (otherPos.x + otherPos.width - EPSILON)) && (p.x + p.width > (otherPos.x + EPSILON));

        // --- Check for "Push/Lock" ---
        // (Disabled for corners)
        if (primaryActive.type === ResizeBorder.Right) {
            const primaryRight = p.x + p.width;
            const otherLeft = otherPos.x;
            if (yOverlapPush && primaryRight > (otherLeft - (SNAP_THRESHOLD / 2)) && primaryRight < (otherLeft + EPSILON)) {
                newPrimaryPos.width = otherLeft - newPrimaryPos.x;
                const newItems = findAffectedWidgets(widget.widget, ResizeBorder.Left, currentWidgets);
                activeResizeRef.current = mergeActiveList([...currentActive, ...newItems]);
                didLockToThisWidget = true;
            }
        } else if (primaryActive.type === ResizeBorder.Left) {
            const primaryLeft = p.x;
            const otherRight = otherPos.x + otherPos.width;
            if (yOverlapPush && primaryLeft < (otherRight + (SNAP_THRESHOLD / 2)) && primaryLeft > (otherRight - EPSILON)) {
                const oldRight = newPrimaryPos.x + newPrimaryPos.width;
                newPrimaryPos.x = otherRight;
                newPrimaryPos.width = oldRight - newPrimaryPos.x;
                const newItems = findAffectedWidgets(widget.widget, ResizeBorder.Right, currentWidgets);
                activeResizeRef.current = mergeActiveList([...currentActive, ...newItems]);
                didLockToThisWidget = true;
            }
        }

        if (primaryActive.type === ResizeBorder.Bottom) {
            const primaryBottom = p.y + p.height;
            const otherTop = otherPos.y;
            if (xOverlapPush && primaryBottom > (otherTop - (SNAP_THRESHOLD / 2)) && primaryBottom < (otherTop + EPSILON)) {
                newPrimaryPos.height = otherTop - newPrimaryPos.y;
                const newItems = findAffectedWidgets(widget.widget, ResizeBorder.Top, currentWidgets);
                activeResizeRef.current = mergeActiveList([...currentActive, ...newItems]);
                didLockToThisWidget = true;
            }
        } else if (primaryActive.type === ResizeBorder.Top) {
            const primaryTop = p.y;
            const otherBottom = otherPos.y + otherPos.height;
            if (xOverlapPush && primaryTop < (otherBottom + (SNAP_THRESHOLD / 2)) && primaryTop > (otherBottom - EPSILON)) {
                const oldBottom = newPrimaryPos.y + newPrimaryPos.height;
                newPrimaryPos.y = otherBottom;
                newPrimaryPos.height = oldBottom - newPrimaryPos.y;
                const newItems = findAffectedWidgets(widget.widget, ResizeBorder.Bottom, currentWidgets);
                activeResizeRef.current = mergeActiveList([...currentActive, ...newItems]);
                didLockToThisWidget = true;
            }
        }

        // --- Hard Overlap (Collision) Check ---
        // Use the `overlaps` helper which checks for > EPSILON overlap
        if (!didLockToThisWidget && overlaps(newPrimaryPos, widget.widget.pos)) {
            // Constrain the move ("snap").
            switch (primaryActive.type) {
                case ResizeBorder.Right:
                case ResizeBorder.TopRight:
                case ResizeBorder.BottomRight:
                    newPrimaryPos.width = widget.widget.pos.x - newPrimaryPos.x;
                    break;
                case ResizeBorder.Left:
                case ResizeBorder.TopLeft:
                case ResizeBorder.BottomLeft:
                    const oldRight = newPrimaryPos.x + newPrimaryPos.width;
                    newPrimaryPos.x = widget.widget.pos.x + widget.widget.pos.width;
                    newPrimaryPos.width = oldRight - newPrimaryPos.x;
                    break;
                case ResizeBorder.Bottom:
                    newPrimaryPos.height = widget.widget.pos.y - newPrimaryPos.y;
                    break;
                case ResizeBorder.Top:
                    const oldBottom = newPrimaryPos.y + newPrimaryPos.height;
                    newPrimaryPos.y = widget.widget.pos.y + widget.widget.pos.height;
                    newPrimaryPos.height = oldBottom - newPrimaryPos.y;
                    break;
            }
        }
    }

    // Re-snap after constraining
    newPrimaryPos = snapBoundingBox(newPrimaryPos);
    // --- END COLLISION ---

    if (newPrimaryPos.width < (MINIMUM_LENGTH - EPSILON) || newPrimaryPos.height < (MINIMUM_LENGTH - EPSILON)) {
        return currentWidgets; // Abort move
    }

    const newPositions = new Map<string, BoundingBox>();
    newPositions.set(primaryActive.id, newPrimaryPos);
    let isConstrained = false;

    // --- 3. Calculate "other active" widget positions ---

    // Get boolean flags for *which* borders the primary widget is moving
    const primaryMovesUp = primaryActive.type === ResizeBorder.Top || primaryActive.type === ResizeBorder.TopLeft || primaryActive.type === ResizeBorder.TopRight;
    const primaryMovesDown = primaryActive.type === ResizeBorder.Bottom || primaryActive.type === ResizeBorder.BottomLeft || primaryActive.type === ResizeBorder.BottomRight;
    const primaryMovesLeft = primaryActive.type === ResizeBorder.Left || primaryActive.type === ResizeBorder.TopLeft || primaryActive.type === ResizeBorder.BottomLeft;
    const primaryMovesRight = primaryActive.type === ResizeBorder.Right || primaryActive.type === ResizeBorder.TopRight || primaryActive.type === ResizeBorder.BottomRight;

    for (const neighbor of neighborsWidgets) {
        const originalNeighborPos = neighbor.widget.pos;
        let newNeighborBox: BoundingBox = {...originalNeighborPos};

        switch (neighbor.type) {
            case ResizeBorder.Left: {
                if (primaryMovesRight) { // Opposing: primary's Right is moving
                    const newLeft = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                } else if (primaryMovesLeft) { // Parallel: primary's Left is moving
                    const newLeft = newPrimaryPos.x;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                }
                break;
            }
            case ResizeBorder.Right: {
                if (primaryMovesLeft) { // Opposing: primary's Left is moving
                    const newRight = newPrimaryPos.x;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                } else if (primaryMovesRight) { // Parallel: primary's Right is moving
                    const newRight = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                }
                break;
            }
            case ResizeBorder.Top: {
                if (primaryMovesDown) { // Opposing: primary's Bottom is moving
                    const newTop = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                } else if (primaryMovesUp) { // Parallel: primary's Top is moving
                    const newTop = newPrimaryPos.y;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                }
                break;
            }
            case ResizeBorder.Bottom: {
                if (primaryMovesUp) { // Opposing: primary's Top is moving
                    const newBottom = newPrimaryPos.y;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                } else if (primaryMovesDown) { // Parallel: primary's Bottom is moving
                    const newBottom = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                }
                break;
            }
            // --- Corners ---
            case ResizeBorder.TopLeft: {
                // Handle Left part
                if (primaryMovesRight) { // Opposing
                    const newLeft = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                } else if (primaryMovesLeft) { // Parallel
                    const newLeft = newPrimaryPos.x;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                }
                // Handle Top part
                if (primaryMovesDown) { // Opposing
                    const newTop = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                } else if (primaryMovesUp) { // Parallel
                    const newTop = newPrimaryPos.y;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                }
                break;
            }
            case ResizeBorder.TopRight: {
                // Handle Right part
                if (primaryMovesLeft) { // Opposing
                    const newRight = newPrimaryPos.x;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                } else if (primaryMovesRight) { // Parallel
                    const newRight = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                }
                // Handle Top part
                if (primaryMovesDown) { // Opposing
                    const newTop = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                } else if (primaryMovesUp) { // Parallel
                    const newTop = newPrimaryPos.y;
                    newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
                    newNeighborBox.y = newTop;
                }
                break;
            }
            case ResizeBorder.BottomLeft: {
                // Handle Left part
                if (primaryMovesRight) { // Opposing
                    const newLeft = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                } else if (primaryMovesLeft) { // Parallel
                    const newLeft = newPrimaryPos.x;
                    newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
                    newNeighborBox.x = newLeft;
                }
                // Handle Bottom part
                if (primaryMovesUp) { // Opposing
                    const newBottom = newPrimaryPos.y;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                } else if (primaryMovesDown) { // Parallel
                    const newBottom = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                }
                break;
            }
            case ResizeBorder.BottomRight: {
                // Handle Right part
                if (primaryMovesLeft) { // Opposing
                    const newRight = newPrimaryPos.x;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                } else if (primaryMovesRight) { // Parallel
                    const newRight = newPrimaryPos.x + newPrimaryPos.width;
                    newNeighborBox.width = newRight - originalNeighborPos.x;
                }
                // Handle Bottom part
                if (primaryMovesUp) { // Opposing
                    const newBottom = newPrimaryPos.y;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                } else if (primaryMovesDown) { // Parallel
                    const newBottom = newPrimaryPos.y + newPrimaryPos.height;
                    newNeighborBox.height = newBottom - originalNeighborPos.y;
                }
                break;
            }
        }

        const newNeighborPos = snapBoundingBox(newNeighborBox);
        if (newNeighborPos.width < (MINIMUM_LENGTH - EPSILON) || newNeighborPos.height < (MINIMUM_LENGTH - EPSILON)) {
            isConstrained = true;
            break;
        }
        newPositions.set(neighbor.id, newNeighborPos);
    }

    if (isConstrained) return currentWidgets; // Abort move

    // 6. Atomically update
    return currentWidgets.map(w => {
        if (newPositions.has(w.id)) {
            return {
                ...w,
                widget: {...w.widget, pos: newPositions.get(w.id)!},
                // No neighbors to update
            };
        }
        return w;
    });
}
