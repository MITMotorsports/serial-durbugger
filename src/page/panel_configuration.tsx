// import ToolRegion from "../component/panel_section.tsx";
// import React, {useRef, useState} from "react";
// import {SessionWindow} from "../session_manager.tsx";
// import Button from "../component/button.tsx";
// import ConfigureProject from "./configure_project.tsx";
// import {Dropdown, DropdownItem} from "../component/dropdown.tsx";
// import KebabInput from "../component/kebab_input.tsx";
// import {invoke} from "@tauri-apps/api/core";
// import {toolRegistry} from "../main.tsx";
// import {Widget, PanelBehavior} from "../tool/tool.ts";
// import {useAlerts} from "../alert.tsx";
//
// const LOCK_RANGE = 0.15
// const MINIMUM_LENGTH = 0.2
// const BORDER_VALUES = [0.25, 0.5, 0.75, 1]
//
// export default function PanelConfiguration(
//     {setPage}: SessionWindow
// ) {
//     const [widgets, setWidgets] = useState<Widget[]>([])
//
//     const [panelTarget, setPanelTarget] = useState<{ x: number, y: number }>({
//         x: 0,
//         y: 0
//     })
//
//     const containerRef = useRef<HTMLDivElement>(null);
//     const [x, setX] = useState(0)
//     const [y, setY] = useState(0)
//     const [valid, setValid] = useState(true)
//
//     const [layoutName, setLayoutName] = useState("")
//
//     const alerts = useAlerts();
//
//     const range = (v: number, target: number) => {
//         return v + (v * LOCK_RANGE) >= target && v - (v * LOCK_RANGE) <= target
//     }
//
//     const mouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
//         const current = containerRef.current
//         if (!current) return
//         const rect = current.getBoundingClientRect()
//
//         const normalizedX = (e.clientX - rect.x) / rect.width;
//         const normalizedY = (e.clientY - rect.y) / rect.height;
//
//         let targetPanelX = 0
//         let targetPanelY = 0
//
//         let panelX = normalizedX
//         let panelY = normalizedY
//
//         for (const panel of widgets) {
//             let x2 = panel.pos.x + panel.pos.width;
//             let y2 = panel.pos.y + panel.pos.height;
//
//             // Check validity (ie is mouse inside already existing box)
//             if (panel.pos.x <= normalizedX && panel.pos.y <= normalizedY && x2 >= normalizedX && y2 >= normalizedY) {
//                 setValid(false)
//                 break
//             } else {
//                 setValid(true)
//             }
//
//             // Set targets
//             if (x2 < normalizedX && x2 > targetPanelX) {
//                 targetPanelX = x2
//             }
//
//             if (y2 < normalizedY && y2 > targetPanelY) {
//                 targetPanelY = y2
//             }
//
//             // Lock to targets
//             if (range(normalizedX, x2)) {
//                 panelX = x2
//             }
//
//             if (range(normalizedY, y2)) {
//                 panelY = y2
//             }
//         }
//
//         // Lock to borders
//         for (const value of BORDER_VALUES) {
//             if (range(normalizedX, value)) {
//                 panelX = value
//             }
//             if (range(normalizedY, value)) {
//                 panelY = value
//             }
//         }
//
//         // If the area made is too small, force it to be larger
//         if (Math.abs(panelX - targetPanelX) < MINIMUM_LENGTH) {
//             panelX = targetPanelX + MINIMUM_LENGTH
//         }
//         if (Math.abs(panelY - targetPanelY) < MINIMUM_LENGTH) {
//             panelY = targetPanelY + MINIMUM_LENGTH
//         }
//
//         // Set the finalized panel X and Y values
//         setX(panelX)
//         setY(panelY)
//
//         setPanelTarget({
//             x: targetPanelX,
//             y: targetPanelY
//         })
//     }
//
//     const handleClick = () => {
//         if (!valid) return
//         const newPanel = {
//             pos: {
//                 x: panelTarget.x,
//                 y: panelTarget.y,
//                 width: x - panelTarget.x,
//                 height: y - panelTarget.y,
//             },
//             behavior: undefined
//         };
//         setWidgets([newPanel, ...widgets])
//     }
//
//     const handleSave = () => {
//
//         for (let widget of widgets) {
//             if (!widget.behavior) {
//                 alerts.showAlert("warning", "Make sure to configure the behavior of all the widgets")
//             }
//         }
//
//         invoke("layout_push", {
//             layout: {
//                 id: layoutName,
//                 widgets: widgets
//             }
//         }).then(() => {
//             setPage(ConfigureProject)
//         }).catch((e) => {
//             console.log(e.toString())
//         })
//     }
//
//     return (<div className={"h-screen w-full mb-2"} ref={containerRef} onMouseMove={mouseMove} onClick={handleClick}>
//         {containerRef.current ? <>
//             <div className={"shadow-lg p-5 absolute m-3 float-right z-50 right-0 bg-white"}>
//                 <h1 className={"my-2 font-bold b"}>Continue:</h1>
//                 <div className={"my-2"}>
//                     <span className={"pr-3"}>Name: </span>
//                     <KebabInput onKeyDown={(e) => {
//                         if (e.key === "Enter") {
//                             handleSave()
//                         }
//                     }} value={layoutName} onChange={(e) => {
//                         setLayoutName(e.target.value)
//                     }} placeholder={"Window..."}/>
//                 </div>
//                 <div>
//                     <Button
//                         style={{
//                             top: containerRef.current.getBoundingClientRect().y
//                         }}
//                         onClick={handleSave}
//                         className={"px-4 py-2 bg-green-700 hover:bg-green-600 text-white border-none"}
//                     >Save</Button>
//                 </div>
//             </div>
//
//             {valid ? <ToolRegion pad={5} panel={{
//                 x: panelTarget.x,
//                 y: panelTarget.y,
//                 width: x - panelTarget.x,
//                 height: y - panelTarget.y
//             }} rect={containerRef.current!!.getBoundingClientRect()}/> : <></>}
//
//             {widgets.map((panel, key) => {
//                 return <ToolRegion pad={5}
//                                    className={"bg-white flex items-center justify-center"} key={key}
//                                    panel={panel.pos}
//                                    rect={containerRef.current!!.getBoundingClientRect()}>
//                     <ChoosePane setBehavior={(behavior) => {
//                         setWidgets((prev) => {
//                             return prev.map((it) => {
//                                 if (panel.pos === it.pos) {
//                                     return {
//                                         behavior: behavior,
//                                         pos: panel.pos
//                                     }
//                                 } else return it
//                             })
//                         })
//                     }}/>
//                 </ToolRegion>
//             })}
//         </> : <p></p>}
//     </div>)
// }
//
// function ChoosePane(
//     {setBehavior}: { setBehavior: (behavior: PanelBehavior) => void },
// ) {
//     const [toolType, setToolType] = useState<string | null>(null)
//
//     const handleConfig = () => {
//         let tool = toolRegistry.find((tool) => tool.type === toolType);
//
//         if (!tool) {
//             return <></>
//         }
//
//         // if (!tool.configurator) {
//         //     return <></>
//         // }
//
//         return tool.configurator((it) => {
//             const behavior = {
//                 type: tool.type,
//                 ...it,
//             } as PanelBehavior // #trustmebro
//             setBehavior(behavior)
//         })
//     }
//
//     return <div className={"flex items-center flex-col gap-3"}>
//         <div>
//             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75"
//                  stroke="currentColor"
//                  className="size-8">
//                 <path stroke-linecap="round" stroke-linejoin="round"
//                       d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"/>
//             </svg>
//         </div>
//
//         <h1>Choose window:</h1>
//         <Dropdown onSelect={(t) => {
//             setToolType(t)
//         }} value={toolType}>
//             {toolRegistry.map((it, key) => {
//                 return <DropdownItem key={key} value={it.type}>{it.displayName}</DropdownItem>
//             })}
//         </Dropdown>
//         {handleConfig()}
//     </div>
// }