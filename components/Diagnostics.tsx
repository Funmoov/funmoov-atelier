import { useEffect, useState } from 'react'
import { Bike } from '../lib/bike'
import { Button } from './Button'
import {
    takeDiagnosticSnapshot,
    DiagnosticSnapshot,
} from '../lib/diagnostics'

interface Props {
    bike: Bike
}

/**
 * Écran de diagnostic atelier.
 * Affiche l'identité complète du vélo, toutes les versions firmware,
 * les codes erreur actifs et leur interprétation, l'état des modules.
 */
export default function Diagnostics({ bike }: Props) {
    const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const runDiagnostic = async () => {
        setLoading(true)
        setError(null)
        try {
            const snap = await takeDiagnosticSnapshot(bike)
            setSnapshot(snap)
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setLoading(false)
        }
    }

    // Lance un diag automatique à l'ouverture
    useEffect(() => {
        runDiagnostic()
    }, [])

    const exportJson = () => {
        if (!snapshot) return
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ts = snapshot.timestamp.replace(/[:.]/g, '-')
        a.download = `diag-${snapshot.frameNumber || snapshot.mac.replaceAll(':', '')}-${ts}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className='diag-root'>
            <h2>🔧 Diagnostic atelier</h2>

            <div className='actions'>
                <Button onClick={runDiagnostic}>
                    {loading ? '⏳ Lecture…' : '🔄 Relancer diagnostic'}
                </Button>
                {snapshot && (
                    <Button onClick={exportJson} secondary>
                        💾 Exporter JSON
                    </Button>
                )}
            </div>

            {error && (
                <div className='error'>
                    <strong>Erreur :</strong> {error}
                </div>
            )}

            {snapshot && (
                <>
                    <Section title='🪪 Identité'>
                        <KV k='Frame number' v={snapshot.frameNumber || '—'} />
                        <KV k='MAC' v={snapshot.mac} />
                        <KV k='ID compte' v={snapshot.id ?? '—'} />
                        <KV k='Diagnostic' v={new Date(snapshot.timestamp).toLocaleString('fr-FR')} />
                    </Section>

                    <Section title='💾 Firmware & Hardware'>
                        <KV k='Bike' v={snapshot.firmware.bike || '—'} />
                        <KV k='BLE chip' v={snapshot.firmware.bleChip || '—'} />
                        <KV k='Controller' v={snapshot.firmware.controller || '—'} />
                        <KV k='PCBA hardware' v={snapshot.firmware.pcbaHardware || '—'} />
                        <KV k='GSM' v={snapshot.firmware.gsm || '—'} />
                        <KV k='E-Shifter' v={snapshot.firmware.eShifter || '—'} />
                        <KV k='Battery' v={snapshot.firmware.battery || '—'} />
                    </Section>

                    <Section title='⚠️ Codes erreur'>
                        {snapshot.errors.activeCodes.length === 0 ? (
                            <p className='ok'>✅ Aucun code erreur actif</p>
                        ) : (
                            <>
                                <p className='warning'>
                                    {snapshot.errors.activeCodes.length} code(s) actif(s)
                                </p>
                                {snapshot.errors.interpretations.map((err) => (
                                    <div key={err.code} className='error-card'>
                                        <div className='error-header'>
                                            <span className='error-hex'>{err.hex}</span>
                                            <span className='error-sub'>{err.subsystem}</span>
                                        </div>
                                        <div className='error-title'>{err.title}</div>
                                        <div className='error-desc'>{err.description}</div>
                                        {err.likelyCauses.length > 0 && (
                                            <div className='error-block'>
                                                <strong>Causes probables :</strong>
                                                <ul>
                                                    {err.likelyCauses.map((c, i) => (
                                                        <li key={i}>{c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {err.diagSteps.length > 0 && (
                                            <div className='error-block'>
                                                <strong>Démarche de diag :</strong>
                                                <ol>
                                                    {err.diagSteps.map((s, i) => (
                                                        <li key={i}>{s}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                        <details className='raw'>
                            <summary>Données brutes</summary>
                            <code>{snapshot.errors.rawHex || '(vide)'}</code>
                        </details>
                    </Section>

                    <Section title='🔌 État modules'>
                        <KV k='Module state (hex)' v={snapshot.moduleState.rawHex || '—'} mono />
                        <KV k='Module mode (hex)' v={snapshot.moduleMode.rawHex || '—'} mono />
                    </Section>

                    <Section title='🔋 Batteries'>
                        <KV
                            k='Batterie moteur'
                            v={
                                snapshot.motorBattery.percentage !== null
                                    ? `${snapshot.motorBattery.percentage}%`
                                    : '—'
                            }
                        />
                        <KV
                            k='Batterie module'
                            v={
                                snapshot.moduleBattery.percentage !== null
                                    ? `${snapshot.moduleBattery.percentage}%`
                                    : '—'
                            }
                        />
                        <details className='raw'>
                            <summary>Dumps bruts pour Battery Lab</summary>
                            <p>
                                <strong>Motor state :</strong>{' '}
                                <code>{snapshot.motorBattery.state.rawHex || '(vide)'}</code>
                            </p>
                            <p>
                                <strong>Module state :</strong>{' '}
                                <code>{snapshot.moduleBattery.state.rawHex || '(vide)'}</code>
                            </p>
                        </details>
                    </Section>

                    <Section title='🚲 État roulement & sécurité'>
                        <KV
                            k='Distance totale'
                            v={snapshot.distance !== null ? `${snapshot.distance} km` : '—'}
                        />
                        <KV
                            k='Vitesse instantanée'
                            v={snapshot.currentSpeed !== null ? `${snapshot.currentSpeed} km/h` : '—'}
                        />
                        <KV
                            k='Lock state'
                            v={snapshot.lockState !== null ? `${snapshot.lockState}` : '—'}
                        />
                        <KV
                            k='Alarm state'
                            v={snapshot.alarmState !== null ? `${snapshot.alarmState}` : '—'}
                        />
                    </Section>
                </>
            )}

            <style jsx>{`
                .diag-root {
                    width: 100%;
                    max-width: 800px;
                    margin-top: 20px;
                }
                h2 {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .error {
                    background: #fee;
                    color: #900;
                    padding: 12px;
                    border-radius: 8px;
                    margin: 10px 0;
                }
                .ok {
                    color: #2a7a3a;
                    font-weight: bold;
                    text-align: center;
                    padding: 12px;
                }
                .warning {
                    color: #a04400;
                    font-weight: bold;
                    text-align: center;
                }
                .error-card {
                    border: 2px solid #d04000;
                    border-radius: 8px;
                    padding: 12px;
                    margin: 10px 0;
                    background: rgba(208, 64, 0, 0.06);
                }
                .error-header {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .error-hex {
                    background: #d04000;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-weight: bold;
                }
                .error-sub {
                    background: #e0e0e0;
                    color: #333;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                .error-title {
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-bottom: 6px;
                }
                .error-desc {
                    margin-bottom: 10px;
                    color: #555;
                }
                .error-block {
                    margin-top: 8px;
                }
                .error-block ul,
                .error-block ol {
                    margin: 4px 0 0 20px;
                }
                .raw {
                    margin-top: 12px;
                    font-size: 0.9em;
                }
                .raw code {
                    font-family: monospace;
                    background: rgba(0, 0, 0, 0.05);
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: inline-block;
                    word-break: break-all;
                }
                @media (prefers-color-scheme: dark) {
                    .error {
                        background: #2a0000;
                        color: #ff9090;
                    }
                    .error-card {
                        background: rgba(208, 64, 0, 0.15);
                    }
                    .error-desc {
                        color: #ccc;
                    }
                    .error-sub {
                        background: #404040;
                        color: #e0e0e0;
                    }
                    .raw code {
                        background: rgba(255, 255, 255, 0.08);
                    }
                }
            `}</style>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className='section'>
            <h3>{title}</h3>
            <div className='content'>{children}</div>
            <style jsx>{`
                .section {
                    margin: 20px 0;
                    padding: 16px;
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.03);
                }
                .section h3 {
                    margin: 0 0 12px 0;
                }
                .content {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                @media (prefers-color-scheme: dark) {
                    .section {
                        background: rgba(255, 255, 255, 0.05);
                    }
                }
            `}</style>
        </section>
    )
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
    return (
        <div className='kv'>
            <span className='k'>{k}</span>
            <span className={mono ? 'v mono' : 'v'}>{v}</span>
            <style jsx>{`
                .kv {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 4px 0;
                    border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
                }
                .k {
                    color: #666;
                    flex-shrink: 0;
                }
                .v {
                    text-align: right;
                    font-weight: 500;
                    word-break: break-all;
                }
                .mono {
                    font-family: monospace;
                    font-size: 0.9em;
                }
                @media (prefers-color-scheme: dark) {
                    .kv {
                        border-bottom-color: rgba(255, 255, 255, 0.15);
                    }
                    .k {
                        color: #aaa;
                    }
                }
            `}</style>
        </div>
    )
}
