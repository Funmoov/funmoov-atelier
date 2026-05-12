interface FooterProps {
    noDonate?: boolean
}

/**
 * Footer FunMoov Atelier.
 * Le param `noDonate` est conservé pour compat (utilisé par pages/donate.tsx)
 * mais la mention "Donate" a été remplacée par un lien vers le site funmoovparis.fr.
 */
export function Footer({ noDonate }: FooterProps) {
    return (
        <footer>
            <div>
                <a href="https://www.funmoovparis.fr" target="_blank" rel="noopener noreferrer">
                    funmoovparis.fr
                </a>
                <a href="/qr-atelier">
                    QR atelier
                </a>
                <a
                    href="https://github.com/mjarkk/vanmoof-web-controller"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Source code
                </a>
            </div>
            <div className='disclaimer'>
                Application atelier indépendante — <b>non affiliée</b> à VanMoof.
            </div>
            <style jsx>{`
                footer {
                    padding: 24px 1rem 16px 1rem;
                    border-top: 1px solid var(--divider-color);
                    margin-top: 32px;
                }
                div {
                    padding-bottom: 8px;
                    text-align: center;
                }
                a {
                    padding: 8px 14px;
                    display: inline-block;
                    font-weight: 500;
                    color: var(--accent-color);
                }
                a:hover {
                    color: var(--accent-color-hover);
                }
                .disclaimer {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                }
            `}</style>
        </footer>
    )
}
