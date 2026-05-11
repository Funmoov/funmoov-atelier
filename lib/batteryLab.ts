/**
 * funmoov atelier — Battery Lab
 *
 * Analyse de la santé batterie VanMoof S3/X3, basée sur les specs cells
 * INR18650-MJ1 (LG Chem) et la configuration pack standard 10S4P.
 *
 * Le firmware n'expose pas les tensions individuelles de chaque cell par BLE
 * (limitation de VanMoof), mais on peut estimer la santé batterie à partir
 * du niveau de charge, de la distance totale, et des courbes de vieillissement
 * connues des cells MJ1.
 */

import type { DiagnosticSnapshot } from './diagnostics'

// ============================================================================
// Specs cells INR18650-MJ1 (LG Chem)
// Sources : datasheet officielle LG + benchmarks Mooch/communauté
// ============================================================================

export const CELL_MJ1 = {
    model: 'INR18650-MJ1',
    manufacturer: 'LG Chem',
    nominalVoltage: 3.6,           // V
    maxVoltage: 4.2,               // V (chargé à 100%)
    cutoffVoltage: 2.5,            // V (déchargé à 0%)
    nominalCapacity: 3.5,          // Ah
    maxDischargeCurrent: 10,       // A continu
    /** Cycles avant 80% SoH (datasheet : 500 cycles charge/décharge complète). */
    cyclesToEol: 500,
    /** SoH minimum acceptable (norme industrielle = 80%, atelier on serre à 70%). */
    soHReplacementThreshold: 0.70,
}

// ============================================================================
// Configuration pack VanMoof S3/X3 (par défaut)
// ============================================================================

export interface PackConfig {
    seriesCount: number      // ex: 10S
    parallelCount: number    // ex: 4P
    /** km moyens parcourus par cycle complet (calibration terrain). */
    avgKmPerCycle: number
    /** Identifiant interne VanMoof si disponible (ex: "J0016"). */
    internalId?: string
}

export const DEFAULT_PACK_S3X3: PackConfig = {
    seriesCount: 10,
    parallelCount: 4,
    avgKmPerCycle: 45,
}

// ============================================================================
// Résultats de l'analyse
// ============================================================================

export interface BatteryAnalysis {
    pack: {
        config: string                 // "10S4P"
        totalCells: number             // 40
        nominalVoltage: number         // 36V
        nominalCapacity: number        // 14 Ah
        nominalEnergy: number          // 504 Wh
        maxDischargeCurrent: number    // 40 A
        internalId: string             // "J0016" ou "—"
        firmwareVersion: string
    }
    currentState: {
        motorPercentage: number | null
        modulePercentage: number | null
        storedEnergy: number | null    // Wh actuels (selon % moteur)
        estimatedRangeRemainingKm: number | null
    }
    wearEstimate: {
        totalDistanceKm: number | null
        estimatedCycles: number | null
        cyclesToEolPercent: number | null   // % des cycles consommés / EoL
        estimatedSoH: number | null         // 0–1
        usableEnergyEstimate: number | null // Wh utiles aujourd'hui
    }
    recommendations: Recommendation[]
}

export interface Recommendation {
    severity: 'ok' | 'info' | 'warning' | 'critical'
    title: string
    detail: string
}

// ============================================================================
// API principale
// ============================================================================

export function analyzeBattery(
    snapshot: DiagnosticSnapshot,
    config: PackConfig = DEFAULT_PACK_S3X3,
): BatteryAnalysis {
    const totalCells = config.seriesCount * config.parallelCount
    const nominalVoltage = config.seriesCount * CELL_MJ1.nominalVoltage
    const nominalCapacityAh = config.parallelCount * CELL_MJ1.nominalCapacity
    const nominalEnergyWh = nominalVoltage * nominalCapacityAh
    const maxDischargeA = config.parallelCount * CELL_MJ1.maxDischargeCurrent

    const motorPct = snapshot.motorBattery.percentage
    const modulePct = snapshot.moduleBattery.percentage
    const distance = snapshot.distance

    // Énergie actuellement stockée (estimation linéaire % → Wh)
    const storedEnergy = motorPct !== null
        ? Math.round((motorPct / 100) * nominalEnergyWh)
        : null

    // Cycles estimés depuis le total km
    const estimatedCycles = distance !== null
        ? Math.round(distance / config.avgKmPerCycle)
        : null

    // SoH estimé (modèle linéaire : 100% neuf, 80% à `cyclesToEol`)
    // SoH = 1 - (cycles / cyclesToEol) * 0.20
    // Clampé entre 0 et 1.
    const estimatedSoH = estimatedCycles !== null
        ? Math.max(0, Math.min(1, 1 - (estimatedCycles / CELL_MJ1.cyclesToEol) * 0.20))
        : null

    const cyclesToEolPercent = estimatedCycles !== null
        ? Math.round((estimatedCycles / CELL_MJ1.cyclesToEol) * 100)
        : null

    // Capacité utile (Wh) compte tenu de l'usure
    const usableEnergyEstimate = estimatedSoH !== null
        ? Math.round(nominalEnergyWh * estimatedSoH)
        : null

    // Autonomie restante estimée (avec énergie actuelle + SoH)
    let estimatedRangeRemainingKm: number | null = null
    if (motorPct !== null && estimatedSoH !== null) {
        // Énergie réelle dispo aujourd'hui = % × (nominal × SoH)
        const usableEnergyNow = (motorPct / 100) * nominalEnergyWh * estimatedSoH
        // Énergie consommée par km ≈ nominalEnergy / avgKmPerCycle (≈ 11 Wh/km)
        const energyPerKm = nominalEnergyWh / config.avgKmPerCycle
        estimatedRangeRemainingKm = Math.round(usableEnergyNow / energyPerKm)
    }

    // Extraction de l'ID batterie depuis le dump motor state
    // Format observé : 00 00 4a 30 30 31 36 → ASCII "J0016"
    const internalId = config.internalId
        || extractInternalIdFromMotorState(snapshot.motorBattery.state.rawBytes)
        || '—'

    const analysis: BatteryAnalysis = {
        pack: {
            config: `${config.seriesCount}S${config.parallelCount}P`,
            totalCells,
            nominalVoltage,
            nominalCapacity: nominalCapacityAh,
            nominalEnergy: nominalEnergyWh,
            maxDischargeCurrent: maxDischargeA,
            internalId,
            firmwareVersion: snapshot.firmware.battery || '—',
        },
        currentState: {
            motorPercentage: motorPct,
            modulePercentage: modulePct,
            storedEnergy,
            estimatedRangeRemainingKm,
        },
        wearEstimate: {
            totalDistanceKm: distance,
            estimatedCycles,
            cyclesToEolPercent,
            estimatedSoH,
            usableEnergyEstimate,
        },
        recommendations: generateRecommendations({
            motorPct,
            modulePct,
            estimatedCycles,
            estimatedSoH,
            cyclesToEolPercent,
        }),
    }

    return analysis
}

// ============================================================================
// Helpers
// ============================================================================

/** Lit la partie ASCII d'un buffer (skip les bytes nuls de début). */
function extractInternalIdFromMotorState(bytes: number[]): string | null {
    if (!bytes.length) return null
    // On garde uniquement les bytes ASCII imprimables
    const printable = bytes.filter(b => b >= 32 && b <= 126)
    if (!printable.length) return null
    return String.fromCharCode(...printable)
}

function generateRecommendations(input: {
    motorPct: number | null
    modulePct: number | null
    estimatedCycles: number | null
    estimatedSoH: number | null
    cyclesToEolPercent: number | null
}): Recommendation[] {
    const recs: Recommendation[] = []

    // Vérif basique des niveaux
    if (input.motorPct !== null && input.motorPct < 20) {
        recs.push({
            severity: 'warning',
            title: 'Batterie moteur faible',
            detail: `Niveau ${input.motorPct}%. Recharger avant le prochain trajet.`,
        })
    }
    if (input.modulePct !== null && input.modulePct < 30) {
        recs.push({
            severity: 'warning',
            title: 'Batterie module BLE/GSM faible',
            detail: `Niveau ${input.modulePct}%. Charge prolongée du vélo recommandée pour recharger le module interne.`,
        })
    }

    // SoH / cycles
    if (input.estimatedSoH !== null) {
        const sohPct = Math.round(input.estimatedSoH * 100)
        if (input.estimatedSoH >= 0.90) {
            recs.push({
                severity: 'ok',
                title: `Batterie en bonne santé (SoH ≈ ${sohPct}%)`,
                detail: 'Usure normale. Pas d\'intervention nécessaire.',
            })
        } else if (input.estimatedSoH >= 0.80) {
            recs.push({
                severity: 'info',
                title: `Usure modérée (SoH ≈ ${sohPct}%)`,
                detail: 'Suivi recommandé. Test de capacité réelle conseillé si autonomie ressentie < 35 km.',
            })
        } else if (input.estimatedSoH >= CELL_MJ1.soHReplacementThreshold) {
            recs.push({
                severity: 'warning',
                title: `Usure avancée (SoH ≈ ${sohPct}%)`,
                detail: 'Test de capacité réelle conseillé. Prévoir remplacement dans les ~100 prochains cycles.',
            })
        } else {
            recs.push({
                severity: 'critical',
                title: `Remplacement batterie recommandé (SoH ≈ ${sohPct}%)`,
                detail: 'Capacité utile sous le seuil atelier (70%). Proposer changement du pack au client.',
            })
        }
    }

    // Cycles consommés
    if (input.cyclesToEolPercent !== null) {
        if (input.cyclesToEolPercent >= 100) {
            recs.push({
                severity: 'critical',
                title: 'Fin de vie nominale atteinte',
                detail: `Cycles estimés > ${CELL_MJ1.cyclesToEol}. Le pack a dépassé sa durée de vie cible, surveiller activement.`,
            })
        } else if (input.cyclesToEolPercent >= 80) {
            recs.push({
                severity: 'warning',
                title: 'Approche fin de vie',
                detail: `${input.cyclesToEolPercent}% des cycles nominaux consommés. Anticiper le remplacement.`,
            })
        }
    }

    // Déséquilibre entre les deux batteries
    if (input.motorPct !== null && input.modulePct !== null) {
        const diff = Math.abs(input.motorPct - input.modulePct)
        if (diff > 30) {
            recs.push({
                severity: 'info',
                title: 'Écart moteur / module important',
                detail: `Écart de ${diff} points entre les deux batteries. Possiblement normal si le vélo n'a pas roulé depuis longtemps. Surveiller si persistant.`,
            })
        }
    }

    if (recs.length === 0) {
        recs.push({
            severity: 'info',
            title: 'Données insuffisantes pour recommandations',
            detail: 'Connecte le vélo et relance le diag pour des recommandations précises.',
        })
    }

    return recs
}
