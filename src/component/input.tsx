import {InputHTMLAttributes} from "react";

export default function Input(
    {className, ...props}: {className?: string | undefined} & InputHTMLAttributes<HTMLInputElement>
) {
    return  <input
        className={`${className ? className : ""} inline bg-white border-[#E0E0E0] border-2 rounded-sm p-1 hover:bg-[#F5F5F5]`}
        {...props}
    />
}