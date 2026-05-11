import { useEffect, useState } from 'react'
import { Bike } from '../lib/bike'
import { Button } from './Button'
import {
    takeDiagnosticSnapshot,
    DiagnosticSnapshot,
} from '../lib/diagnostics'
import { generatePdfReport } from '../lib/pdfReport'

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

    const exportPdf = () => {
        if (!snapshot) return
        try {
            generatePdfReport(snapshot)
        } catch (e: any) {
            setError(`Erreur génération PDF : ${e?.message ?? e}`)
        }
    }

    return (
        <div className='diag-root'>
            <h2>🔧 Diagnostic atelier</h2>

            <div className='actions'>
                <Button onClick={runDiagnostic}>
                    {loading ? '⏳ Lecture…' : '🔄 Relancer diagnostic'}
                </Button>
                {snapshot && (
                    <>
                        <Button onClick={exportPdf}>
                            📄 Exporter PDF
                        </Button>
                        <Button onClick={exportJson} secondary>
                            💾 JSON
                        </Button>
                    </>
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
                    background: var(--error-box-bg-color);
                    color: var(--error-text-color);
                    padding: 12px 16px;
                    border-radius: var(--radius-card);
                    margin: 10px 0;
                }
                .ok {
                    color: #6fdc8c;
                    font-weight: 600;
                    text-align: center;
                    padding: 12px;
                }
                .warning {
                    color: #ffb060;
                    font-weight: 600;
                    text-align: center;
                }
                .error-card {
                    border: 1px solid rgba(255, 144, 144, 0.35);
                    border-radius: var(--radius-card);
                    padding: 14px 16px;
                    margin: 10px 0;
                    background: var(--error-box-bg-color);
                }
                .error-header {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .error-hex {
                    background: var(--error-text-color);
                    color: var(--accent-text-color);
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-family: 'Menlo', 'Consolas', monospace;
                    font-weight: 600;
                    font-size: 0.9em;
                }
                .error-sub {
                    background: var(--section-bg-elevated);
                    color: var(--text-muted);
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.85em;
                }
                .error-title {
                    font-weight: 600;
                    font-size: 1.05em;
                    margin-bottom: 6px;
                    color: var(--text-color);
                }
                .error-desc {
                    margin-bottom: 10px;
                    color: var(--text-muted);
                }
                .error-block {
                    margin-top: 10px;
                }
                .error-block strong {
                    color: var(--text-color);
                }
                .error-block ul,
                .error-block ol {
                    margin: 4px 0 0 20px;
                    color: var(--text-muted);
                }
                .raw {
                    margin-top: 14px;
                    font-size: 0.9em;
                    color: var(--text-muted);
                }
                .raw summary {
                    cursor: pointer;
                }
                .raw code {
                    font-family: 'Menlo', 'Consolas', monospace;
                    background: var(--section-bg-elevated);
                    padding: 6px 10px;
                    border-radius: 6px;
                    display: inline-block;
                    word-break: break-all;
                    color: var(--text-color);
                    margin-top: 4px;
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
                    padding: 18px 20px;
                    border-radius: var(--radius-section);
                    background: var(--section-bg-color);
                }
                .section h3 {
                    margin: 0 0 12px 0;
                }
                .content {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                /* Thème sombre forcé via globals.css */
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
                    padding: 6px 0;
                    border-bottom: 1px solid var(--divider-color);
                }
                .kv:last-child {
                    border-bottom: none;
                }
                .k {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }
                .v {
                    text-align: right;
                    font-weight: 500;
                    word-break: break-all;
                    color: var(--text-color);
                }
                .mono {
                    font-family: 'Menlo', 'Consolas', monospace;
                    font-size: 0.88em;
                }
            `}</style>
        </div>
    )
}
