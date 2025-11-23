import {BoundingBox, WidgetBehavior} from "../../widget/widget.ts";
import React, {useState} from "react";
import {useAlerts} from "../../alert.tsx";
import {toolRegistry} from "../../main.tsx";
import {Dropdown, DropdownItem} from "../../component/dropdown.tsx";
import Button from "../../component/button.tsx";
import {WidgetType} from "../../widget/widget.ts";
import {Project} from "../../device.tsx";

export type ConfigurationState = {
    state: null,
} | {
    state: "new",
    bounds: BoundingBox,
} | {
    state: "reconfigure";
    type: WidgetType,
    id: string;
}

export const WidgetConfigurationPopup : React.FC<{
    project: Project,
    open: boolean;
    initialType: WidgetType | null,
    initialBehavior: WidgetBehavior<any> | null
    finalize: (type: WidgetType, behavior: WidgetBehavior<any>) => void,
    onClose: () => void,
}> = ({project, open, initialType, initialBehavior, finalize, onClose}) => {
    const [type, setType] = useState<WidgetType | null>(initialType);
    const [behavior, setBehavior] = useState<WidgetBehavior<any> | null>(initialBehavior)
    const alerts = useAlerts()

    const handleConfig = () => {
        let tool = toolRegistry.find((tool) => tool.type === type);

        if (!tool) {
            return <h2 className="text-center text-gray-500 my-auto">
                Select a widget to continue...
            </h2>
        }

        return tool.configurator({
            project: project,
            setBehavior: (it) => {
                const behavior = {
                    type: toolRegistry.find((tool) => tool.type === type)!!.behaviorType,
                    ...it,
                } as (WidgetBehavior<any> | null) // #trustmebro
                setBehavior(behavior)
            },
            behavior: behavior,
        })
    }

    return <div className={`top-0 left-0 h-full w-full z-50 ${open ? "fixed" : "hidden"}`}>
        <div className={`top-0 left-0 h-full w-full opacity-50 bg-black ${open ? "fixed" : "hidden"}`}/>
        <div className={`top-0 left-0 h-full w-full ${open ? "fixed" : "hidden"} p-5 overflow-scroll`}>
            <div
                className={`bg-white rounded-xl h-full w-full p-5`}
            >
                <div className={"float-right rounded-full hover:bg-gray-100 p-2 cursor-pointer"} onClick={() => {
                    onClose()
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </div>

                <div className={"h-full flex-col flex gap-5 items-center"}>
                    {!initialType && <Dropdown onSelect={(t) => {
                        setType(t as WidgetType)
                    }} value={type}>
                        {toolRegistry.map((it, key) => {
                            return <DropdownItem key={key} value={it.type}>{it.displayName}</DropdownItem>
                        })}
                    </Dropdown>}
                    {handleConfig()}
                    {type && <Button
                        className={"px-8 mt-auto"}
                        onClick={() => {
                            if (!behavior) {
                                alerts.showAlert("error", "Please finish configuring this widget.")
                            } else {
                                finalize(type, behavior)
                            }
                        }}
                    >{initialBehavior && initialType ? "Reconfigure" : "Add"}</Button>}
                </div>
            </div>

        </div>
    </div>
}



const EmptyRegionBox: React.FC<{
    onClick: () => void
    // initialBehavior?: WidgetBehavior | null
    // finalize: (behavior: WidgetBehavior) => void
}> = ({onClick}) => {
    // const [open, setOpen] = useState<boolean>(false)

    return <div className={"flex items-center flex-col gap-3 p-10"}>
        <div className="shadow-none hover:shadow-2xl p-2 rounded-2xl cursor-pointer transition-all duration-150"
             onClick={onClick}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75"
                 stroke="currentColor"
                 className="size-8">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"/>
            </svg>
        </div>

        {/*<WidgetConfigurationPopup open={open} initialBehavior={initialBehavior} finalize={finalize} onClose={() => setOpen(false)}/>*/}
    </div>
}

export default EmptyRegionBox