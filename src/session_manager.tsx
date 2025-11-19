import "./global.css";
import React, {FC, useEffect, useState} from "react";
import WorkspaceSelection from "./page/home/home.tsx";

interface SessionManager {
    id: string;
    name: string;
    content: React.ReactElement;
    closeHooks: (() => Promise<void>)[];
}

export type IntrinsicProps = "setPage" | "setName" | "onClose"

export interface SessionWindow {
    setPage<T extends SessionWindow>(
        page: React.FC<T>,
        props?: Omit<T, IntrinsicProps> | undefined
    ): void

    setName(name: string): void

    onClose(event: () => Promise<void>): void
}

const InitialWindow = WorkspaceSelection

const SessionPanel: React.FC<{
    setName: (name: string) => void,
    onClose: (event: () => Promise<void>) => void
}> = ({setName, onClose},) => {
    const [current, setCurrent] = useState<FC<SessionWindow>>(
        () => InitialWindow
    );

    function setPage<T extends SessionWindow>(
        page: React.FC<T>,
        props?: Omit<T, IntrinsicProps> | undefined
    ) {
        const fc = page as FC<SessionWindow>

        setPages((curr) => {
            let filtered = pages.filter((t) => t.fc !== fc)

            return [
                ...filtered,
                {
                    id: curr.length,
                    fc: fc,
                    props: {
                        ...props,
                        setPage: setPage,
                        setName: setName,
                        onClose: onClose
                    }
                }
            ]
        })
        setCurrent(() => fc)
    }

    const [pages, setPages] = useState<{
        id: number,
        fc: React.FC<SessionWindow>,
        props: SessionWindow
    }[]>(() => [
        {
            id: 0,
            fc: InitialWindow,
            props: {
                setPage: setPage,
                setName: setName,
                onClose: onClose
            }
        }])

    const Page = pages.find((it) => it.fc == current)

    if (!Page) {
        return <></>
    }

    return <>
        <Page.fc {...Page.props}/>
    </>
}

export default function SessionManager() {
    const [sessions, setSessions] = useState<SessionManager[]>([]);

    const [activeSessionId, setActiveSessionId] = useState<string | null>('session-1');
    const [nextId, setNextId] = useState<number>(0);

    const addSession = (): void => {
        const newSessionId = `session-${nextId}`;

        const newSession: SessionManager = {
            id: newSessionId,
            name: `Home`,
            content: <SessionPanel key={newSessionId} setName={(name) => {
                setSessions((prev) => {
                    return prev.map((s) => s.id == newSessionId ?
                        {
                            ...s,
                            name: name
                        } : s)
                })
            }} onClose={(b) => {
                setSessions((prev) => {
                    const thisSession = prev.find((s) => s.id == newSessionId)!!
                    thisSession.closeHooks.push(b)
                    return prev
                })
            }}/>,
            closeHooks: []
        };
        setSessions([...sessions, newSession]);
        setActiveSessionId(newSessionId);
        setNextId(nextId + 1);
    };

    const removeSession = (sessionId: string): void => {
        const doRemove = () => {
            setSessions((sessions) => {
                const remainingSessions = sessions.filter((session: { id: string; }) => session.id !== sessionId);

                if (activeSessionId === sessionId) {
                    if (remainingSessions.length > 0) {
                        const activeIndex = sessions.findIndex((session: { id: string; }) => session.id === sessionId);
                        const newActiveSession = remainingSessions[Math.min(activeIndex, remainingSessions.length - 1)];
                        setActiveSessionId(newActiveSession.id);
                    } else {
                        setActiveSessionId(null);
                    }
                }

                return remainingSessions
            })
        }

        const session = sessions.find((s) => s.id === sessionId)

        if (!session) {
            return
        }

        Promise.all(session.closeHooks.map((hook) => hook())).then(() => {
            doRemove()
        }).catch((e) => {
            console.error(e)
        })
    };

    useEffect(() => {
        addSession();
    }, [])

    return (
        <div className="flex flex-col h-screen font-sans border-[#E0E0E0]">
            <div className="flex items-end border-b border-inherit overflow-x-auto whitespace-nowrap">
                {/* Render each session tab. */}
                {sessions.map((session: SessionManager) => (
                    <div
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        className={`border-l border-inherit
              relative flex items-center justify-between px-4 py-1 transition-all duration-200 cursor-pointer w-full
              ${activeSessionId === session.id ? 'bg-white' : 'hover:bg-[#D0D0D0] bg-gray-100'}`}
                    >
                        <span className="text-sm font-semibold pr-2">{session.name}</span>
                        {/* Close button for the tab. */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent the parent div's onClick from firing
                                removeSession(session.id);
                            }}
                            className="ml-2 rounded-full p-1 transition-colors duration-200 focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                ))}
                {/* Button to add a new session. */}
                <button
                    onClick={addSession}
                    className="border-inherit border-l-1 transition-colors duration-200 p-1.5 hover:bg-[#D0D0D0]"
                    aria-label="Add new session"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                </button>
            </div>

            {/* Content area for the active session. */}
            <div className="flex-1 rounded-b-lg overflow-hidden h-fit">
                {sessions.map((it) => {
                    return <span key={it.id} style={{
                        display: it.id == activeSessionId ? "" : "none"
                    }}>
                        {it.content}
                    </span>
                })}
                {
                    sessions.length != 0 && activeSessionId ? <></> :
                        <p className="flex items-center justify-center h-full">
                            <span className="text-lg">Select a session or add a new one to begin.</span>
                        </p>
                }
            </div>
        </div>
    );
}