import {Project} from "../../device.tsx";
import {SetBehavior, ToolContainerProps, WidgetBehavior, WidgetHandler} from "../widget.ts";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {LogEntry, parseLogContent} from "./common.ts";
import {List, RowComponentProps, useDynamicRowHeight, useListRef} from "react-window";
import {useAlerts} from "../../alert.tsx";
import Button from "../../component/button.tsx";
import {Autocomplete} from "../../component/autocomplete.tsx";

const MAX_LOG_LINES = 20_000;
const SCROLL_STOP_LOCK = 100

/**
 * Gets the Tailwind classes for a specific log level in light mode.
 */
function getLogLevelClasses(level: string) {
    switch (level) {
        case "ERROR":
            return {
                bg: "bg-red-100 hover:bg-red-200",
                text: "text-red-900",
                levelText: "text-red-600 font-semibold"
            };
        case "WARN":
            return {
                bg: "bg-yellow-100 hover:bg-yellow-200",
                text: "text-yellow-900",
                levelText: "text-yellow-600 font-semibold"
            };
        case "INFO":
            return {
                bg: "bg-blue-100 hover:bg-blue-200",
                text: "text-blue-900",
                levelText: "text-blue-600 font-semibold"
            };
        case "DEBUG":
            return {
                bg: "bg-green-100 hover:bg-green-200",
                text: "text-green-900",
                levelText: "text-green-600 font-semibold"
            };
        default:
            return {
                bg: "bg-gray-100 hover:bg-gray-200",
                text: "text-gray-900",
                levelText: "text-gray-600 font-semibold"
            };
    }
}

/**
 * This is the main widget component that displays the logs.
 */
const Widget: React.FC<{ project: Project, behavior: WidgetBehavior<"logs"> }> = ({project, behavior}) => {
    const rawBuffer = useRef<string>("")
    const logs = useRef<LogEntry[]>([])
    const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollContainerRef = useListRef(null)
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: 10
    });

    const handleReceive = useCallback((buf: Uint8Array) => {
        const decoded = new TextDecoder().decode(buf);
        const full = rawBuffer.current + decoded;

        const result = parseLogContent(full);
        const logsResult = result.logs.filter((e => behavior.filter.includes(e.level.toLowerCase())))

        if (logsResult.length > 0) {
            const newLogs = [...logs.current, ...logsResult];
            if (newLogs.length > MAX_LOG_LINES) {
                logs.current = newLogs.slice(newLogs.length - MAX_LOG_LINES);
            } else {
                logs.current = newLogs;
            }
        }
        rawBuffer.current = full.substring(result.lastIndex);
    }, [behavior]);

    useEffect(() => {
        const raw = project.registerListener.raw((buf) => {
            handleReceive(buf);
        });

        let animationHandle: number;
        const onAnimate = () => {
            if (displayLogs.length !== logs.current.length || displayLogs !== logs.current) {
                setDisplayLogs([...logs.current]);
            }
            animationHandle = requestAnimationFrame(onAnimate);
        }
        animationHandle = requestAnimationFrame(onAnimate);

        return () => {
            project.unregisterListener.raw(raw)
            cancelAnimationFrame(animationHandle)
        }
    }, [project, handleReceive, displayLogs]);

    useEffect(() => {
        if (autoScroll && scrollContainerRef.current && displayLogs.length > 0) {
            scrollContainerRef.current.scrollToRow({
                    align: "end",
                    index: displayLogs.length - 1,
                }
            )
        }
    }, [displayLogs, autoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        let scroll = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.getBoundingClientRect().height;
        if (!autoScroll && scroll < SCROLL_STOP_LOCK) {
            setAutoScroll(true);
        }
    };

    return (
        <div className="flex flex-row h-full p-3 bg-white text-gray-900 text-xs font-mono">
            <div className="flex flex-col flex-grow h-full relative">
                <List<LogLineProps>
                    rowComponent={LogLine}
                    onScroll={handleScroll}
                    listRef={scrollContainerRef}
                    rowCount={displayLogs.length}
                    rowHeight={rowHeight}
                    rowProps={{
                        logs: displayLogs,
                        onSelect: (e) => setSelectedLog(e),
                    }}/>
                <button
                    onClick={() => {
                        setAutoScroll(!autoScroll);
                    }}
                    className="
                        absolute right-3 bottom-3 p-1 cursor-pointer content-center
                        w-fit rounded-full bg-gray-200 hover:bg-gray-300
                        transition-all duration-300 ease-in-out shadow-xl"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2}
                         stroke="currentColor"
                         className={`transition-all duration-300 size-6 ${autoScroll ? "rotate-180" : "rotate-0"}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
                    </svg>
                </button>
            </div>

            {/* Detail Pane */}
            {selectedLog && (
                <DetailPanel
                    log={selectedLog}
                    onClose={() => setSelectedLog(null)}
                />
            )}
        </div>
    );
}

type LogLineProps = {
    logs: LogEntry[],
    onSelect: (entry: LogEntry) => void,
}

/**
 * A component to render a single, simplified log line.
 */
function LogLine({logs, index, onSelect, style}: RowComponentProps<LogLineProps>) {
    if (logs.length == 0 || index >= logs.length) {
        return <></>
    }

    const entry = logs[index]
    const levelClasses = getLogLevelClasses(entry.level);

    return (
        <div className={"pb-1"} style={style}>
            <div
                onClick={() => {
                    onSelect(entry)
                }}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${levelClasses.text} ${levelClasses.bg}`}
            >
                {entry.message}
            </div>
        </div>

    );
}

// --- Detail Panel Component ---

/**
 * A panel to display the full details of a selected log entry.
 */
const DetailPanel: React.FC<{ log: LogEntry, onClose: () => void }> = ({log, onClose}) => {
    const levelClasses = getLogLevelClasses(log.level);

    return (
        <div
            className="w-1/2 max-w-md flex-shrink-0 h-full bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto text-sm space-y-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Log Details</h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-900"
                    title="Close Details"
                >
                    {/* Simple 'X' icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div>
                <span className="font-semibold text-gray-500 w-24 inline-block">Level:</span>
                <span className={levelClasses.levelText}>{log.level}</span>
            </div>
            <div>
                <span className="font-semibold text-gray-500 w-24 inline-block">Timestamp:</span>
                <span className="text-gray-800">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <div>
                <span className="font-semibold text-gray-500 w-24 inline-block">File:</span>
                <span className="text-purple-600" title={log.file}>{log.file}</span>
            </div>
            <div>
                <span className="font-semibold text-gray-500 w-24 inline-block">Line:</span>
                <span className="text-cyan-600">{log.line}</span>
            </div>

            <h4 className="font-semibold text-gray-500 pt-3 border-t border-gray-200/50 mt-3">Message:</h4>
            <pre
                className="w-full p-2 bg-white border border-gray-200 rounded text-gray-800 whitespace-pre-wrap break-words text-xs">
                {log.message}
            </pre>
        </div>
    );
}


// --- Tool Boilerplate (Styled for Light Mode) ---

/**
 * This is the header component for the tool.
 */
const Header: React.FC<{
    behavior: WidgetBehavior<"logs">,
    Container: React.FC<ToolContainerProps>
}> = ({Container}) => {
    return <Container>
        {/* Light mode header */}
        <div className="p-2 text-lg md:text-xl font-semibold text-gray-900 bg-white border-b border-gray-200 shadow-sm">
            <h2>
                Log Viewer
            </h2>
        </div>
    </Container>
}

/**
 * A stub configuration component.
 */
const LogConfiguration: React.FC<{
    behavior: WidgetBehavior<"logs">,
    setBehavior: SetBehavior<"logs">,
    project: Project,
}> = ({behavior, setBehavior, project}) => {
    const rawBuffer = useRef<string>("")

    const [collectedLevels, setCollectedLevels] = useState<string[]>([])

    const [newFilter, setNewFilter] = useState<string>('');
    const alerts = useAlerts()

    // useEffect(() => {
    //     console.log(_collectedLevels.current)
    //     let strings = _collectedLevels.current;
    //     console.log(strings)
    //     setCollectedLevels(["hey"])
    // }, [_collectedLevels])

    const handleReceive = (buf: Uint8Array) => {
        const decoded = new TextDecoder().decode(buf);
        const full = rawBuffer.current + decoded;

        const result = parseLogContent(full);

        setCollectedLevels((prev) => {
            const maybeNew = result.logs.map((it) => it.level.toLowerCase())

            for (let level of maybeNew) {
                if (!prev.includes(level)) {
                    return [...new Set([...maybeNew, ...prev])]
                }
            }

            return prev
        })

        rawBuffer.current = full.substring(result.lastIndex);
    }

    useEffect(() => {
        const raw = project.registerListener.raw((buf) => {
            handleReceive(buf);
        });

        return () => {
            project.unregisterListener.raw(raw)
        }
    }, [project, handleReceive]);

    // Function to add a component, memoized with useCallback
    const handleAddFilter = useCallback(() => {
        const trimmed = newFilter.trim().toLowerCase();
        if (trimmed) {
            if (!behavior?.filter?.includes(trimmed)) {
                setBehavior({
                    filter: [...(behavior?.filter ?? []), trimmed],
                })
                setNewFilter('');
            } else {
                alerts.showAlert("warning", `The level ${trimmed} is already added`);
            }
        }
    }, [behavior, newFilter]);

    const handleRemoveFilter = useCallback((componentToRemove: string) => {
        setBehavior({
            filter: behavior?.filter?.filter(c => c !== componentToRemove) ?? [],
        })
    }, [behavior]);

    // Handler for the 'Enter' key press on the input
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddFilter();
        }
    };

    return (
        <div className={"w-3/4"}>
            <h2 className="text-center my-4 text-xl font-semibold">Log Viewer Configuration</h2>
            <h3 className="text-center m-3 text-lg font-light">Filters</h3>

            <div className={"justify-center flex gap-5 ml-auto"}>
                <Autocomplete
                    value={newFilter}
                    onChange={(e) => {
                        setNewFilter(e);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter Level Filter"
                    knownValues={collectedLevels}
                />
                <Button
                    onClick={handleAddFilter}
                    disabled={!newFilter.trim()}
                >
                    Add filter
                </Button>
            </div>

            <div className={"mt-5"}>
                {behavior?.filter?.length === 0 ? (
                    <p style={{ color: '#666' }}></p>
                ) : (
                    // Display list with flex or a list style for better formatting
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {(behavior?.filter ?? []).map((component) => (
                            <li
                                key={component}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                <span>{component}</span>
                                <Button
                                    onClick={() => handleRemoveFilter(component)}
                                    className={"p-1 border-none ml-2 rounded cursor-pointer hover:bg-red-200 transition-colors duration-200"}
                                ><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                      stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg></Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

/**
 * The final exported Tool object.
 */
export const LogViewer: WidgetHandler<"logs"> = {
    header(behavior, container): React.ReactElement {
        return <Header behavior={behavior} Container={container}/>;
    },
    type: "logs",
    behaviorType: "logs",
    displayName: "Log Viewer",
    widget: (s, behavior) => <Widget project={s} behavior={behavior}/>,
    configurator: ({behavior, setBehavior, project}) => <LogConfiguration project={project} behavior={behavior ?? {
        filter: [],
        type: "logs"
    }} setBehavior={setBehavior}/>
}