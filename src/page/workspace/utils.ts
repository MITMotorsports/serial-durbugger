
// Snapping and Constraining Helpers
import {BoundingBox, Widget} from "../../widget/tool.ts";
import {ActiveResize, ResizeBorder, WidgetRegion} from "./types.ts";
import {BORDER_VALUES, EPSILON, MINIMUM_LENGTH, SNAP_THRESHOLD} from "./const.tsx";

export function calculateEmptyRegions(widgets: WidgetRegion[]) {
    const xCoords = new Set<number>([0, 1]);
    const yCoords = new Set<number>([0, 1]);

    widgets.forEach(({widget}) => {
        xCoords.add(widget.pos.x);
        xCoords.add(widget.pos.x + widget.pos.width);
        yCoords.add(widget.pos.y);
        yCoords.add(widget.pos.y + widget.pos.height);
    });

    const sortedX = Array.from(xCoords).sort((a, b) => a - b);
    const sortedY = Array.from(yCoords).sort((a, b) => a - b);

    const allEmptyCells: BoundingBox[] = [];

    for (let i = 0; i < sortedX.length - 1; i++) {
        const x = sortedX[i];
        const width = sortedX[i + 1] - x;

        if (width <= EPSILON) continue; // Skip 0-width cells

        for (let j = 0; j < sortedY.length - 1; j++) {
            const y = sortedY[j];
            const height = sortedY[j + 1] - y;

            if (height <= EPSILON) continue; // Skip 0-height cells

            const midX = x + width / 2;
            const midY = y + height / 2;

            const isOccupied = widgets.some(({widget}) => {
                const {pos} = widget;
                // Check if midpoint is inside the widget (with epsilon)
                return midX > (pos.x + EPSILON) && midX < (pos.x + pos.width - EPSILON) &&
                    midY > (pos.y + EPSILON) && midY < (pos.y + pos.height - EPSILON);
            });

            if (!isOccupied) {
                allEmptyCells.push({x, y, width, height});
            }
        }
    }

    // 1. Find all horizontally-maximal rectangles
    const horizontalRegions = runMergePass(allEmptyCells, 'horizontal');

    // 2. Find all vertically-maximal rectangles
    const verticalRegions = runMergePass(allEmptyCells, 'vertical');

    // 3. Combine, de-duplicate, and filter by minimum size
    const regionMap = new Map<string, BoundingBox>();
    const allCandidates = [...horizontalRegions, ...verticalRegions];

    allCandidates.forEach(r => {
        // Filter out regions that are too small early
        if (r.width >= (MINIMUM_LENGTH - EPSILON) && r.height >= (MINIMUM_LENGTH - EPSILON)) {
            // Use a string key to de-duplicate
            const key = `${r.x},${r.y},${r.width},${r.height}`;
            regionMap.set(key, r);
        }
    });

    const uniqueCandidates = Array.from(regionMap.values());

    // 4. Sort by area, descending
    uniqueCandidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // 5. Greedily select largest regions that don't overlap with already-selected ones
    const finalRegions: BoundingBox[] = [];
    for (const candidate of uniqueCandidates) {
        const isOverlapped = finalRegions.some(r => overlaps(r, candidate));
        if (!isOverlapped) {
            finalRegions.push(candidate);
        }
    }
    return finalRegions;
}

const snapValue = (value: number): number => {
    for (const border of BORDER_VALUES) {
        if (Math.abs(value - border) < SNAP_THRESHOLD) {
            return border;
        }
        // Constrain to screen height/width
        if (value > 1) {
            return 1;
        }
        if (value < 0) {
            return 0;
        }
    }
    return value;
}

export const snapBoundingBox = (pos: BoundingBox): BoundingBox => {
    const x = snapValue(pos.x);
    const y = snapValue(pos.y);
    const right = snapValue(pos.x + pos.width);
    const bottom = snapValue(pos.y + pos.height);

    return {
        x: x,
        y: y,
        width: right - x,
        height: bottom - y
    }
}

export const overlaps = (boxA: BoundingBox, boxB: BoundingBox) => {
    // Check if they don't overlap (A is left of B, B is left of A, etc.)
    // This check is strict (> EPSILON) and does *not* count touching as overlapping
    if ((boxA.x + boxA.width - EPSILON) <= boxB.x ||
        (boxB.x + boxB.width - EPSILON) <= boxA.x ||
        (boxA.y + boxA.height - EPSILON) <= boxB.y ||
        (boxB.y + boxB.height - EPSILON) <= boxA.y) {
        return false;
    }
    return true; // They overlap
};

// Check for close floating point values
export const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;


// --- Helper for merging empty rectangles ---
const tryMerge = (r1: BoundingBox, r2: BoundingBox, direction: 'horizontal' | 'vertical'): BoundingBox | null => {
    if (direction === 'horizontal') {
        // Try merge right (r2 is to the right of r1)
        if (Math.abs(r1.y - r2.y) < EPSILON && Math.abs(r1.height - r2.height) < EPSILON && Math.abs(r1.x + r1.width - r2.x) < EPSILON) {
            return {x: r1.x, y: r1.y, width: r1.width + r2.width, height: r1.height};
        }
        // Try merge left (r2 is to the left of r1)
        if (Math.abs(r1.y - r2.y) < EPSILON && Math.abs(r1.height - r2.height) < EPSILON && Math.abs(r2.x + r2.width - r1.x) < EPSILON) {
            return {x: r2.x, y: r1.y, width: r1.width + r2.width, height: r1.height};
        }
    } else { // vertical
        // Try merge down (r2 is below r1)
        if (Math.abs(r1.x - r2.x) < EPSILON && Math.abs(r1.width - r2.width) < EPSILON && Math.abs(r1.y + r1.height - r2.y) < EPSILON) {
            return {x: r1.x, y: r1.y, width: r1.width, height: r1.height + r2.height};
        }
        // Try merge up (r2 is above r1)
        if (Math.abs(r1.x - r2.x) < EPSILON && Math.abs(r1.width - r2.width) < EPSILON && Math.abs(r2.y + r2.height - r1.y) < EPSILON) {
            return {x: r1.x, y: r2.y, width: r1.width, height: r1.height + r2.height};
        }
    }
    return null;
};

/**
 * Runs a stable merge pass in one direction (horizontal or vertical).
 * It repeatedly scans the list and merges adjacent regions until no
 * more merges are possible in that direction.
 */
export const runMergePass = (regions: BoundingBox[], direction: 'horizontal' | 'vertical'): BoundingBox[] => {
    let passRegions = [...regions];
    let didMerge = true;

    while (didMerge) {
        didMerge = false;
        let nextPassRegions: BoundingBox[] = [];
        let mergedOut = new Set<number>(); // Indices of regions that were merged *into* others

        for (let i = 0; i < passRegions.length; i++) {
            if (mergedOut.has(i)) continue; // Was already consumed
            let currentRegion = passRegions[i];

            for (let j = i + 1; j < passRegions.length; j++) {
                if (mergedOut.has(j)) continue; // Was already consumed

                let merged = tryMerge(currentRegion, passRegions[j], direction);
                if (merged) {
                    currentRegion = merged; // Grow the current region
                    mergedOut.add(j);       // Mark 'j' as consumed
                    didMerge = true;
                }
            }
            nextPassRegions.push(currentRegion); // Add the final (potentially grown) region
        }
        passRegions = nextPassRegions; // Next pass works on the newly merged list
    }
    return passRegions;
}

/**
 * Finds all widgets that share a border with the trigger widget.
 * Returns an *unmerged* list of active resize items.
 */
export const findAffectedWidgets = (
    triggerWidget: Widget,
    triggerType: ResizeBorder,
    allWidgets: WidgetRegion[]
): ActiveResize[] => {
    const affected: ActiveResize[] = [];
    const {pos: primaryPos} = triggerWidget;

    const movingX = (triggerType === ResizeBorder.Left || triggerType === ResizeBorder.TopLeft || triggerType === ResizeBorder.BottomLeft) ? primaryPos.x :
        (triggerType === ResizeBorder.Right || triggerType === ResizeBorder.TopRight || triggerType === ResizeBorder.BottomRight) ? primaryPos.x + primaryPos.width :
            undefined;

    const movingY = (triggerType === ResizeBorder.Top || triggerType === ResizeBorder.TopLeft || triggerType === ResizeBorder.TopRight) ? primaryPos.y :
        (triggerType === ResizeBorder.Bottom || triggerType === ResizeBorder.BottomLeft || triggerType === ResizeBorder.BottomRight) ? primaryPos.y + primaryPos.height :
            undefined;

    for (const region of allWidgets) {
        const {widget, id: wId} = region;
        const {pos: wPos} = widget;

        // --- REVERTED TO HYBRID LOGIC ---
        // Differentiate between "touching" overlap (for corners) and "strict" overlap (for parallel borders)

        const isCornerResize = triggerType === ResizeBorder.TopLeft ||
            triggerType === ResizeBorder.TopRight ||
            triggerType === ResizeBorder.BottomLeft ||
            triggerType === ResizeBorder.BottomRight;

        // Strict overlap: (A.right > B.left + E) && (B.right > A.left + E)
        const strictXOverlap = (primaryPos.x + primaryPos.width > wPos.x + EPSILON) && (wPos.x + wPos.width > primaryPos.x + EPSILON);
        // Strict overlap: (A.bottom > B.top + E) && (B.bottom > A.top + E)
        const strictYOverlap = (primaryPos.y + primaryPos.height > wPos.y + EPSILON) && (wPos.y + wPos.height > primaryPos.y + EPSILON);

        // Touching overlap: (A.top < B.bottom + E) && (A.bottom > B.top - E)
        const touchingXOverlap = (primaryPos.x < (wPos.x + wPos.width + EPSILON)) && ((primaryPos.x + primaryPos.width) > (wPos.x - EPSILON));
        // Touching overlap: (A.left < B.right + E) && (A.right > B.left - E)
        const touchingYOverlap = (primaryPos.y < (wPos.y + wPos.height + EPSILON)) && ((primaryPos.y + primaryPos.height) > (wPos.y - EPSILON));

        // By default, use "touching" overlap, as this works for corners.
        let xOverlapToUse = touchingXOverlap;
        let yOverlapToUse = touchingYOverlap;

        // BUT, if it's a straight-border resize, use strict overlap for the perpendicular axis.
        if (!isCornerResize) {
            if (triggerType === ResizeBorder.Top || triggerType === ResizeBorder.Bottom) {
                // Moving Top/Bottom: use strict X overlap to avoid linking side-by-side widgets
                xOverlapToUse = strictXOverlap;
            }
            if (triggerType === ResizeBorder.Left || triggerType === ResizeBorder.Right) {
                // Moving Left/Right: use strict Y overlap to avoid linking stacked widgets
                yOverlapToUse = strictYOverlap;
            }
        }
        // --- END HYBRID LOGIC ---

        // Check for X-border participation
        if (movingX !== undefined) {
            if (isClose(wPos.x, movingX) && yOverlapToUse) {
                affected.push({type: ResizeBorder.Left, id: wId});
            } else if (isClose(wPos.x + wPos.width, movingX) && yOverlapToUse) {
                affected.push({type: ResizeBorder.Right, id: wId});
            }
        }

        // Check for Y-border participation
        if (movingY !== undefined) {
            if (isClose(wPos.y, movingY) && xOverlapToUse) {
                affected.push({type: ResizeBorder.Top, id: wId});
            } else if (isClose(wPos.y + wPos.height, movingY) && xOverlapToUse) {
                affected.push({type: ResizeBorder.Bottom, id: wId});
            }
        }
    }
    return affected;
}

export const mergeActiveList = (list: ActiveResize[]): ActiveResize[] => {
    const mergedMap = new Map<string, ResizeBorder>();
    for (const item of list) {
        const existing = mergedMap.get(item.id);
        if (!existing) {
            mergedMap.set(item.id, item.type);
        } else {
            // Merge logic
            if ((existing === ResizeBorder.Top && item.type === ResizeBorder.Left) || (existing === ResizeBorder.Left && item.type === ResizeBorder.Top)) mergedMap.set(item.id, ResizeBorder.TopLeft);
            else if ((existing === ResizeBorder.Top && item.type === ResizeBorder.Right) || (existing === ResizeBorder.Right && item.type === ResizeBorder.Top)) mergedMap.set(item.id, ResizeBorder.TopRight);
            else if ((existing === ResizeBorder.Bottom && item.type === ResizeBorder.Left) || (existing === ResizeBorder.Left && item.type === ResizeBorder.Bottom)) mergedMap.set(item.id, ResizeBorder.BottomLeft);
            else if ((existing === ResizeBorder.Bottom && item.type === ResizeBorder.Right) || (existing === ResizeBorder.Right && item.type === ResizeBorder.Bottom)) mergedMap.set(item.id, ResizeBorder.BottomRight);
            // else: it's a redundant add (e.g., Left and Left), do nothing
        }
    }
    // Re-map back to ActiveResize[]
    return Array.from(mergedMap.entries()).map(([id, type]) => ({id, type}));
}