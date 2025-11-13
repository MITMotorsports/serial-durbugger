import {WidgetBehavior} from "../../widget/tool.ts";
import React, {useState} from "react";
import {useAlerts} from "../../alert.tsx";
import {toolRegistry} from "../../main.tsx";
import {Dropdown, DropdownItem} from "../../component/dropdown.tsx";
import Button from "../../component/button.tsx";

const WidgetConfigurationBox: React.FC<{ finalize: (behavior: WidgetBehavior) => void }> = ({finalize}) => {
    const [toolType, setToolType] = useState<string | null>(null)
    const [behavior, setBehavior] = useState<WidgetBehavior | null>(null)
    const alerts = useAlerts()
    const [showing, setShowing] = useState<boolean>(false)

    const handleConfig = () => {
        let tool = toolRegistry.find((tool) => tool.type === toolType);

        if (!tool) {
            return <></>
        }

        return tool.configurator((it) => {
            const behavior = {
                type: tool.type,
                ...it,
            } as (WidgetBehavior | null) // #trustmebro
            setBehavior(behavior)
        })
    }

    return <div className={"group flex items-center flex-col gap-3 p-10"}>
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75"
                 stroke="currentColor"
                 className="size-8">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"/>
            </svg>
        </div>
        <div className={`flex-col flex gap-3 items-center ${showing ? "flex" : "hidden"} group-hover:flex`}>
            <Dropdown onSelect={(t) => {
                setShowing(true)
                setToolType(t)
            }} value={toolType}>
                {toolRegistry.map((it, key) => {
                    return <DropdownItem key={key} value={it.type}>{it.displayName}</DropdownItem>
                })}
            </Dropdown>
            <div className={showing ? `shadow-md  rounded-2xl p-2` : ''}>
                {handleConfig()}
            </div>
            {toolType && <Button
                className={"px-8"}
                onClick={() => {
                    if (!behavior) {
                        alerts.showAlert("error", "Please finish configuring this widget.")
                    } else {
                        finalize(behavior)
                    }
                }}
            >Add</Button>}
        </div>
    </div>
}

export default WidgetConfigurationBox