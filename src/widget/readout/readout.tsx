import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Tool, ToolContainerProps, WidgetBehavior} from "../tool.ts";
import {Project} from "../../device.tsx";
import {parseReadouts, ReadoutConfiguration} from "./common.tsx";

type ReadoutValue = {
    current: number,
    average: number,
    count: number // The count that has gone into average.
}

const Widget: React.FC<{ project: Project, behavior: WidgetBehavior & { type: "readout" } }> = ({
                                                                                                   project,
                                                                                                   behavior
                                                                                               }) => {
    const rawBuffer = useRef<string>("")
    const values = useRef<Map<string, ReadoutValue>>(new Map())

    const componentsSet = useMemo(() =>
            new Set(behavior.components),
        [behavior.components]
    );

    const [displayValues, setDisplayValues] = useState(() => new Map<string, ReadoutValue>());

    const handleReceive = useCallback((buf: Uint8Array) => {
        const decoded = new TextDecoder().decode(buf)

        const full = rawBuffer + decoded;

        const result = parseReadouts(
            full,
            behavior.components
        );

        for (const readout of result.values) {
            const {component, value} = readout;

            // Get the previous data for this component
            const past = values.current.get(component);

            console.log(component, value);
            // Set the new data, accumulating count and average
            values.current.set(component, {
                current: value,
                average: past ? (past.average * past.count + value) / (past.count + 1) : value,
                count: past ? past.count + 1 : 1
            });
        }

        rawBuffer.current = full.substring(result.lastMatchEnd);
    }, [componentsSet]);

    useEffect(() => {
        const raw = project.registerListener.raw((buf) => {
            handleReceive(buf);
        })

        let animationHandle: number;

        const onAnimate = () => {
            setDisplayValues(new Map(values.current));
            animationHandle = requestAnimationFrame(onAnimate);
        }

        animationHandle = requestAnimationFrame(onAnimate);

        return () => {
            project.unregisterListener.raw(raw)
            cancelAnimationFrame(animationHandle)
        }
    }, [])

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex flex-col items-start gap-6">
                {behavior.components.map((componentName) => {
                    const value = displayValues.get(componentName) ?? {
                        current: 0,
                        average: 0,
                        count: 1,
                    };
                    // if (!value) return <></>;
                    return <ValueTab
                        component={componentName}
                        key={componentName}
                        {...value}
                    />
                })}
            </div>
        </div>
    );
}

const ValueTab: React.FC<{
    component: string,
    current: number,
    average: number,
    count: number
}> = ({component, current, average, count}) => {
    const [mode, setMode] = useState<"current" | "average">("current");

    const handleModeChange = useCallback(() => {
        if (mode === "current") {
            setMode("average");
        } else if (mode === "average") {
            setMode("current");
        }
    }, [mode])

    const getDisplayName = useCallback(() => {
        switch (mode) {
            case "current":
                return "Current Value";
            case "average":
                return "Average Value";
        }
    }, [mode])

    const getValue = () => {
        switch (mode) {
            case "current":
                return current;
            case "average":
                return average
        }
    }

    return (
        <div className="w-full">
            <p className="text-sm mb-2 md:text-base font-semibold text-gray-700">
                Component:
                <span className="ml-2 text-sm md:text-base font-bold text-[#F36A21]">{component}</span>
            </p>
            <div className="flex flex-row justify-between w-full mb-2">
                <div>
                    <p className="text-4xl md:text-5xl font-extrabold text-[#2196F3] ml-2 border-b pb-4 border-gray-100">
                        {getValue().toFixed(4)}
                    </p>
                </div>
                <div>
                    <div onClick={handleModeChange}
                         className="hover:cursor-pointer hover:bg-blue-50/100 flex flex-row items-center gap-2 bg-blue-50/50 p-1 rounded-md">
                        {/* SVG & Label: Used a lighter background on this section for focus */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                             stroke="currentColor" className="size-5 w-6 h-6 text-[#2196F3] animate-spin-slow">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                        </svg>
                        <p className="text-sm md:text-base font-semibold text-gray-700">
                            {getDisplayName()}:
                        </p>
                    </div>
                    <p>Count: {count}</p>
                </div>
            </div>
        </div>
    );
}

const Header: React.FC<{
    behavior: WidgetBehavior & { type: "readout" },
    Container: React.FC<ToolContainerProps>
}> = ({Container}) => {
    return <Container>
        <div className="p-2 text-lg md:text-xl font-semibold text-gray-900 shadow-sm">
            <h2>
                Data Readout
            </h2>
        </div>
    </Container>
}

export const Readout: Tool = {
    header(behavior: WidgetBehavior, container: React.FC<ToolContainerProps>): React.ReactElement {
        return <Header behavior={behavior as WidgetBehavior & { type: "readout" }} Container={container}/>;
    },
    type: "readout",
    displayName: "Readout",
    widget: (s, behavior) => <Widget project={s} behavior={behavior as WidgetBehavior & { type: "readout" }}/>,
    configurator: (s) => <ReadoutConfiguration setBehavior={s}/>
}