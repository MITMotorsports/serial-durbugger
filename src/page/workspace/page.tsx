import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {useAlerts} from "../../alert.tsx";
import {toolRegistry} from "../../main.tsx";
import {Project} from "../../device.tsx";
import {SessionWindow} from "../../session_manager.tsx";
import {BoundingBox, Widget} from "../../widget/tool.ts";
import {ActiveDrag, ActiveResize, DragTarget, ResizeBorder, WidgetRegion} from "./types.ts";
import {invoke} from "@tauri-apps/api/core";
import {calculateEmptyRegions, findAffectedWidgets, mergeActiveList} from "./utils.ts";
import {findDragTarget, recalculateMovement, recalculateWidgetsForDragEnd} from "./drag.ts";
import {recalculateWidgetsForResize} from "./resize.ts";
import ToolRegion from "../../component/panel_section.tsx";
import ResizeAware from "./resize.tsx";
import WidgetHeader from "./header.tsx";
import WidgetConfigurationBox from "./configuration.tsx";
import {DEBUG} from "./const.tsx";
import {BackendError} from "../../err.ts";

const Workspace: React.FC<{ id: string, project: Project } & SessionWindow> = ({
                                                                                   id,
                                                                                   project,
                                                                                   onClose,
                                                                                   setName,
                                                                               }) => {
    const [bound, setBound] = useState<BoundingBox | undefined>(undefined);
    const container = useRef<HTMLDivElement>(null)

    const [widgets, setWidgets] = useState<WidgetRegion[]>([])
    // Use a ref for active resize state to be read by global event listeners
    const activeResizeRef = useRef<ActiveResize[]>([]);
    const [emptyRegions, setEmptyRegions] = useState<BoundingBox[]>([])

    const [dragPreview, setDragPreview] = useState<{ box: BoundingBox } | null>(null);
    const [dropHighlight, setDropHighlight] = useState<BoundingBox | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const dragTargetRef = useRef<DragTarget | null>(null);

    const modified = useRef<Widget[]>([]);
    const alerts = useAlerts();

    useLayoutEffect(() => {
        let listener = () => {
            if (container.current) {
                setBound(container.current?.getBoundingClientRect())
            }
        };

        window.addEventListener("resize", listener)

        return () => window.removeEventListener("resize", listener)
    });

    useEffect(() => {
        setName(`${id} - ${project.device.name}`);

        const cb = setInterval(() => {
            if (modified.current.length == 0) return

            invoke("workspace_push", {
                workspace: {
                    id: id,
                    widgets: modified.current,
                }
            }).then(() => {
                modified.current = [];
            }).catch((e) => {
                alerts.showAlert("error", e.toString())
            })
        }, 1000);

        project.registerListener.close(() => {
            alerts.showAlert("warning", "Device closed.")

            let id = setInterval(() => {
                project.reopen().then(() => {
                    clearInterval(id)
                    alerts.showAlert("info", "Connection reestablished.")
                }).catch((e: BackendError) => {
                    if (e.kind == "NoSuchProject") {
                        clearInterval(id)
                    }
                })
            }, 50)
        })

        return () => clearInterval(cb);
    }, [])

    useEffect(() => {
        modified.current = widgets.map((it) => it.widget)
    }, [widgets]);

    useEffect(() => {
        if (container.current) setBound(container.current.getBoundingClientRect())
    }, [container]);

    useEffect(() => {
        invoke("workspace_get", {
            id: id
        }).then((result) => {
            const layout = result as { id: string, widgets: Widget[] }

            let id = 0
            let regions = layout.widgets.map((w) => ({
                widget: w,
                id: `widget-${id++}`,
            }));

            setWidgets(regions);
        })

        onClose(async () => {
            await project.close()
        })
    }, [id, onClose, project]);

    // --- Empty region calculation ---
    useEffect(() => {
        if (widgets.length === 0) {
            setEmptyRegions([{x: 0, y: 0, width: 1, height: 1}]);
            return;
        }

        setEmptyRegions(calculateEmptyRegions(widgets));
    }, [widgets]);

    const handleRemoveWidget = (id: string) => {
        setWidgets(currentWidgets => currentWidgets.filter(w => w.id !== id));
    }

    const handleAddWidget = (widget: Widget) => {
        setWidgets((currentWidgets) => {
            // Lazy new ID
            const newID = `widget-at-${Date.now()}`
            return [
                ...currentWidgets,
                {
                    widget: widget,
                    id: newID,
                }
            ];
        });
    }

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.MouseEvent, widgetRegion: WidgetRegion) => {
        let target = e.target as HTMLElement;
        // Don't start drag, let button click handle it.
        while (target && target !== e.currentTarget) {
            if (target.getAttribute('data-drag-cancel') === 'true') {
                return;
            }
            target = target.parentElement as HTMLElement;
        }

        // Only drag with left click
        if (e.button !== 0 || !container.current) return;

        e.preventDefault();
        e.stopPropagation();

        const currentBound = container.current.getBoundingClientRect();
        setBound(currentBound) // Ensure bounds are fresh

        const startMouse = {
            x: (e.clientX - currentBound.x) / currentBound.width,
            y: (e.clientY - currentBound.y) / currentBound.height
        }

        activeDragRef.current = {
            id: widgetRegion.id,
            originalPos: widgetRegion.widget.pos,
            startMouse: startMouse
        };

        setDragPreview({box: widgetRegion.widget.pos});

        window.addEventListener('mousemove', handleGlobalDragMove);
        window.addEventListener('mouseup', handleGlobalDragEnd);
    }

    const handleGlobalDragMove = (e: MouseEvent) => {
        const dragState = activeDragRef.current;
        const currentBound = bound; // Use state bound
        if (!dragState || !currentBound) return;

        const {mouse, newPreviewBox} = recalculateMovement(e, currentBound, dragState);
        setDragPreview({box: newPreviewBox});

        let target = findDragTarget(dragState, widgets, mouse, emptyRegions);

        // 3. Update highlight
        if (target) {
            setDropHighlight(target.box);
            dragTargetRef.current = target;
        } else {
            setDropHighlight(null);
            dragTargetRef.current = null;
        }
    }

    const handleGlobalDragEnd = () => {
        const dragState = activeDragRef.current;
        const dragTarget = dragTargetRef.current;

        if (dragState && dragTarget) {
            setWidgets(currentWidgets => {
                return recalculateWidgetsForDragEnd(dragState, dragTarget, currentWidgets);
            });
        }

        // Cleanup
        activeDragRef.current = null;
        dragTargetRef.current = null;
        setDragPreview(null);
        setDropHighlight(null);
        window.removeEventListener('mousemove', handleGlobalDragMove);
        window.removeEventListener('mouseup', handleGlobalDragEnd);
    }

    const handleResizeStart = (type: ResizeBorder, widget: Widget, id: string) => {
        // Use new helper to find all affected widgets based on coordinates
        const affectedWidgets = findAffectedWidgets(widget, type, widgets);
        const mergedAffected = mergeActiveList(affectedWidgets);

        // Ensure the primary widget (the one clicked) has the *exact* resize type
        const primaryIndex = mergedAffected.findIndex(item => item.id === id);
        if (primaryIndex !== -1) {
            mergedAffected[primaryIndex].type = type;
        } else {
            mergedAffected.push({id, type});
        }

        // Set the active resize state in the ref
        activeResizeRef.current = mergedAffected;
        if (DEBUG) console.log("Resize Start. Active List:", mergedAffected);

        // --- Add Global Event Listeners ---
        const handleGlobalMouseMove = (e: MouseEvent) => {
            // ** This is the key: All logic is inside the state updater **
            // This guarantees `currentWidgets` is fresh on every move.
            setWidgets(currentWidgets => {
                return recalculateWidgetsForResize(activeResizeRef, currentWidgets, container, e);
            });
        };

        const handleGlobalMouseUp = () => {
            activeResizeRef.current = []; // Clear ref
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return <div className={"h-full p-0.5 bg-gray-100"}>
        <div className={"h-full"} ref={container}>
            {bound && widgets.map(({widget, id}, key) => {
                let behavior = widget.behavior!!;

                let tool = toolRegistry
                    .find((it) => it.type == behavior.type);

                if (!tool) return <>Tool not found?</>
                return <ToolRegion
                    pad={3}
                    className={"bg-white"}
                    key={key}
                    panel={widget.pos}
                    rect={bound}
                    style={{
                        opacity: activeDragRef.current?.id === id ? 0 : 1,
                        transition: 'opacity 150ms ease-in-out'
                    }}
                >
                    <ResizeAware debug={DEBUG} onResizeStart={(type) => {
                        handleResizeStart(type, widget, id);
                    }}>
                        <div className={"h-full flex flex-col overflow-scroll rounded-[15px]"}>
                            {DEBUG && <div>ID: ${id}</div>}
                            {tool.header(behavior, (props) => {
                                return <WidgetHeader
                                    {...props}
                                    onClose={() => handleRemoveWidget(id)}
                                    onStartDrag={(e) => handleDragStart(e, {widget, id})}
                                />
                            })}
                            <span className="flex-1 min-h-0">
                            {tool.widget(project, behavior)}
                        </span>
                        </div>
                    </ResizeAware>
                </ToolRegion>
            })}
            {
                bound && emptyRegions.map((region, index) => {
                    const style: React.CSSProperties = {
                        position: 'absolute',
                        left: region.x * bound.width + bound.x,
                        top: region.y * bound.height + bound.y,
                        width: region.width * bound.width,
                        height: region.height * bound.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    };

                    return (
                        <div style={style} className={"overflow-scroll"} key={`empty-${index}`}>
                            <div>
                                <WidgetConfigurationBox finalize={(behavior) => {
                                    handleAddWidget({
                                        behavior: behavior,
                                        pos: region
                                    })
                                }}/>
                            </div>
                        </div>
                    )
                })
            }
            {bound && dragPreview && (
                <div style={{
                    position: 'absolute',
                    left: dragPreview.box.x * bound.width + bound.x,
                    top: dragPreview.box.y * bound.height + bound.y,
                    width: dragPreview.box.width * bound.width,
                    height: dragPreview.box.height * bound.height,
                    backgroundColor: 'rgba(0, 100, 255, 0.3)',
                    border: '2px dashed rgba(0, 100, 255, 0.7)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                }}/>
            )}
            {bound && dropHighlight && (
                <div style={{
                    position: 'absolute',
                    left: dropHighlight.x * bound.width + bound.x,
                    top: dropHighlight.y * bound.height + bound.y,
                    width: dropHighlight.width * bound.width,
                    height: dropHighlight.height * bound.height,
                    backgroundColor: 'rgba(0, 255, 100, 0.3)',
                    border: '2px dashed rgba(0, 255, 100, 0.7)',
                    zIndex: 90,
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 150ms ease-in-out'
                }}/>
            )}
        </div>
    </div>
}

export default Workspace