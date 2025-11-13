import {InputHTMLAttributes, useState} from "react";

export default function KebabInput(
    {className, value, onChange, separator = "-", ...props}: {className?: string | undefined, separator?: string} & InputHTMLAttributes<HTMLInputElement>
) {
    const convert = (original: string) => {
        let output = ""
        for (let char of original) {
            switch (char) {
                case "_":
                case " ":
                case "=":
                case "-":
                    output += separator
                    break
                default:
                    if (char.toLowerCase() != char || char.toUpperCase() != char) {
                        output += char.toLowerCase()
                    }
            }
        }

        return output
    }

    const [kebabValue, setKebabValue] = useState(value ? convert(value.toString()) : "")

    return  <input
        className={`${className ? className : ""} inline bg-white border-[#E0E0E0] border-2 rounded-sm p-1 hover:bg-[#F5F5F5]`}
        value={kebabValue}
        onChange={(e) => {
            let s = convert(e.target.value);
            setKebabValue(s)
            if (onChange) {
                onChange({
                    ...e,
                    target: {
                        ...e.target,
                        value: s,
                    },
                })
            }
        }}
        {...props}
    />
}