// All in percentages

import {HTMLAttributes} from "react";
import {BoundingBox} from "../widget/widget.ts";

export default function ToolRegion({
                                       panel,
                                       rect,
                                       className,
                                       pad = 0,
                                       children,
                                       ...other
                                   }: {
                                       panel: BoundingBox,
                                       rect: BoundingBox,
                                       pad?: number
                                       className?: string,
                                   } & HTMLAttributes<HTMLDivElement>
) {
    return (
        <div {...other} style={{
            // borderTopRightRadius: panel.y == 0 || (panel.x + panel.width) >= 1 ? "0" : "15px",
            // borderTopLeftRadius: panel.y == 0 || panel.x == 0 ? "0" : "15px",
            // borderBottomLeftRadius: (panel.y + panel.width) >= 1 || panel.x == 0 ? "0" : "15px",
            // borderBottomRightRadius: (panel.y + panel.width) >= 1 || (panel.x + panel.width) >= 1 ? "0" : "15px",
            borderRadius: "15px",
            left: rect.x + (panel.x * rect.width) + pad,
            top: rect.y + (panel.y * rect.height) + pad,
            width: rect.width * panel.width - 2*pad,
            height: rect.height * panel.height - 2*pad,
        }} className={`${className ?? ""} z-10 absolute drop-shadow-xl p-0`}>
            {children}
        </div>
    )
}