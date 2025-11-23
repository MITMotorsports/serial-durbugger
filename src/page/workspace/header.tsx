// --- Update WidgetHeader props and implementation ---
import {ToolContainerProps} from "../../widget/widget.ts";
import React, {useEffect, useRef, useState} from "react";

type WidgetHeaderProps = ToolContainerProps & {
    onStartDrag: (e: React.MouseEvent) => void;
    onClose: () => void;
    requestReconfiguration: () => void;
}

const WidgetHeader: React.FC<WidgetHeaderProps> = ({
                                                       children,
                                                       onStartDrag,
                                                       onClose,
                                                       requestReconfiguration
                                                   }) => {
    const contentContainer = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        setHeight(contentContainer.current?.getBoundingClientRect()?.height ?? 0);
    }, [contentContainer]);

    return <div
        className={"cursor-grab"}
        onMouseDown={onStartDrag} // Attach drag handler here
    >
        <div ref={contentContainer}>
            {children}
        </div>
        <button
            data-drag-cancel="true"
            onMouseDown={(e) => e.stopPropagation()} // Stop mousedown from triggering drag
            onClick={(e) => {
                e.stopPropagation(); // Prevent drag from starting on close click
                onClose();
            }}
            style={{
                top: `${height / 2}px`,
                right: `${height / 2}px`,
            }}
            className="
                    cursor-default
                    group
                    -translate-y-1/2
                    absolute z-50
                    h-4 w-4 bg-[#ff5c60] rounded-full
                    transition-colors"
            aria-label="Close widget"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 m-auto invisible group-hover:visible" fill="none"
                 viewBox="0 0 24 24"
                 stroke="#802f30">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                      d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
        <button
            data-drag-cancel="true"
            style={{
                top: `${height / 2}px`,
                right: `${(height / 2) + 50}px`,
            }}
            onClick={(e) => {e.stopPropagation(); requestReconfiguration()}}
            className="
                    cursor-pointer
                    hover:text-gray-500
                    group
                    -translate-y-1/2
                    absolute z-50
                    w-4
                    transition-colors"
            aria-label="Configure widget"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                 stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>
            </svg>
        </button>
    </div>
};

export default WidgetHeader