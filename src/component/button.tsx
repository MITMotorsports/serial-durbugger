import {twMerge} from "tailwind-merge";
import {ButtonHTMLAttributes} from "react";

export default function Button(
    {className,  ...props}: { className?: string | undefined } & ButtonHTMLAttributes<HTMLButtonElement>
) {
    return <button
        className={twMerge(
            `inline bg-white border-[#E0E0E0] border-2 rounded-sm p-1 hover:bg-[#F5F5F5] hover:cursor-pointer`,
            className
        )}
        {...props}
    ></button>
}