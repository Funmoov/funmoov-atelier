import { useEffect, useState } from 'react'
import { Bike } from '../lib/bike'
import { Button } from './Button'
import {
    takeDiagnosticSnapshot,
    DiagnosticSnapshot,
} from '../lib/diagnostics'
import {
    analyzeBattery,
    BatteryAnalysis,
    Recommendation,
    CELL_MJ1,
    DEFAULT_PACK_S3X3,
} from '../lib/batteryLab'

interface Props {
    bike: Bike
}

/**
 * Battery Lab — analyse santé batterie pour S3/X3.
 * Combine les données BLE disponibles avec les specs cells MJ1 pour
 * estimer cycles, SoH, autonomie restante, et générer des recommandations.
 */
export default function BatteryLab({ bike }: Props) {
    const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null)
    const [analysis, setAnalysis] = useState<BatteryAnalysis | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const refresh = async () => {
        setLoading(true)
        setError(null)
        try {
            const snap = await takeDiagnosticSnapshot(bike)
            setSnapshot(snap)
            setAnalysis(analyzeBattery(snap))
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { refresh() }, [])

    return (
        <div className='lab-root'>
            <h2>🔋 Battery Lab</h2>

            <div className='actions'>
                <Button onClick={refresh}>
                    {loading ? '⏳ Lecture…' : '🔄 Actualiser'}
                </Button>
            </div>

            {error && (
                <div className='error'>
                    <strong>Erreur :</strong> {error}
                </div>
            )}

            {analysis && (
                <>
                    {/* Configuration pack */}
                    <Section title='⚙️ Configuration du pack'>
                        <KV k='Cellules' v={`${CELL_MJ1.model} (${CELL_MJ1.manufacturer})`} />
                        <KV k='Configuration' v={`${analysis.pack.config} — ${analysis.pack.totalCells} cellules`} />
                        <KV k='Tension nominale' v={`${analysis.pack.nominalVoltage} V`} />
                        <KV k='Capacité nominale' v={`${analysis.pack.nominalCapacity} Ah`} />
                        <KV k='Énergie nominale' v={`${analysis.pack.nominalEnergy} Wh`} highlight />
                        <KV k='Courant max décharge' v={`${analysis.pack.maxDischargeCurrent} A`} />
                        <KV k='ID interne' v={analysis.pack.internalId} mono />
                        <KV k='Firmware batterie' v={analysis.pack.firmwareVersion} mono />
                    </Section>

                    {/* État actuel */}
                    <Section title='📊 État actuel'>
                        <GaugeRow
                            label='Batterie moteur'
                            value={analysis.currentState.motorPercentage}
                        />
                        <GaugeRow
                            label='Batterie module'
                            value={analysis.currentState.modulePercentage}
                        />
                        {analysis.currentState.storedEnergy !== null && (
                            <KV
                                k='Énergie stockée actuelle'
                                v={`≈ ${analysis.currentState.storedEnergy} Wh`}
                            />
                        )}
                        {analysis.currentState.estimatedRangeRemainingKm !== null && (
                            <KV
                                k='Autonomie restante estimée'
                                v={`≈ ${analysis.currentState.estimatedRangeRemainingKm} km`}
                                highlight
                            />
                        )}
                    </Section>

                    {/* Estimation d'usure */}
                    <Section title='⏱️ Estimation d\'usure'>
                        <KV
                            k='Distance totale'
                            v={
                                analysis.wearEstimate.totalDistanceKm !== null
                                    ? `${analysis.wearEstimate.totalDistanceKm.toLocaleString('fr-FR')} km`
                                    : '—'
                            }
                        />
                        <KV
                            k='Cycles estimés'
                            v={
                                analysis.wearEstimate.estimatedCycles !== null
                                    ? `${analysis.wearEstimate.estimatedCycles} / ${CELL_MJ1.cyclesToEol}`
                                    : '—'
                            }
                        />
                        {analysis.wearEstimate.cyclesToEolPercent !== null && (
                            <ProgressBar
                                label='Vie nominale consommée'
                                percent={Math.min(100, analysis.wearEstimate.cyclesToEolPercent)}
                                colorScheme='wear'
                            />
                        )}
                        {analysis.wearEstimate.estimatedSoH !== null && (
                            <ProgressBar
                                label='SoH estimé (santé)'
                                percent={Math.round(analysis.wearEstimate.estimatedSoH * 100)}
                                colorScheme='health'
                            />
                        )}
                        <KV
                            k='Capacité utile estimée'
                            v={
                                analysis.wearEstimate.usableEnergyEstimate !== null
                                    ? `≈ ${analysis.wearEstimate.usableEnergyEstimate} Wh`
                                    : '—'
                            }
                        />
                    </Section>

                    {/* Recommandations atelier */}
                    <Section title='🛠️ Recommandations atelier'>
                        {analysis.recommendations.map((rec, i) => (
                            <RecCard key={i} rec={rec} />
                        ))}
                    </Section>

                    <p className='disclaimer'>
                        Les estimations sont basées sur la configuration <strong>10S4P MJ1</strong> standard
                        et un usage moyen de <strong>{DEFAULT_PACK_S3X3.avgKmPerCycle} km/cycle</strong>.
                        Pour une mesure de capacité réelle, effectuer une charge complète puis une décharge contrôlée.
                    </p>
                </>
            )}

            <style jsx>{`
                .lab-root {
                    width: 100%;
                    max-width: 800px;
                    margin-top: 20px;
                }
                h2 { text-align: center; margin-bottom: 20px; }
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
                .disclaimer {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    font-style: italic;
                    margin-top: 16px;
                    text-align: center;
                    line-height: 1.5;
                }
            `}</style>
        </div>
    )
}

// ============================================================================
// Sous-composants
// ============================================================================

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
                .section h3 { margin: 0 0 12px 0; }
                .content { display: flex; flex-direction: column; gap: 6px; }
            `}</style>
        </section>
    )
}

function KV({ k, v, mono, highlight }: {
    k: string; v: React.ReactNode; mono?: boolean; highlight?: boolean
}) {
    return (
        <div className='kv'>
            <span className='k'>{k}</span>
            <span className={`v${mono ? ' mono' : ''}${highlight ? ' highlight' : ''}`}>{v}</span>
            <style jsx>{`
                .kv {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 6px 0;
                    border-bottom: 1px solid var(--divider-color);
                }
                .kv:last-child { border-bottom: none; }
                .k { color: var(--text-muted); flex-shrink: 0; }
                .v {
                    text-align: right;
                    font-weight: 500;
                    color: var(--text-color);
                    word-break: break-all;
                }
                .v.mono { font-family: 'Menlo', 'Consolas', monospace; font-size: 0.9em; }
                .v.highlight { color: var(--accent-color); font-weight: 600; }
            `}</style>
        </div>
    )
}

function GaugeRow({ label, value }: { label: string; value: number | null }) {
    const pct = value ?? 0
    return (
        <div className='gauge-row'>
            <div className='gauge-label'>
                <span>{label}</span>
                <span className='gauge-value'>{value !== null ? `${value}%` : '—'}</span>
            </div>
            <div className='gauge-bar'>
                <div className='gauge-fill' style={{ width: `${pct}%`, background: gaugeColor(pct) }} />
            </div>
            <style jsx>{`
                .gauge-row { padding: 8px 0; border-bottom: 1px solid var(--divider-color); }
                .gauge-label {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }
                .gauge-label span:first-child { color: var(--text-muted); }
                .gauge-value { font-weight: 600; color: var(--text-color); }
                .gauge-bar {
                    height: 10px;
                    background: var(--section-bg-elevated);
                    border-radius: 6px;
                    overflow: hidden;
                }
                .gauge-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 0.4s ease;
                }
            `}</style>
        </div>
    )
}

function ProgressBar({ label, percent, colorScheme }: {
    label: string; percent: number; colorScheme: 'wear' | 'health'
}) {
    const color = colorScheme === 'health' ? healthColor(percent) : wearColor(percent)
    return (
        <div className='pb-row'>
            <div className='pb-label'>
                <span>{label}</span>
                <span className='pb-value'>{percent}%</span>
            </div>
            <div className='pb-bar'>
                <div className='pb-fill' style={{ width: `${percent}%`, background: color }} />
            </div>
            <style jsx>{`
                .pb-row { padding: 10px 0; }
                .pb-label {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }
                .pb-label span:first-child { color: var(--text-muted); }
                .pb-value { font-weight: 600; color: var(--text-color); }
                .pb-bar {
                    height: 10px;
                    background: var(--section-bg-elevated);
                    border-radius: 6px;
                    overflow: hidden;
                }
                .pb-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 0.4s ease;
                }
            `}</style>
        </div>
    )
}

function RecCard({ rec }: { rec: Recommendation }) {
    return (
        <div className={`rec rec-${rec.severity}`}>
            <div className='rec-icon'>{iconFor(rec.severity)}</div>
            <div className='rec-body'>
                <div className='rec-title'>{rec.title}</div>
                <div className='rec-detail'>{rec.detail}</div>
            </div>
            <style jsx>{`
                .rec {
                    display: flex;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: var(--radius-card);
                    margin: 6px 0;
                    border-left: 4px solid;
                }
                .rec-ok { background: rgba(80,200,120,0.10); border-left-color: #6fdc8c; }
                .rec-info { background: rgba(156,201,240,0.10); border-left-color: var(--accent-color); }
                .rec-warning { background: rgba(255,180,60,0.12); border-left-color: #ffb060; }
                .rec-critical { background: rgba(255,90,90,0.15); border-left-color: #ff6060; }
                .rec-icon { font-size: 1.4em; flex-shrink: 0; }
                .rec-title {
                    font-weight: 600;
                    color: var(--text-color);
                    margin-bottom: 4px;
                }
                .rec-detail { color: var(--text-muted); font-size: 0.92em; line-height: 1.4; }
            `}</style>
        </div>
    )
}

// ============================================================================
// Helpers couleurs
// ============================================================================

function gaugeColor(pct: number): string {
    if (pct >= 60) return '#6fdc8c'   // vert
    if (pct >= 30) return '#ffb060'   // orange
    return '#ff6060'                  // rouge
}

function healthColor(pct: number): string {
    if (pct >= 85) return '#6fdc8c'
    if (pct >= 70) return '#ffb060'
    return '#ff6060'
}

function wearColor(pct: number): string {
    if (pct < 40) return '#6fdc8c'
    if (pct < 75) return '#ffb060'
    return '#ff6060'
}

function iconFor(severity: Recommendation['severity']): string {
    switch (severity) {
        case 'ok': return '✅'
        case 'info': return 'ℹ️'
        case 'warning': return '⚠️'
        case 'critical': return '🚨'
    }
}
