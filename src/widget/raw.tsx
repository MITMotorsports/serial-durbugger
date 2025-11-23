import React, {FormEvent, useEffect, useRef, useState} from "react";
import {Project} from "../device.tsx";
import {WidgetBehavior, SetBehavior, WidgetHandler, ToolContainerProps} from "./widget.ts";
import {useAlerts} from "../alert.tsx";
import {List, RowComponentProps, useDynamicRowHeight, useListRef} from "react-window";
import FindTool from "../component/find.tsx";
import {TextSelection} from "../component/find.tsx"

const SCROLL_STOP_LOCK = 10

// How many characters are stored as a buffer
const DATA_LIMIT = 1_000_000;

function Widget({project}: { project: Project }) {
    const [data, setData] = useState<string>("");
    const listRef = useListRef(null)
    const [commandInput, setCommandInput] = useState<string>()
    const alerts = useAlerts();
    const rowHeight = useDynamicRowHeight({
        defaultRowHeight: 25
    });

    const [highlight, setHighlight] = useState<TextSelection | null>(null)
    const [autoScroll, setAutoScroll] = useState(true);
    const [paused, setPaused] = useState<boolean>(false);
    const pausedRef = useRef<boolean>(paused);

    useEffect(() => {
        pausedRef.current = paused
    }, [paused])

    useEffect(() => {
        const rref = project.registerListener.raw((c) => {
            if (pausedRef.current) return

            const decoder = new TextDecoder('utf-8'); // Specify the encoding
            const decodedString = decoder.decode(c);

            setData((c) => {
                let newData = c + decodedString;

                if (newData.length > DATA_LIMIT) {
                    newData = newData.slice(newData.length - DATA_LIMIT, newData.length);
                }

                return newData
            })
        })

        return () => {
            project.unregisterListener.raw(rref)
        }
    }, []);

    const onSend = (e: FormEvent) => {
        e.preventDefault()

        project.write(commandInput).then(() => {
            setCommandInput("")
        }).catch((err) => {
            alerts.showAlert("error", err.toString());
        })
    }

    let lines = data.split("\n");

    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        let scroll = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.getBoundingClientRect().height;
        if (autoScroll) {
            e.preventDefault()
            e.stopPropagation()
        } else if (!autoScroll && scroll < SCROLL_STOP_LOCK) {
            setAutoScroll(true);
        }
    }

    useEffect(() => {
        const container = listRef.current;
        if (!container || !autoScroll) return; // Ensure the ref is attached and should scroll

        container.scrollToRow({
                index: lines.length - 1,
            }
        )
    }, [data]);

    return (
        <div className="flex flex-col h-full overflow-x-scroll">
            <FindTool content={lines} onFind={(h) => {
                if (h) {
                    setAutoScroll(false)
                    listRef.current?.scrollToRow({
                        index: h?.line,
                    })
                } else {
                    setAutoScroll(true)
                }
                setHighlight(h)
            }}/>
            <div
                className="flex-grow p-4 font-mono text-sm overflow-y-auto relative select-auto"
            >
                <List<RawLineProps>
                    onScroll={onScroll}
                    listRef={listRef}
                    rowComponent={RawLine}
                    rowCount={lines.length}
                    rowHeight={rowHeight}
                    rowProps={{
                        lines: lines,
                        highlight: highlight,
                    }}
                />
                <button
                    onClick={() => {
                        setAutoScroll(!autoScroll);
                    }}
                    className="
                        absolute bottom-0 right-0 z-50 m-3 p-1 cursor-pointer content-center
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

            <form onSubmit={onSend}>
                <div className="flex p-3 justify-between items-center bg-white border border-[#E0E0E0]">
                    <span className="font-mono text-sm font-bold mr-2 text-gray-600 select-none">
                        $
                    </span>

                    <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        className="flex-grow font-mono text-sm text-gray-900 focus:outline-none"
                        style={{border: 'none', background: 'transparent'}}
                        placeholder="Type command here..."
                        autoFocus
                    />

                    {/* Send Button */}
                    <button
                        type="submit"
                        // Using a simple blue that fits a UI button style
                        className="ml-2 px-3 py-1 text-sm font-medium rounded text-white bg-blue-500 hover:bg-blue-600 transition duration-150"
                    >
                        Send
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setPaused((p) => !p)
                        }}
                        // Using a simple blue that fits a UI button style
                        className="ml-2 p-0.5 text-blue-5000 rounded-full hover:bg-blue-100 transition duration-150"
                    >
                        {paused ?
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                                 stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"/>
                            </svg> :
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                                 stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                            </svg>}

                    </button>
                </div>
            </form>
        </div>
    );
}

type RawLineProps = {
    lines: string[],
    highlight: TextSelection | null
}

function RawLine({index, lines, style, highlight}: RowComponentProps<RawLineProps>) {
    const content = lines[index] || '\u00a0';

    const getHighlighted = () => {
        const index = highlight!.startIndex
        let endIndex = highlight!.endIndex;

        return <>
            {content.substring(0, index)}
            <span className={"bg-yellow-300"}>{content.substring(index, endIndex)}</span>
            {content.substring(endIndex, content.length)}
        </>
    }

    return (
        <div
            style={style}
            className="text-gray-900" // Use a dark text color
        >
            {/*{content}*/}
            {highlight?.line == index ? getHighlighted() : content}
        </div>
    )
}

const Configurator: React.FC<{ setBehavior: SetBehavior<"none"> }> = ({setBehavior}) => {
    useEffect(() => {
        setBehavior({})
    }, [])

    return <>
        <div className="p-4  h-full">
            <h3 className="text-lg font-semibold ">Log Viewer Configuration</h3>
            <p className="text-gray-600 mt-2">No configuration available for this tool.</p>
        </div>
    </>
}

const Header: React.FC<{
    behavior: WidgetBehavior<"none">,
    Container: React.FC<ToolContainerProps>
}> = ({Container}) => {
    return <Container>
        <h2 className="p-2 text-lg md:text-xl font-semibold text-gray-900 shadow-sm">
            Device Terminal
        </h2>
    </Container>;
}

export const Raw: WidgetHandler<"none"> = {
    type: "raw",
    behaviorType: "none",
    displayName: "Raw Console Log",
    header: (behavior, container) => {
        return <Header behavior={behavior} Container={container}/>
    },
    widget: (s) => <Widget project={s}/>,
    configurator: ({setBehavior}) => <Configurator setBehavior={setBehavior}/>
}