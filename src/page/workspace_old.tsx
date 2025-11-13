// import React, {ReactNode, useEffect, useLayoutEffect, useRef, useState} from "react";
// import ToolRegion from "../component/panel_section.tsx";
// import {invoke} from "@tauri-apps/api/core";
// import {SessionWindow} from "../session_manager.tsx";
// import {BoundingBox, PanelBehavior, ToolContainerProps, Widget} from "../tool/tool.ts";
// import {toolRegistry} from "../main.tsx";
// import {Project} from "../device.tsx";
// import {Dropdown, DropdownItem} from "../component/dropdown.tsx";
// import Button from "../component/button.tsx";
// import {useAlerts} from "../alert.tsx";
//
// const SNAP_THRESHOLD = 0.025
// const BORDER_VALUES = [0, 0.25, 0.5, 0.75, 1]
// const MINIMUM_LENGTH = 0.25;
// const EPSILON = 1e-5; // For floating point comparisons
// const DEBUG = true
//
// enum ResizeBorder {
//     TopRight,
//     Top,
//     TopLeft,
//     Left,
//     BottomLeft,
//     Bottom,
//     BottomRight,
//     Right
// }
//
// type ActiveResize = {
//     type: ResizeBorder,
//     // No widget object here, as it would become stale.
//     id: string
// }
//
// // --- NEW ---
// // Type for tracking the active drag operation
// type ActiveDrag = {
//     id: string,
//     originalPos: BoundingBox,
//     // Mouse start position relative to container (0-1)
//     startMouse: { x: number, y: number }
// }
//
// // Type for tracking the potential drop target
// type DragTarget = {
//     type: 'empty' | 'widget',
//     id: string, // widget id or empty-region-index
//     box: BoundingBox
// }
// // --- END NEW ---
//
//
// type WidgetRegion = {
//     widget: Widget,
//     id: string,
//     neighbors: {
//         id: string,
//         border: ResizeBorder,
//     }[]
// }
//
// // Snapping and Constraining Helpers
// const snapValue = (value: number): number => {
//     for (const border of BORDER_VALUES) {
//         if (Math.abs(value - border) < SNAP_THRESHOLD) {
//             return border;
//         }
//         // Constrain to screen height/width
//         if (value > 1) {
//             return 1;
//         }
//         if (value < 0) {
//             return 0;
//         }
//     }
//     return value;
// }
//
// const snapBoundingBox = (pos: BoundingBox): BoundingBox => {
//     const x = snapValue(pos.x);
//     const y = snapValue(pos.y);
//     const right = snapValue(pos.x + pos.width);
//     const bottom = snapValue(pos.y + pos.height);
//
//     return {
//         x: x,
//         y: y,
//         width: right - x,
//         height: bottom - y
//     }
// }
//
// // Overlap check helper
// const overlaps = (boxA: BoundingBox, boxB: BoundingBox) => {
//     // Check if they don't overlap
//     if ((boxA.x + boxA.width - EPSILON) <= boxB.x || // A is left of B
//         (boxB.x + boxB.width - EPSILON) <= boxA.x || // B is left of A
//         (boxA.y + boxA.height - EPSILON) <= boxB.y || // A is above B
//         (boxB.y + boxB.height - EPSILON) <= boxA.y)   // B is above A
//     {
//         return false;
//     }
//     return true; // They overlap
// };
//
// // --- Helper for merging empty rectangles ---
// const tryMerge = (r1: BoundingBox, r2: BoundingBox, direction: 'horizontal' | 'vertical'): BoundingBox | null => {
//     if (direction === 'horizontal') {
//         // Try merge right (r2 is to the right of r1)
//         if (Math.abs(r1.y - r2.y) < EPSILON && Math.abs(r1.height - r2.height) < EPSILON && Math.abs(r1.x + r1.width - r2.x) < EPSILON) {
//             return {x: r1.x, y: r1.y, width: r1.width + r2.width, height: r1.height};
//         }
//         // Try merge left (r2 is to the left of r1)
//         if (Math.abs(r1.y - r2.y) < EPSILON && Math.abs(r1.height - r2.height) < EPSILON && Math.abs(r2.x + r2.width - r1.x) < EPSILON) {
//             return {x: r2.x, y: r1.y, width: r1.width + r2.width, height: r1.height};
//         }
//     } else { // vertical
//         // Try merge down (r2 is below r1)
//         if (Math.abs(r1.x - r2.x) < EPSILON && Math.abs(r1.width - r2.width) < EPSILON && Math.abs(r1.y + r1.height - r2.y) < EPSILON) {
//             return {x: r1.x, y: r1.y, width: r1.width, height: r1.height + r2.height};
//         }
//         // Try merge up (r2 is above r1)
//         if (Math.abs(r1.x - r2.x) < EPSILON && Math.abs(r1.width - r2.width) < EPSILON && Math.abs(r2.y + r2.height - r1.y) < EPSILON) {
//             return {x: r1.x, y: r2.y, width: r1.width, height: r1.height + r2.height};
//         }
//     }
//     return null;
// };
//
// /**
//  * Runs a stable merge pass in one direction (horizontal or vertical).
//  * It repeatedly scans the list and merges adjacent regions until no
//  * more merges are possible in that direction.
//  */
// const runMergePass = (regions: BoundingBox[], direction: 'horizontal' | 'vertical'): BoundingBox[] => {
//     let passRegions = [...regions];
//     let didMerge = true;
//
//     while (didMerge) {
//         didMerge = false;
//         let nextPassRegions: BoundingBox[] = [];
//         let mergedOut = new Set<number>(); // Indices of regions that were merged *into* others
//
//         for (let i = 0; i < passRegions.length; i++) {
//             if (mergedOut.has(i)) continue; // Was already consumed
//             let currentRegion = passRegions[i];
//
//             for (let j = i + 1; j < passRegions.length; j++) {
//                 if (mergedOut.has(j)) continue; // Was already consumed
//
//                 let merged = tryMerge(currentRegion, passRegions[j], direction);
//                 if (merged) {
//                     currentRegion = merged; // Grow the current region
//                     mergedOut.add(j);       // Mark 'j' as consumed
//                     didMerge = true;
//                 }
//             }
//             nextPassRegions.push(currentRegion); // Add the final (potentially grown) region
//         }
//         passRegions = nextPassRegions; // Next pass works on the newly merged list
//     }
//     return passRegions;
// }
//
//
// export const Workspace: React.FC<{ id: string, project: Project } & SessionWindow> = ({
//                                                                                               id,
//                                                                                               project,
//                                                                                               onClose
//                                                                                           }) => {
//     const [bound, setBound] = useState<BoundingBox | undefined>(undefined);
//     const container = useRef<HTMLDivElement>(null)
//
//     const [widgets, setWidgets] = useState<WidgetRegion[]>([])
//     // Use a ref for active resize state to be read by global event listeners
//     const activeResizeRef = useRef<ActiveResize[]>([]);
//     const [emptyRegions, setEmptyRegions] = useState<BoundingBox[]>([])
//
//     const [dragPreview, setDragPreview] = useState<{ box: BoundingBox } | null>(null);
//     const [dropHighlight, setDropHighlight] = useState<BoundingBox | null>(null);
//     const activeDragRef = useRef<ActiveDrag | null>(null);
//     const dragTargetRef = useRef<DragTarget | null>(null);
//
//     const modified = useRef<Widget[]>([]);
//     const alerts = useAlerts();
//
//     useLayoutEffect(() => {
//         let listener = () => {
//             if (container.current) {
//                 setBound(container.current?.getBoundingClientRect())
//             }
//         };
//
//         window.addEventListener("resize", listener)
//
//         return () => window.removeEventListener("resize", listener)
//     });
//
//     useEffect(() => {
//         const cb = setInterval(() => {
//             if (modified.current.length == 0) return
//
//             invoke("workspace_push", {
//                 workspace: {
//                     id: id,
//                     widgets: modified.current,
//                 }
//             }).then(() => {
//                 modified.current = [];
//                 // alerts.showAlert("info", "Workspace saved.");
//             }).catch((e) => {
//                 alerts.showAlert("error", e.toString())
//             })
//         }, 1000);
//
//         return () => clearInterval(cb);
//     },[])
//
//     useEffect(() => {
//         modified.current = widgets.map((it) => it.widget)
//     }, [widgets]);
//
//     useEffect(() => {
//         if (container.current) setBound(container.current.getBoundingClientRect())
//     }, [container]);
//
//     useEffect(() => {
//         invoke("workspace_get", {
//             id: id
//         }).then((result) => {
//             const layout = result as { id: string, widgets: Widget[] }
//
//             let id = 0
//             let regions = layout.widgets.map((w) => ({
//                 widget: w,
//                 id: `widget-${id++}`,
//                 neighbors: []
//             }));
//             let widgetRegions = recomputeNeighbors(regions);
//             console.log(widgetRegions)
//             setWidgets(widgetRegions);
//         })
//
//         onClose(async () => {
//             await project.close()
//         })
//     }, [id, onClose, project]);
//
//     // --- Empty region calculation ---
//     useEffect(() => {
//         if (widgets.length === 0) {
//             setEmptyRegions([{x: 0, y: 0, width: 1, height: 1}]);
//             return;
//         }
//
//         const xCoords = new Set<number>([0, 1]);
//         const yCoords = new Set<number>([0, 1]);
//
//         widgets.forEach(({widget}) => {
//             xCoords.add(widget.pos.x);
//             xCoords.add(widget.pos.x + widget.pos.width);
//             yCoords.add(widget.pos.y);
//             yCoords.add(widget.pos.y + widget.pos.height);
//         });
//
//         const sortedX = Array.from(xCoords).sort((a, b) => a - b);
//         const sortedY = Array.from(yCoords).sort((a, b) => a - b);
//
//         const allEmptyCells: BoundingBox[] = [];
//
//         for (let i = 0; i < sortedX.length - 1; i++) {
//             const x = sortedX[i];
//             const width = sortedX[i + 1] - x;
//
//             if (width <= EPSILON) continue; // Skip 0-width cells
//
//             for (let j = 0; j < sortedY.length - 1; j++) {
//                 const y = sortedY[j];
//                 const height = sortedY[j + 1] - y;
//
//                 if (height <= EPSILON) continue; // Skip 0-height cells
//
//                 const midX = x + width / 2;
//                 const midY = y + height / 2;
//
//                 const isOccupied = widgets.some(({widget}) => {
//                     const {pos} = widget;
//                     // Check if midpoint is inside the widget (with epsilon)
//                     return midX > (pos.x + EPSILON) && midX < (pos.x + pos.width - EPSILON) &&
//                         midY > (pos.y + EPSILON) && midY < (pos.y + pos.height - EPSILON);
//                 });
//
//                 if (!isOccupied) {
//                     allEmptyCells.push({x, y, width, height});
//                 }
//             }
//         }
//
//         // 1. Find all horizontally-maximal rectangles
//         const horizontalRegions = runMergePass(allEmptyCells, 'horizontal');
//
//         // 2. Find all vertically-maximal rectangles
//         const verticalRegions = runMergePass(allEmptyCells, 'vertical');
//
//         // 3. Combine, de-duplicate, and filter by minimum size
//         const regionMap = new Map<string, BoundingBox>();
//         const allCandidates = [...horizontalRegions, ...verticalRegions];
//
//         allCandidates.forEach(r => {
//             // Filter out regions that are too small early
//             if (r.width >= (MINIMUM_LENGTH - EPSILON) && r.height >= (MINIMUM_LENGTH - EPSILON)) {
//                 // Use a string key to de-duplicate
//                 const key = `${r.x},${r.y},${r.width},${r.height}`;
//                 regionMap.set(key, r);
//             }
//         });
//
//         const uniqueCandidates = Array.from(regionMap.values());
//
//         // 4. Sort by area, descending
//         uniqueCandidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
//
//         // 5. Greedily select largest regions that don't overlap with already-selected ones
//         const finalRegions: BoundingBox[] = [];
//         for (const candidate of uniqueCandidates) {
//             const isOverlapped = finalRegions.some(r => overlaps(r, candidate));
//             if (!isOverlapped) {
//                 finalRegions.push(candidate);
//             }
//         }
//
//         setEmptyRegions(finalRegions);
//     }, [widgets]);
//
//     const getWidgetById = (id: string) => {
//         return widgets.find((w) => w.id === id)
//     }
//
//     // --- Handler to remove a widget ---
//     const handleRemoveWidget = (id: string) => {
//         setWidgets(currentWidgets => currentWidgets.filter(w => w.id !== id));
//     }
//
//     const handleAddWidget = (widget: Widget) => {
//         setWidgets((currentWidgets) => {
//             // Lazy new ID
//             const newID = `widget-at-${Date.now()}`
//             const updated = [
//                 ...currentWidgets,
//                 {
//                     widget: widget,
//                     id: newID,
//                     neighbors: []
//                 }
//             ]
//
//             return recomputeNeighbors(updated);
//         });
//     }
//
//     // --- Drag and Drop Handlers ---
//     const handleDragStart = (e: React.MouseEvent, widgetRegion: WidgetRegion) => {
//         let target = e.target as HTMLElement;
//         while (target && target !== e.currentTarget) {
//             if (target.getAttribute('data-drag-cancel') === 'true') {
//                 return; // Don't start drag, let button click handle it
//             }
//             target = target.parentElement as HTMLElement;
//         }
//
//         // Only drag with left click
//         if (e.button !== 0 || !container.current) return;
//
//         e.preventDefault();
//         e.stopPropagation();
//
//         const currentBound = container.current.getBoundingClientRect();
//         setBound(currentBound) // Ensure bounds are fresh
//
//         const startMouse = {
//             x: (e.clientX - currentBound.x) / currentBound.width,
//             y: (e.clientY - currentBound.y) / currentBound.height
//         }
//
//         activeDragRef.current = {
//             id: widgetRegion.id,
//             originalPos: widgetRegion.widget.pos,
//             startMouse: startMouse
//         };
//
//         setDragPreview({box: widgetRegion.widget.pos});
//
//         window.addEventListener('mousemove', handleGlobalDragMove);
//         window.addEventListener('mouseup', handleGlobalDragEnd);
//     }
//
//     const handleGlobalDragMove = (e: MouseEvent) => {
//         const dragState = activeDragRef.current;
//         const currentBound = bound; // Use state bound
//         if (!dragState || !currentBound) return;
//
//         const mouse = {
//             x: (e.clientX - currentBound.x) / currentBound.width,
//             y: (e.clientY - currentBound.y) / currentBound.height
//         };
//
//         // 1. Update Ghost Preview
//         const delta = {
//             x: mouse.x - dragState.startMouse.x,
//             y: mouse.y - dragState.startMouse.y
//         };
//         const newPreviewBox: BoundingBox = {
//             x: dragState.originalPos.x + delta.x,
//             y: dragState.originalPos.y + delta.y,
//             width: dragState.originalPos.width,
//             height: dragState.originalPos.height
//         };
//         setDragPreview({box: newPreviewBox});
//
//         // 2. Find Drop Target
//         let target: DragTarget | null = null;
//         const dragId = dragState.id;
//
//         // 2a. Check for widget swap target
//         for (const w of widgets) {
//             if (w.id === dragId) continue;
//             const {pos} = w.widget;
//             // Is mouse inside this widget?
//             if (mouse.x > pos.x && mouse.x < (pos.x + pos.width) &&
//                 mouse.y > pos.y && mouse.y < (pos.y + pos.height)) {
//
//                 // must already meet MINIMUM_LENGTH.
//                 target = {type: 'widget', id: w.id, box: pos};
//                 break;
//             }
//         }
//
//         // 2b. Check for empty region target
//         if (!target) {
//             for (let i = 0; i < emptyRegions.length; i++) {
//                 const region = emptyRegions[i];
//                 // Is mouse inside this region?
//                 if (mouse.x > region.x && mouse.x < (region.x + region.width) &&
//                     mouse.y > region.y && mouse.y < (region.y + region.height)) {
//
//                     target = {type: 'empty', id: `empty-${i}`, box: region};
//                     break;
//                 }
//             }
//         }
//
//         // 3. Update highlight
//         if (target) {
//             setDropHighlight(target.box);
//             dragTargetRef.current = target;
//         } else {
//             setDropHighlight(null);
//             dragTargetRef.current = null;
//         }
//     }
//
//     const handleGlobalDragEnd = () => {
//         const dragState = activeDragRef.current;
//         const dragTarget = dragTargetRef.current;
//
//         if (dragState && dragTarget) {
//             setWidgets(currentWidgets => {
//                 const dragId = dragState.id;
//                 const targetId = dragTarget.id;
//
//                 const dragIndex = currentWidgets.findIndex(w => w.id === dragId);
//                 if (dragIndex === -1) return currentWidgets; // Widget was removed mid-drag?
//
//                 let newWidgets = [...currentWidgets];
//
//                 if (dragTarget.type === 'empty') {
//                     // Widget takes on the position and dimensions of the empty region
//                     newWidgets[dragIndex] = {
//                         ...newWidgets[dragIndex],
//                         widget: {
//                             ...newWidgets[dragIndex].widget,
//                             pos: dragTarget.box
//                         }
//                     };
//
//                 } else if (dragTarget.type === 'widget') {
//                     // Swap with Other Widget
//                     const targetIndex = currentWidgets.findIndex(w => w.id === targetId);
//                     if (targetIndex === -1) return currentWidgets; // Target widget removed?
//
//                     // Get the positions to be swapped
//                     const dragOriginalPos = newWidgets[dragIndex].widget.pos;
//                     const targetOriginalPos = newWidgets[targetIndex].widget.pos;
//
//                     // Atomically update the array
//                     newWidgets[dragIndex] = {
//                         ...newWidgets[dragIndex],
//                         widget: {
//                             ...newWidgets[dragIndex].widget,
//                             pos: targetOriginalPos // Target widget gets dragged widget's original box
//                         }
//                     };
//                     newWidgets[targetIndex] = {
//                         ...newWidgets[targetIndex],
//                         widget: {
//                             ...newWidgets[targetIndex].widget,
//                             pos: dragOriginalPos // Dragged widget gets target's box
//                         }
//                     };
//                 }
//
//                 // Return the new state, which will trigger recompute of neighbors
//                 return recomputeNeighbors(newWidgets);
//             });
//         }
//
//         // Cleanup
//         activeDragRef.current = null;
//         dragTargetRef.current = null;
//         setDragPreview(null);
//         setDropHighlight(null);
//         window.removeEventListener('mousemove', handleGlobalDragMove);
//         window.removeEventListener('mouseup', handleGlobalDragEnd);
//     }
//
//     const handleResizeStart = (type: ResizeBorder, _: Widget, id: string, neighbors: {
//         id: string,
//         border: ResizeBorder
//     }[]) => {
//         // Find all adjacent neighbors
//         let affectedNeighbors: ActiveResize[] = neighbors.flatMap((n) => {
//             // Read from current state to be safe
//             const nWidget = getWidgetById(n.id)
//             if (!nWidget) return []
//
//             const neighborBorder = nWidget.neighbors.find((n) => n.id === id)?.border;
//             if (neighborBorder === undefined) return []
//
//             return [{
//                 type: neighborBorder,
//                 id: n.id
//             }]
//         });
//
//         // Set the active resize state in the ref
//         activeResizeRef.current = [
//             {type: type, id: id},
//             ...affectedNeighbors
//         ];
//
//         // --- Add Global Event Listeners ---
//         const handleGlobalMouseMove = (e: MouseEvent) => {
//             // ** This is the key: All logic is inside the state updater **
//             // This guarantees `currentWidgets` is fresh on every move.
//             setWidgets(currentWidgets => {
//                 const currentActive = activeResizeRef.current;
//                 if (currentActive.length === 0) return currentWidgets;
//
//                 const current = container.current?.getBoundingClientRect();
//                 if (!current) return currentWidgets;
//
//                 // Helper to get the *current* widget data from the state
//                 const getWidgetFromState = (id: string) => currentWidgets.find(w => w.id === id);
//
//                 const primaryActive = currentActive[0];
//                 const primaryWidgetRegion = getWidgetFromState(primaryActive.id);
//                 if (!primaryWidgetRegion) return currentWidgets; // Widget removed? Abort.
//                 const primaryWidget = primaryWidgetRegion.widget;
//
//                 console.log("primary:", primaryWidgetRegion)
//
//                 const neighborsActive = currentActive.slice(1);
//                 const neighborsWidgets = neighborsActive.map(n => {
//                     const region = getWidgetFromState(n.id);
//                     // This can happen if a widget is removed mid-drag, though unlikely
//                     if (!region) return null;
//                     return {...n, widget: region.widget};
//                 }).filter(n => n !== null) as (ActiveResize & { widget: Widget })[]; // Filter out nulls
//
//                 console.log("NeighborsActive", neighborsWidgets);
//
//                 // % mouse position
//                 const mouse = {
//                     x: (e.clientX - current.x) / current.width,
//                     y: (e.clientY - current.y) / current.height
//                 }
//
//                 // 1. Calculate primary box
//                 let primaryBox: BoundingBox;
//                 switch (primaryActive.type) {
//                     case ResizeBorder.TopLeft:
//                         primaryBox = {
//                             x: mouse.x, y: mouse.y,
//                             width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
//                             height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y),
//                         };
//                         break;
//                     case ResizeBorder.BottomLeft:
//                         primaryBox = {
//                             x: mouse.x, y: primaryWidget.pos.y,
//                             width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
//                             height: mouse.y - primaryWidget.pos.y
//                         };
//                         break;
//                     case ResizeBorder.BottomRight:
//                         primaryBox = {
//                             x: primaryWidget.pos.x, y: primaryWidget.pos.y,
//                             width: mouse.x - primaryWidget.pos.x,
//                             height: mouse.y - primaryWidget.pos.y
//                         };
//                         break;
//                     case ResizeBorder.TopRight:
//                         primaryBox = {
//                             x: primaryWidget.pos.x, y: mouse.y,
//                             width: mouse.x - primaryWidget.pos.x,
//                             height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y)
//                         };
//                         break;
//                     case ResizeBorder.Top:
//                         primaryBox = {
//                             x: primaryWidget.pos.x, y: mouse.y,
//                             width: primaryWidget.pos.width,
//                             height: primaryWidget.pos.height - (mouse.y - primaryWidget.pos.y)
//                         };
//                         break;
//                     case ResizeBorder.Left:
//                         primaryBox = {
//                             x: mouse.x, y: primaryWidget.pos.y,
//                             width: primaryWidget.pos.width - (mouse.x - primaryWidget.pos.x),
//                             height: primaryWidget.pos.height
//                         };
//                         break;
//                     case ResizeBorder.Bottom:
//                         primaryBox = {
//                             x: primaryWidget.pos.x, y: primaryWidget.pos.y,
//                             width: primaryWidget.pos.width,
//                             height: mouse.y - primaryWidget.pos.y
//                         };
//                         break;
//                     case ResizeBorder.Right:
//                         primaryBox = {
//                             x: primaryWidget.pos.x, y: primaryWidget.pos.y,
//                             width: mouse.x - primaryWidget.pos.x,
//                             height: primaryWidget.pos.height
//                         };
//                         break;
//                 }
//
//                 // 2. Snap primary box
//                 let newPrimaryPos = snapBoundingBox(primaryBox);
//
//                 // --- COLLISION DETECTION & SNAPPING ---
//                 const neighborIds = new Set(neighborsActive.map(n => n.id));
//
//                 for (const widget of currentWidgets) {
//                     if (widget.id === primaryActive.id || neighborIds.has(widget.id)) {
//                         continue; // Skip self and active neighbors
//                     }
//
//                     if (overlaps(newPrimaryPos, widget.widget.pos)) {
//                         // Constrain the move ("snap").
//                         switch (primaryActive.type) {
//                             case ResizeBorder.Right:
//                             case ResizeBorder.TopRight:
//                             case ResizeBorder.BottomRight:
//                                 newPrimaryPos.width = widget.widget.pos.x - newPrimaryPos.x;
//                                 break;
//                             case ResizeBorder.Left:
//                             case ResizeBorder.TopLeft:
//                             case ResizeBorder.BottomLeft:
//                                 const oldRight = newPrimaryPos.x + newPrimaryPos.width;
//                                 newPrimaryPos.x = widget.widget.pos.x + widget.widget.pos.width;
//                                 newPrimaryPos.width = oldRight - newPrimaryPos.x;
//                                 break;
//                             case ResizeBorder.Bottom:
//                                 newPrimaryPos.height = widget.widget.pos.y - newPrimaryPos.y;
//                                 break;
//                             case ResizeBorder.Top:
//                                 const oldBottom = newPrimaryPos.y + newPrimaryPos.height;
//                                 newPrimaryPos.y = widget.widget.pos.y + widget.widget.pos.height;
//                                 newPrimaryPos.height = oldBottom - newPrimaryPos.y;
//                                 break;
//                         }
//
//                         // Re-snap after constraining
//                         newPrimaryPos = snapBoundingBox(newPrimaryPos);
//                     }
//                 }
//                 // --- END COLLISION ---
//
//                 if (newPrimaryPos.width < (MINIMUM_LENGTH - EPSILON) || newPrimaryPos.height < (MINIMUM_LENGTH - EPSILON)) {
//                     return currentWidgets; // Abort move
//                 }
//
//                 const newPositions = new Map<string, BoundingBox>();
//                 newPositions.set(primaryActive.id, newPrimaryPos);
//                 let isConstrained = false;
//
//                 // 3. Calculate neighbor positions
//                 for (const neighbor of neighborsWidgets) {
//                     const originalNeighborPos = neighbor.widget.pos;
//                     let newNeighborBox: BoundingBox = {...originalNeighborPos};
//                     switch (neighbor.type) {
//                         case ResizeBorder.Left: {
//                             const newLeft = newPrimaryPos.x + newPrimaryPos.width;
//                             newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
//                             newNeighborBox.x = newLeft;
//                             break;
//                         }
//                         case ResizeBorder.Right: {
//                             const newRight = newPrimaryPos.x;
//                             newNeighborBox.width = newRight - originalNeighborPos.x;
//                             break;
//                         }
//                         case ResizeBorder.Top: {
//                             const newTop = newPrimaryPos.y + newPrimaryPos.height;
//                             newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
//                             newNeighborBox.y = newTop;
//                             break;
//                         }
//                         case ResizeBorder.Bottom: {
//                             const newBottom = newPrimaryPos.y;
//                             newNeighborBox.height = newBottom - originalNeighborPos.y;
//                             break;
//                         }
//                         case ResizeBorder.TopLeft: {
//                             const newLeft = newPrimaryPos.x + newPrimaryPos.width;
//                             newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
//                             newNeighborBox.x = newLeft;
//                             const newTop = newPrimaryPos.y + newPrimaryPos.height;
//                             newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
//                             newNeighborBox.y = newTop;
//                             break;
//                         }
//                         case ResizeBorder.TopRight: {
//                             const newRight = newPrimaryPos.x;
//                             newNeighborBox.width = newRight - originalNeighborPos.x;
//                             const newTop = newPrimaryPos.y + newPrimaryPos.height;
//                             newNeighborBox.height = (originalNeighborPos.y + originalNeighborPos.height) - newTop;
//                             newNeighborBox.y = newTop;
//                             break;
//                         }
//                         case ResizeBorder.BottomLeft: {
//                             const newLeft = newPrimaryPos.x + newPrimaryPos.width;
//                             newNeighborBox.width = (originalNeighborPos.x + originalNeighborPos.width) - newLeft;
//                             newNeighborBox.x = newLeft;
//                             const newBottom = newPrimaryPos.y;
//                             newNeighborBox.height = newBottom - originalNeighborPos.y;
//                             break;
//                         }
//                         case ResizeBorder.BottomRight: {
//                             const newRight = newPrimaryPos.x;
//                             newNeighborBox.width = newRight - originalNeighborPos.x;
//                             const newBottom = newPrimaryPos.y;
//                             newNeighborBox.height = newBottom - originalNeighborPos.y;
//                             break;
//                         }
//                     }
//
//                     const newNeighborPos = snapBoundingBox(newNeighborBox);
//                     if (newNeighborPos.width < (MINIMUM_LENGTH - EPSILON) || newNeighborPos.height < (MINIMUM_LENGTH - EPSILON)) {
//                         isConstrained = true;
//                         break;
//                     }
//                     newPositions.set(neighbor.id, newNeighborPos);
//                 }
//
//                 if (isConstrained) return currentWidgets; // Abort move
//
//                 // 6. Atomically update
//                 const updatedWidgets = currentWidgets.map(w => {
//                     if (newPositions.has(w.id)) {
//                         return {
//                             ...w,
//                             widget: {...w.widget, pos: newPositions.get(w.id)!},
//                             neighbors: []
//                         };
//                     }
//                     return w;
//                 });
//
//                 return recomputeNeighbors(updatedWidgets);
//             });
//         };
//
//         const handleGlobalMouseUp = () => {
//             activeResizeRef.current = []; // Clear ref
//             window.removeEventListener('mousemove', handleGlobalMouseMove);
//             window.removeEventListener('mouseup', handleGlobalMouseUp);
//         };
//
//         window.addEventListener('mousemove', handleGlobalMouseMove);
//         window.addEventListener('mouseup', handleGlobalMouseUp);
//     }
//
//     return <div
//         className={"h-full"}
//         ref={container}
//     >
//         {bound && widgets.map(({widget, id, neighbors}, key) => {
//             let behavior = widget.behavior!!;
//
//             let tool = toolRegistry
//                 .find((it) => it.type == behavior.type);
//
//             if (!tool) return <>Tool not found?</>
//             return <ToolRegion
//                 pad={5}
//                 className={"bg-white"}
//                 key={key}
//                 panel={widget.pos}
//                 rect={bound}
//                 style={{
//                     opacity: activeDragRef.current?.id === id ? 0 : 1,
//                     transition: 'opacity 150ms ease-in-out'
//                 }}
//             >
//                 <ResizeAware debug={DEBUG} onResizeStart={(type) => {
//                     handleResizeStart(type, widget, id, neighbors);
//                 }}>
//                     {DEBUG && <div>ID: ${id}</div>}
//                     <span className={"h-full flex flex-col"}>
//                         {tool.header(behavior, (props) => {
//                             return <WidgetHeader
//                                 {...props}
//                                 onClose={() => handleRemoveWidget(id)}
//                                 onStartDrag={(e) => handleDragStart(e, {widget, id, neighbors})}
//                             />
//                         })}
//                         <span className="flex-1 min-h-0">
//                             {tool.widget(project, behavior)}
//                         </span>
//                     </span>
//                 </ResizeAware>
//             </ToolRegion>
//         })}
//         {
//             bound && emptyRegions.map((region, index) => {
//                 const style: React.CSSProperties = {
//                     position: 'absolute',
//                     left: region.x * bound.width + bound.x,
//                     top: region.y * bound.height + bound.y,
//                     width: region.width * bound.width,
//                     height: region.height * bound.height,
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'center',
//                 };
//
//                 return (
//                     <div style={style} key={`empty-${index}`}>
//                         <div>
//                             <WidgetConfigurationBox finalize={(behavior) => {
//                                 handleAddWidget({
//                                     behavior: behavior,
//                                     pos: region
//                                 })
//                             }}/>
//                         </div>
//                         {/*<button*/}
//                         {/*    style={buttonStyle}*/}
//                         {/*    className={"hover:text-gray-600"}*/}
//                         {/*    onClick={() => handleAddWidget(region)}*/}
//                         {/*>+*/}
//                         {/*</button>*/}
//                     </div>
//                 )
//             })
//         }
//         {bound && dragPreview && (
//             <div style={{
//                 position: 'absolute',
//                 left: dragPreview.box.x * bound.width + bound.x,
//                 top: dragPreview.box.y * bound.height + bound.y,
//                 width: dragPreview.box.width * bound.width,
//                 height: dragPreview.box.height * bound.height,
//                 backgroundColor: 'rgba(0, 100, 255, 0.3)',
//                 border: '2px dashed rgba(0, 100, 255, 0.7)',
//                 zIndex: 100,
//                 pointerEvents: 'none',
//                 boxSizing: 'border-box',
//             }}/>
//         )}
//         {bound && dropHighlight && (
//             <div style={{
//                 position: 'absolute',
//                 left: dropHighlight.x * bound.width + bound.x,
//                 top: dropHighlight.y * bound.height + bound.y,
//                 width: dropHighlight.width * bound.width,
//                 height: dropHighlight.height * bound.height,
//                 backgroundColor: 'rgba(0, 255, 100, 0.3)',
//                 border: '2px dashed rgba(0, 255, 100, 0.7)',
//                 zIndex: 90,
//                 pointerEvents: 'none',
//                 boxSizing: 'border-box',
//                 transition: 'all 150ms ease-in-out'
//             }}/>
//         )}
//     </div>
// }
//
// // --- Update WidgetHeader props and implementation ---
// type WidgetHeaderProps = ToolContainerProps & {
//     onStartDrag: (e: React.MouseEvent) => void;
//     onClose: () => void;
// }
//
// function WidgetConfigurationBox(
//     {finalize}: { finalize: (behavior: PanelBehavior) => void },
// ) {
//     const [toolType, setToolType] = useState<string | null>(null)
//     const [behavior, setBehavior] = useState<PanelBehavior | null>(null)
//     const alerts = useAlerts()
//
//     const handleConfig = () => {
//         let tool = toolRegistry.find((tool) => tool.type === toolType);
//
//         if (!tool) {
//             return <></>
//         }
//
//         return tool.configurator((it) => {
//             const behavior = {
//                 type: tool.type,
//                 ...it,
//             } as (PanelBehavior | null) // #trustmebro
//             setBehavior(behavior)
//         })
//     }
//
//     return <div className={"group flex items-center flex-col gap-3 p-10"}>
//         <div>
//             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75"
//                  stroke="currentColor"
//                  className="size-8">
//                 <path stroke-linecap="round" stroke-linejoin="round"
//                       d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"/>
//             </svg>
//         </div>
//         <div className={"flex-col gap-2 hidden group-hover:flex"}>
//             <Dropdown onSelect={(t) => {
//                 setToolType(t)
//             }} value={toolType}>
//                 {toolRegistry.map((it, key) => {
//                     return <DropdownItem key={key} value={it.type}>{it.displayName}</DropdownItem>
//                 })}
//             </Dropdown>
//             {handleConfig()}
//             <Button
//                 onClick={() => {
//                     if (!behavior) {
//                         alerts.showAlert("error", "Please finish configuring this widget.")
//                     } else {
//                         finalize(behavior)
//                     }
//                 }}
//             >Add</Button>
//         </div>
//     </div>
// }
//
// const WidgetHeader: React.FC<WidgetHeaderProps> = ({children, onStartDrag, onClose}) => {
//     const contentContainer = useRef<HTMLDivElement | null>(null);
//     const [height, setHeight] = useState(0);
//     useEffect(() => {
//         setHeight(contentContainer.current?.getBoundingClientRect()?.height ?? 0);
//     }, [contentContainer]);
//
//     return <div
//         className={"cursor-grab"}
//         onMouseDown={onStartDrag} // Attach drag handler here
//     >
//         <div ref={contentContainer}>
//             {children}
//         </div>
//         <button
//             data-drag-cancel="true"
//             onMouseDown={(e) => e.stopPropagation()} // Stop mousedown from triggering drag
//             onClick={(e) => {
//                 e.stopPropagation(); // Prevent drag from starting on close click
//                 onClose();
//             }}
//             style={{
//                 top: `${height / 2}px`,
//                 right: `${height / 2}px`,
//             }}
//             className="
//                     cursor-default
//                     group
//                     -translate-y-1/2
//                     absolute z-50
//                     h-4 w-4 bg-[#ff5c60] rounded-full
//                     transition-colors"
//             aria-label="Close widget"
//         >
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 m-auto invisible group-hover:visible" fill="none"
//                  viewBox="0 0 24 24"
//                  stroke="#802f30">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
//                       d="M6 18L18 6M6 6l12 12"/>
//             </svg>
//         </button>
//     </div>
// }
//
// // const HANDLE_DEBUG = false
//
// const ResizeAware: React.FC<{
//     children: ReactNode | undefined,
//     onResizeStart: (type: ResizeBorder) => void,
//     debug: boolean
// }> = ({children, onResizeStart, debug}) => {
//     return <>
//         {children}
//         <ResizeHandle
//             type={ResizeBorder.TopLeft}
//             cursor={"nwse-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//         <ResizeHandle
//             type={ResizeBorder.Top}
//             cursor={"ns-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//
//         />
//         <ResizeHandle
//             type={ResizeBorder.TopRight}
//             cursor={"nesw-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//
//         />
//         <ResizeHandle
//             type={ResizeBorder.Left}
//             cursor={"ew-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//         <ResizeHandle
//             type={ResizeBorder.Right}
//             cursor={"ew-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//         <ResizeHandle
//             type={ResizeBorder.BottomLeft}
//             cursor={"nesw-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//         <ResizeHandle
//             type={ResizeBorder.Bottom}
//             cursor={"ns-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//         <ResizeHandle
//             type={ResizeBorder.BottomRight}
//             cursor={"nwse-resize"}
//             onStartResize={onResizeStart}
//             debug={debug}
//         />
//     </>
// }
//
// const HANDLE_SIZE = 40
//
// const ResizeHandle: React.FC<{
//     type: ResizeBorder,
//     onStartResize: (type: ResizeBorder) => void,
//     cursor: string,
//     debug: boolean
// }> = ({type, onStartResize, cursor, debug}) => {
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         width: `${HANDLE_SIZE}px`,
//         height: `${HANDLE_SIZE}px`,
//         background: `rgba(0, 100, 255, ${debug ? 0.3 : 0})`,
//         transform: 'translate(-50%, -50%)',
//         cursor: cursor,
//         zIndex: 10,
//     };
//
//     const lengthProperty = `calc(100% - ${HANDLE_SIZE}px)`
//
//     switch (type) {
//         case ResizeBorder.TopLeft:
//             style.top = '0%';
//             style.left = '0%';
//             break;
//         case ResizeBorder.Top:
//             style.top = '0%';
//             style.left = '50%';
//             style.width = lengthProperty
//             break;
//         case ResizeBorder.TopRight:
//             style.top = '0%';
//             style.left = '100%';
//             break;
//         case ResizeBorder.Left:
//             style.top = '50%';
//             style.left = '0%';
//             style.height = lengthProperty
//             break;
//         case ResizeBorder.Right:
//             style.top = '50%';
//             style.left = '100%';
//             style.height = lengthProperty
//             break;
//         case ResizeBorder.BottomLeft:
//             style.top = '100%';
//             style.left = '0%';
//             break;
//         case ResizeBorder.Bottom:
//             style.top = '100%';
//             style.left = '50%';
//             style.width = lengthProperty
//             break;
//         case ResizeBorder.BottomRight:
//             style.top = '100%';
//             style.left = '100%';
//             break;
//     }
//
//     return (
//         <div
//             style={style}
//             onMouseDown={(e) => {
//                 e.stopPropagation();
//                 e.preventDefault();
//                 onStartResize(type);
//             }}
//         />
//     );
// };
//
// const isClose = (a: number, b: number) => Math.abs(a - b) < SNAP_THRESHOLD;
//
// /**
//  * [HELPER] Checks for and adds neighbor links between two regions.
//  * This mutates the neighbor arrays provided.
//  */
// const _checkAndLinkRegions = (
//     posA: BoundingBox, idA: string, neighborsOfA: { id: string, border: ResizeBorder }[],
//     posB: BoundingBox, idB: string, neighborsOfB: { id: string, border: ResizeBorder }[]
// ) => {
//     // --- Define Coordinate Spans ---
//     const rightA = posA.x + posA.width;
//     const bottomA = posA.y + posA.height;
//     const rightB = posB.x + posB.width;
//     const bottomB = posB.y + posB.height;
//
//     // --- Define Overlap Conditions ---
//     // Check for non-trivial overlap (i.e., not just touching at a line)
//     const yOverlap = (posA.y < (bottomB - EPSILON)) && (bottomA > (posB.y + EPSILON));
//     const xOverlap = (posA.x < (rightB - EPSILON)) && (rightA > (posB.x + EPSILON));
//
//
//     // 1. Check A's Right against B's Left
//     if (isClose(rightA, posB.x) && yOverlap) {
//         neighborsOfA.push({id: idB, border: ResizeBorder.Right});
//         neighborsOfB.push({id: idA, border: ResizeBorder.Left});
//     }
//     // 2. Check A's Left against B's Right
//     else if (isClose(posA.x, rightB) && yOverlap) {
//         neighborsOfA.push({id: idB, border: ResizeBorder.Left});
//         neighborsOfB.push({id: idA, border: ResizeBorder.Right});
//     }
//     // 3. Check A's Bottom against B's Top
//     else if (isClose(bottomA, posB.y) && xOverlap) {
//         neighborsOfA.push({id: idB, border: ResizeBorder.Bottom});
//         neighborsOfB.push({id: idA, border: ResizeBorder.Top});
//     }
//     // 4. Check A's Top against B's Bottom
//     else if (isClose(posA.y, bottomB) && xOverlap) {
//         neighborsOfA.push({id: idB, border: ResizeBorder.Top});
//         neighborsOfB.push({id: idA, border: ResizeBorder.Bottom});
//     }
// }
//
// /**
//  * Recomputes the neighbor list for all widget regions. (O(n^2))
//  * This is the "full" recomputation.
//  * @param regions The array of widget regions to process.
//  * @returns A new array of widget regions with updated neighbor lists.
//  */
// export const recomputeNeighbors = (regions: WidgetRegion[]): WidgetRegion[] => {
//     // Create a Map to build the new neighbor lists.
//     const neighborMap = new Map<string, { id: string, border: ResizeBorder }[]>();
//     regions.forEach(region => neighborMap.set(region.id, []));
//
//     // Use a nested loop to compare each pair of regions exactly once.
//     for (let i = 0; i < regions.length; i++) {
//         const regionA = regions[i];
//         const posA = regionA.widget.pos;
//         const neighborsA = neighborMap.get(regionA.id)!;
//
//         for (let j = i + 1; j < regions.length; j++) {
//             const regionB = regions[j];
//             const posB = regionB.widget.pos;
//             const neighborsB = neighborMap.get(regionB.id)!;
//
//             _checkAndLinkRegions(posA, regionA.id, neighborsA, posB, regionB.id, neighborsB);
//         }
//     }
//
//     // Map the original regions to a new array, injecting the new neighbor list.
//     let map = regions.map(region => ({
//         ...region,
//         neighbors: neighborMap.get(region.id) || [],
//     }));
//     console.log("Recomputed: ", map)
//     return map;
// }


// --- NEIGHBOR COMPUTATION FUNCTIONS REMOVED ---
// _checkAndLinkRegions REMOVED
// recomputeNeighbors REMOVED