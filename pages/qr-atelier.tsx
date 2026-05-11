import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { Footer } from '../components/Footer'
import { Button } from '../components/Button'

/**
 * Page atelier pour générer le QR code à afficher/imprimer.
 * Le client le scanne avec son tel → ouvre /partager → flux de partage auto.
 */
const QrAtelierPage: NextPage = () => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('')
    const [shareUrl, setShareUrl] = useState<string>('')

    useEffect(() => {
        // Construire l'URL absolue de la page /partager (basée sur le host courant)
        const baseUrl = `${window.location.protocol}//${window.location.host}`
        const url = `${baseUrl}/partager`
        setShareUrl(url)

        // Import dynamique de qrcode (lib côté client uniquement, évite les soucis SSR)
        import('qrcode').then((qrcode) => {
            const QRCode = (qrcode as any).default ?? qrcode
            return QRCode.toDataURL(url, {
                width: 600,
                margin: 2,
                color: {
                    dark: '#1d3a4a',     // couleur brand
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'H',
            })
        }).then(setQrDataUrl).catch((err: any) => {
            console.error('QR generation failed:', err)
        })
    }, [])

    const printPage = () => window.print()

    return (
        <div>
            <main className='screen'>
                <div className='print-area'>
                    <img src='/funmoov-logo.svg' alt='funmoov atelier' className='logo' />

                    <h1>Partagez votre VanMoof</h1>
                    <p className='intro'>
                        Scannez ce QR code avec votre téléphone pour autoriser
                        <strong> funmoov atelier</strong> à diagnostiquer votre vélo à distance.
                    </p>

                    <div className='qr-wrap'>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt='QR code de partage' className='qr' />
                        ) : (
                            <div className='qr-loading'>Génération…</div>
                        )}
                    </div>

                    <ol className='steps'>
                        <li>Ouvrez l'appareil photo de votre téléphone</li>
                        <li>Visez le QR code</li>
                        <li>Connectez-vous à votre compte VanMoof</li>
                        <li>Confirmez le partage</li>
                    </ol>

                    <p className='url'>
                        Ou rendez-vous directement sur : <strong>{shareUrl}</strong>
                    </p>

                    <p className='legal'>
                        Partage révocable à tout moment depuis l'app VanMoof officielle.
                        Aucune donnée de paiement n'est partagée.
                    </p>

                    <p className='brand'>
                        <strong>funmoov atelier</strong> · funmoovparis.fr
                    </p>
                </div>

                <div className='controls no-print'>
                    <Button onClick={printPage}>🖨️ Imprimer</Button>
                </div>
            </main>

            <div className='no-print'>
                <Footer />
            </div>

            <style jsx>{`
                .screen {
                    padding: 2rem 1.5rem;
                    max-width: 720px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .print-area {
                    background: #ffffff;
                    color: #1d3a4a;
                    padding: 40px;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 600px;
                    text-align: center;
                    box-shadow: 0 4px 30px rgba(0,0,0,0.4);
                }
                .logo {
                    width: 140px;
                    height: 140px;
                }
                h1 {
                    color: #1d3a4a;
                    font-size: 1.6rem;
                    margin: 12px 0;
                }
                .intro {
                    color: #1d3a4a;
                    line-height: 1.5;
                    margin: 12px 0 24px 0;
                }
                .qr-wrap {
                    display: flex;
                    justify-content: center;
                    margin: 20px 0;
                }
                .qr {
                    width: 100%;
                    max-width: 320px;
                    height: auto;
                    border: 2px solid #1d3a4a;
                    border-radius: 12px;
                    background: white;
                    padding: 8px;
                }
                .qr-loading {
                    width: 320px;
                    height: 320px;
                    background: #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #888;
                }
                .steps {
                    text-align: left;
                    max-width: 360px;
                    margin: 20px auto;
                    color: #1d3a4a;
                    line-height: 1.6;
                    padding-left: 28px;
                }
                .url {
                    font-size: 0.85rem;
                    color: #1d3a4a;
                    word-break: break-all;
                    margin: 20px 0;
                }
                .legal {
                    font-size: 0.8rem;
                    color: #5a6b75;
                    margin: 16px 0;
                    line-height: 1.4;
                }
                .brand {
                    color: #c4a87a;
                    letter-spacing: 1px;
                    font-size: 0.9rem;
                    margin-top: 20px;
                    border-top: 1px solid #c4a87a;
                    padding-top: 16px;
                }
                .controls {
                    display: flex;
                    gap: 10px;
                    margin: 24px 0;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .screen { padding: 0; }
                    .print-area { box-shadow: none; }
                }
            `}</style>
        </div>
    )
}

export default QrAtelierPage
