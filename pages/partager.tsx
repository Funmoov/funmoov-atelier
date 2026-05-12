import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Api } from '../lib/api'
import { Footer } from '../components/Footer'
import { Button } from '../components/Button'
import type { BikeAndApiCredentials } from '../components/Login'

const Login = dynamic(() => import('../components/Login'), { ssr: false })

/** Email du compte funmoov atelier avec qui les clients partagent leur vélo. */
const FUNMOOV_ATELIER_EMAIL = 'funmoovparis@gmail.com'

type ShareStatus =
    | { kind: 'idle' }
    | { kind: 'running' }
    | { kind: 'success'; count: number }
    | { kind: 'error'; message: string }
    | { kind: 'partial'; success: number; failed: number; errors: string[] }

/**
 * Page de partage automatique des vélos avec le compte funmoov atelier.
 * Le client arrive ici après avoir scanné le QR code de l'atelier.
 *
 * Flux :
 *  1. Si le client n'est pas connecté à VanMoof → écran de login
 *  2. Une fois connecté → bouton "Partager tous mes vélos avec funmoov atelier"
 *  3. Un clic = appel de l'API VanMoof createBikeSharingInvitation pour chaque vélo
 *  4. Confirmation visuelle
 */
const PartagerPage: NextPage = () => {
    const [credentials, setCredentials] = useState<undefined | BikeAndApiCredentials>(undefined)
    const [status, setStatus] = useState<ShareStatus>({ kind: 'idle' })

    // Récup des credentials s'ils sont déjà en localStorage
    useEffect(() => {
        try {
            const apiCredRaw = localStorage.getItem('vm-api-credentials')
            const bikeCredRaw = localStorage.getItem('vm-bike-credentials')
            if (apiCredRaw && bikeCredRaw) {
                const api = new Api(JSON.parse(apiCredRaw))
                const bikes = JSON.parse(bikeCredRaw)
                if (Array.isArray(bikes)) {
                    setCredentials({ api, bikes })
                }
            }
        } catch (e) {
            // Ignore — l'écran de login s'affichera
        }
    }, [])

    const shareAllBikes = async () => {
        if (!credentials || !credentials.api) {
            setStatus({ kind: 'error', message: 'Connexion VanMoof requise.' })
            return
        }
        setStatus({ kind: 'running' })

        const api = credentials.api as any
        const bikes = credentials.bikes as any[]

        if (bikes.length === 0) {
            setStatus({ kind: 'error', message: 'Aucun vélo trouvé sur votre compte VanMoof.' })
            return
        }

        let successCount = 0
        const errors: string[] = []

        for (const bike of bikes) {
            try {
                // L'API attend un objet "Bike" mais en interne elle ne lit que bike.id
                // (cf. lib/api.ts createBikeSharingInvitation). On passe donc un objet partiel.
                await api.createBikeSharingInvitation(
                    bike,
                    FUNMOOV_ATELIER_EMAIL,
                    undefined, // pas de durée → partage permanent
                )
                successCount++
            } catch (e: any) {
                const bikeLabel = bike?.name || bike?.mac || 'vélo'
                errors.push(`${bikeLabel}: ${e?.message ?? e}`)
            }
        }

        if (successCount === bikes.length) {
            setStatus({ kind: 'success', count: successCount })
        } else if (successCount > 0) {
            setStatus({
                kind: 'partial',
                success: successCount,
                failed: bikes.length - successCount,
                errors,
            })
        } else {
            setStatus({
                kind: 'error',
                message: errors.join(' · ') || 'Aucun vélo n\'a pu être partagé.',
            })
        }
    }

    return (
        <div>
            <main>
                <img src='/funmoov-logo.svg' alt='funmoov atelier' className='logo' />
                <h1>Partage avec funmoov atelier</h1>
                <p className='subtitle'>
                    Autorisez funmoov atelier à diagnostiquer votre VanMoof à distance
                </p>

                {!credentials ? (
                    <>
                        <p className='instruction'>
                            Pour commencer, connectez-vous avec votre compte <strong>VanMoof</strong> :
                        </p>
                        <Login setCredentials={setCredentials} />
                    </>
                ) : (
                    <>
                        {credentials.bikes.length > 0 ? (
                            <p className='instruction'>
                                {credentials.bikes.length === 1
                                    ? 'Votre vélo va être partagé avec '
                                    : `Vos ${credentials.bikes.length} vélos vont être partagés avec `}
                                <strong>{FUNMOOV_ATELIER_EMAIL}</strong>.
                            </p>
                        ) : (
                            <p className='instruction'>
                                Aucun vélo trouvé sur votre compte VanMoof.
                            </p>
                        )}

                        {status.kind === 'idle' && credentials.bikes.length > 0 && (
                            <Button onClick={shareAllBikes}>
                                ✅ Confirmer le partage
                            </Button>
                        )}

                        {status.kind === 'running' && (
                            <div className='box info'>
                                ⏳ Partage en cours…
                            </div>
                        )}

                        {status.kind === 'success' && (
                            <div className='box ok'>
                                <h3>🎉 Merci !</h3>
                                <p>
                                    {status.count === 1
                                        ? 'Votre vélo a bien été partagé avec funmoov atelier.'
                                        : `Vos ${status.count} vélos ont bien été partagés avec funmoov atelier.`}
                                </p>
                                <p className='subtle'>
                                    Vous pouvez maintenant fermer cette page.
                                    Pour révoquer le partage plus tard, ouvrez l'app VanMoof officielle.
                                </p>
                            </div>
                        )}

                        {status.kind === 'partial' && (
                            <div className='box warn'>
                                <h3>⚠️ Partage partiel</h3>
                                <p>
                                    {status.success} vélo(s) partagé(s), {status.failed} échec(s).
                                </p>
                                <details>
                                    <summary>Détails des erreurs</summary>
                                    <ul>{status.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                                </details>
                            </div>
                        )}

                        {status.kind === 'error' && (
                            <div className='box err'>
                                <h3>❌ Erreur</h3>
                                <p>{status.message}</p>
                                <Button onClick={shareAllBikes} secondary>Réessayer</Button>
                            </div>
                        )}
                    </>
                )}

                <p className='legal'>
                    Le partage vous reste révocable à tout moment depuis l'app VanMoof officielle.
                    Aucune donnée de paiement n'est partagée — uniquement le contrôle technique du vélo.
                </p>
            </main>

            <Footer />

            <style jsx>{`
                main {
                    padding: 2.5rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    max-width: 600px;
                    margin: 0 auto;
                    min-height: calc(100vh - 100px);
                }
                .logo {
                    width: 160px;
                    height: 160px;
                    margin-bottom: 8px;
                }
                h1 {
                    text-align: center;
                    margin: 4px 0 0 0;
                    letter-spacing: -0.5px;
                    color: var(--text-color);
                }
                .subtitle {
                    color: var(--text-muted);
                    text-align: center;
                    margin: 8px 0 30px 0;
                }
                .instruction {
                    color: var(--text-color);
                    text-align: center;
                    margin: 20px 0;
                    line-height: 1.5;
                }
                .box {
                    width: 100%;
                    max-width: 460px;
                    padding: 20px 24px;
                    border-radius: var(--radius-section);
                    margin: 20px 0;
                    border-left: 4px solid;
                }
                .box h3 { margin-top: 0; }
                .box p { line-height: 1.5; margin: 8px 0; }
                .box .subtle { color: var(--text-muted); font-size: 0.9em; }
                .info { background: rgba(156,201,240,0.10); border-left-color: var(--accent-color); }
                .ok { background: rgba(80,200,120,0.10); border-left-color: #6fdc8c; }
                .warn { background: rgba(255,180,60,0.12); border-left-color: #ffb060; }
                .err { background: rgba(255,90,90,0.15); border-left-color: #ff6060; }
                .legal {
                    color: var(--text-muted);
                    font-size: 0.8rem;
                    text-align: center;
                    margin-top: 30px;
                    line-height: 1.5;
                    max-width: 480px;
                }
            `}</style>
        </div>
    )
}

export default PartagerPage
