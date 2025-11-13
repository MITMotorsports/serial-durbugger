import React, {ReactNode} from "react";
import {ResizeBorder} from "./types.ts";

const ResizeAware: React.FC<{
    children: ReactNode | undefined,
    onResizeStart: (type: ResizeBorder) => void,
    debug: boolean
}> = ({children, onResizeStart, debug}) => {
    return <>
        {children}
        <ResizeHandle
            type={ResizeBorder.TopLeft}
            cursor={"nwse-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
        <ResizeHandle
            type={ResizeBorder.Top}
            cursor={"ns-resize"}
            onStartResize={onResizeStart}
            debug={debug}

        />
        <ResizeHandle
            type={ResizeBorder.TopRight}
            cursor={"nesw-resize"}
            onStartResize={onResizeStart}
            debug={debug}

        />
        <ResizeHandle
            type={ResizeBorder.Left}
            cursor={"ew-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
        <ResizeHandle
            type={ResizeBorder.Right}
            cursor={"ew-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
        <ResizeHandle
            type={ResizeBorder.BottomLeft}
            cursor={"nesw-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
        <ResizeHandle
            type={ResizeBorder.Bottom}
            cursor={"ns-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
        <ResizeHandle
            type={ResizeBorder.BottomRight}
            cursor={"nwse-resize"}
            onStartResize={onResizeStart}
            debug={debug}
        />
    </>
}

const HANDLE_SIZE = 40

const ResizeHandle: React.FC<{
    type: ResizeBorder,
    onStartResize: (type: ResizeBorder) => void,
    cursor: string,
    debug: boolean
}> = ({type, onStartResize, cursor, debug}) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        width: `${HANDLE_SIZE}px`,
        height: `${HANDLE_SIZE}px`,
        background: `rgba(0, 100, 255, ${debug ? 0.3 : 0})`,
        transform: 'translate(-50%, -50%)',
        cursor: cursor,
        zIndex: 10,
    };

    const lengthProperty = `calc(100% - ${HANDLE_SIZE}px)`

    switch (type) {
        case ResizeBorder.TopLeft:
            style.top = '0%';
            style.left = '0%';
            break;
        case ResizeBorder.Top:
            style.top = '0%';
            style.left = '50%';
            style.width = lengthProperty
            break;
        case ResizeBorder.TopRight:
            style.top = '0%';
            style.left = '100%';
            break;
        case ResizeBorder.Left:
            style.top = '50%';
            style.left = '0%';
            style.height = lengthProperty
            break;
        case ResizeBorder.Right:
            style.top = '50%';
            style.left = '100%';
            style.height = lengthProperty
            break;
        case ResizeBorder.BottomLeft:
            style.top = '100%';
            style.left = '0%';
            break;
        case ResizeBorder.Bottom:
            style.top = '100%';
            style.left = '50%';
            style.width = lengthProperty
            break;
        case ResizeBorder.BottomRight:
            style.top = '100%';
            style.left = '100%';
            break;
    }

    return (
        <div
            style={style}
            onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onStartResize(type);
            }}
        />
    );
};

export default ResizeAware;