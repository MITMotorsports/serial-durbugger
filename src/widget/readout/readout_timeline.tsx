import {WidgetBehavior, WidgetHandler, ToolContainerProps} from "../widget.ts";

import React, {useEffect, useRef, useState} from 'react';
import {CartesianGrid, Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {Project} from "../../device.tsx";
import {READOUT_REGEX, ReadoutConfiguration} from "./common.tsx";

type TimeSpan = 100 | 1000 | 5000 | 10000 | 20000 | 30000 | 60000;

const LINE_COLORS = [
    "#2196F3", // Blue
    "#F44336", // Red
    "#4CAF50", // Green
    "#FF9800", // Orange
    "#9C27B0", // Purple
    "#00BCD4", // Cyan
    "#E91E63", // Pink
    "#8BC34A", // Light Green
    "#FFEB3B", // Yellow
    "#795548", // Brown
    "#3F51B5", // Indigo
    "#009688", // Teal
    "#CDDC39", // Lime
    "#673AB7", // Deep Purple
    "#FFC107", // Amber
    "#607D8B", // Blue Gray
    "#FF5722", // Deep Orange
    "#9E9E9E", // Gray
    "#03A9F4", // Light Blue
    "#C2185B"  // Deep Pink
]

const GROWTH_CONSTANT = 30

const DO_SCROLL = false

const Widget: React.FC<{ project: Project, behavior: WidgetBehavior<"readout"> }> = ({
                                                                                         project,
                                                                                         behavior
                                                                                     }) => {
    const [_, setRaw] = useState<string>("")
    const [data, setData] = useState<{ time: number, component: string, value: number }[]>([]);
    // Component -> averaged components
    const [chartData, setChartData] = useState<({ time: number } & any)[]>([]);
    const [chartWidth, setChartWidth] = useState<number>(0);

    const [zoomLevel, setZoomLevel] = useState<number>(3);
    const timeSpans: TimeSpan[] = [100, 1000, 5000, 10000, 20000, 30000, 60000];
    const timeSpan = timeSpans[zoomLevel];

    const containerRef = useRef<HTMLDivElement>(null);

    // A helper function to format timestamps for the chart tooltip.
    const formatXAxis = (tickItem: number) => {
        return new Date(tickItem).toLocaleTimeString();
    };

    useEffect(() => {
        const raw = project.registerListener.raw((buf) => {
            const decoded = new TextDecoder().decode(buf)

            setRaw((raw) => {
                let received = []
                const full = raw + decoded

                let lastIndex = 0
                let match;

                while (match = READOUT_REGEX.exec(full)) {
                    lastIndex = match.index + match[0].length
                    const component = match[1]
                    const value = match[2]

                    if (behavior.components.includes(component)) {
                        received.push({
                            time: Date.now(),
                            component: component,
                            value: Number.parseFloat(value)
                        })
                    }
                }

                setData((curr) => [
                    ...curr,
                    ...received,
                ])
                return full.substring(lastIndex, full.length)
            })
        })

        return () => project.unregisterListener.raw(raw)
    }, [])

    const minWidth = () => {
        // 25 is relatively the padding of the bounding containers
        return (containerRef.current?.getBoundingClientRect()?.width ?? 25) - 25
    }

    useEffect(() => {
        // <Component name -> <Time (in ms since 1970), values[]>>
        const sortedValues = new Map<number, Map<string, number[]>>()

        data.forEach(({time, component, value}) => {
            const timeSlot = Math.floor(time / timeSpan) * timeSpan;
            if (!sortedValues.has(timeSlot)) {
                sortedValues.set(timeSlot, new Map());
            }
            const componentEntry = sortedValues.get(timeSlot)!;
            if (!componentEntry.has(component)) {
                componentEntry.set(component, [])
            }
            componentEntry.get(component)!.push(value)
        });

        // let chartData: ({ time: number } & any)[] = []

        const chartData = Array.from(sortedValues.entries())
            .sort(([a], [b]) => a - b)
            .flatMap(([time, map]) => {
                const base: { time: number } & any = {
                    time: time
                }
                Array.from(map.entries()).forEach(([component, values]) => {
                    base[component] = values.reduce((a, b) => a + b) / values.length;
                })
                return base
            })

        setChartData(chartData);

        if (DO_SCROLL && sortedValues.size * GROWTH_CONSTANT > minWidth()) {
            setChartWidth(sortedValues.size * GROWTH_CONSTANT)
        } else {
            setChartWidth(minWidth())
        }
    }, [zoomLevel, data])

    useEffect(() => {
        setChartWidth(minWidth())
    }, [containerRef])

    // Handlers for zoom buttons.
    const handleZoomIn = () => {
        setZoomLevel(prevLevel => Math.max(0, prevLevel - 1));
    };

    const handleZoomOut = () => {
        setZoomLevel(prevLevel => Math.min(timeSpans.length - 1, prevLevel + 1));
    };

    // The main component render.
    return (
        <div className="h-full w-full text-[#333333] font-sans relative flex" ref={containerRef}>
            <div className={`p-2 transition-all duration-300`}>
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                    </div>
                    <div className="absolute top-2 right-2 flex space-x-2 z-10 align-middle">
                        <h1 className={"my-auto"}>{timeSpans[zoomLevel]}ms</h1>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoomLevel === 0}
                            className="p-2 rounded-full text-[#555555] bg-[#E0E0E0] hover:bg-[#D0D0D0] disabled:bg-[#F5F5F5] disabled:text-gray-400 transition-colors shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button
                            onClick={handleZoomOut}
                            disabled={zoomLevel === timeSpans.length - 1}
                            className="p-2 rounded-full text-[#555555] bg-[#E0E0E0] hover:bg-[#D0D0D0] disabled:bg-[#F5F5F5] disabled:text-gray-400 transition-colors shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="flex flex-col flex-grow relative w-full h-full">
                        {/* Zoom controls are now a sibling of the scrolling container */}
                        <div className="flex-grow overflow-x-auto w-full h-full">
                            <ResponsiveContainer
                                // 25 is the interior padding
                                width={chartWidth ?? undefined}
                            >
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0"/>
                                    <XAxis dataKey="time" tickFormatter={formatXAxis} stroke="#808080">
                                        <Label value="Time" offset={-5} position="insideBottom"
                                               style={{fill: '#808080'}}/>
                                    </XAxis>
                                    <YAxis allowDecimals={true} stroke="#808080">
                                        <Label value="Value" angle={-90} position="insideLeft"
                                               style={{textAnchor: 'middle', fill: '#808080'}}/>
                                    </YAxis>
                                    <Tooltip
                                        formatter={(value, name) => [
                                            Number(value).toFixed(3),
                                            name === "average" ? "Average Value" : name,
                                        ]}
                                        labelFormatter={(label) => {
                                            const date = new Date(label);
                                            return date.toLocaleTimeString();
                                        }}
                                    />
                                    {behavior.components.map((component, index) => (
                                        <Line key={index} type="monotone" dataKey={component}
                                              name={`Average ${component}`}
                                              stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                              strokeWidth={2}
                                              dot={false} isAnimationActive={false}/>
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const Header: React.FC<{
    behavior: WidgetBehavior<"readout">,
    Container: React.FC<ToolContainerProps>
}> = ({behavior, Container}) => {
    return <Container>
        <div className={"p-2 text-lg md:text-xl font-semibold text-gray-900 shadow-sm"}>
            <h1 className="text-xl md:text-2xl font-bold">Readout Timeline</h1>
            <span className="text-sm md:text-base text-[#555555]">Components: </span>
            {behavior.components.map((component, index) => <span
                key={index}
                className={"text-sm md:text-base font-bold"}
                style={{
                    color: LINE_COLORS[index % LINE_COLORS.length]
                }}
            >
                {component}
                {index + 1 != behavior.components.length ? ", " : ""}
            </span>)}
        </div>
    </Container>
}

export const ReadoutTimeline: WidgetHandler<"readout"> = {
    header(behavior, container): React.ReactElement {
        return <Header behavior={behavior} Container={container}/>;
    },
    type: "readout-graph",
    behaviorType: "readout",
    displayName: "Readout Graph",
    widget: (s, behavior) => <Widget project={s} behavior={behavior}/>,
    configurator: ({behavior, setBehavior}) => <ReadoutConfiguration behavior={behavior} setBehavior={setBehavior}/>
}