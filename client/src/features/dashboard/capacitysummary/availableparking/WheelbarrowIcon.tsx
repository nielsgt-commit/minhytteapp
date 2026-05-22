import { forwardRef } from "react"

type WheelbarrowProps = React.SVGProps<SVGSVGElement> & {
  title?: string
}

export const WheelbarrowIcon = forwardRef<SVGSVGElement, WheelbarrowProps>(
  function WheelbarrowIcon({ title, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable={false}
        role="img"
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <path d="M3 8.5h13l-2 5.5H5L3 8.5Z" />
        <path d="M16 8.5l4-1.5" />
        <circle cx="6.5" cy="17" r="2" />
        <path d="M5 14l1.5 1.4" />
        <path d="M14 14l-.8 4" />
      </svg>
    )
  },
)

export const WheelbarrowFillIcon = forwardRef<SVGSVGElement, WheelbarrowProps>(
  function WheelbarrowFillIcon({ title, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable={false}
        role="img"
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <path d="M3 8.5h13l-2 5.5H5L3 8.5Z" fill="currentColor" />
        <path d="M16 8.5l4-1.5" />
        <circle cx="6.5" cy="17" r="2" fill="currentColor" />
        <path d="M5 14l1.5 1.4" />
        <path d="M14 14l-.8 4" />
      </svg>
    )
  },
)
