
// --- Update WidgetHeader props and implementation ---
import {ToolContainerProps} from "../../widget/tool.ts";
import React, {useEffect, useRef, useState} from "react";

type WidgetHeaderProps = ToolContainerProps & {
    onStartDrag: (e: React.MouseEvent) => void;
    onClose: () => void;
}

const WidgetHeader: React.FC<WidgetHeaderProps> = ({children, onStartDrag, onClose}) => {
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
    </div>
};

export default WidgetHeader