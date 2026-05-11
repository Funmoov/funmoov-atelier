import type { ReactNode, CSSProperties, MouseEventHandler } from "react"

interface ButtonProps {
    children?: ReactNode
    onClick?: MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    positive?: boolean
    secondary?: boolean
    style?: CSSProperties
    type?: 'submit' | 'reset' | 'button'
}

export function Button({ children, onClick, disabled, positive, secondary, style, type }: ButtonProps) {
    const classNames = [
        positive ? 'postive' : undefined,
        secondary ? 'secondary' : undefined,
    ]

    return <button
        onClick={onClick}
        disabled={disabled}
        className={classNames.filter(Boolean).join(' ')}
        style={style}
        type={type}
    >
        {children}
        <style jsx>{`
            button {
                max-width: 100%;
                width: 260px;
                padding: 12px 24px;
                border: none;
                border-radius: var(--radius-button);
                font-size: 1rem;
                font-weight: 600;
                background-color: var(--accent-color);
                color: var(--accent-text-color);
                cursor: pointer;
                transition: transform 0.08s ease, background-color 0.15s ease;
                margin: 6px 0;
            }
            button:hover:not([disabled]) {
                background-color: var(--accent-color-hover);
            }
            button:active:not([disabled]) {
                transform: scale(0.97);
            }
            button.positive {
                background-color: var(--positive-box-bg-color);
                color: var(--text-color);
            }
            button.secondary {
                background-color: transparent;
                border: 2px solid var(--border-color);
                color: var(--text-color);
            }
            button.secondary:hover:not([disabled]) {
                background-color: var(--section-bg-elevated);
            }
            button:focus {
                outline: 2px solid var(--accent-color);
                outline-offset: 2px;
            }
            button[disabled] {
                background-color: var(--section-bg-elevated);
                color: var(--disabled-text-color);
                cursor: default;
            }
        `}</style>
    </button>
}
