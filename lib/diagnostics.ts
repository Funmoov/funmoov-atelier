/**
 * FunMoov Atelier — Module Diagnostic
 *
 * Lit toutes les caractéristiques BLE utiles pour le diag pro d'un VanMoof S3/X3
 * et fournit un dictionnaire d'interprétation des codes erreur.
 *
 * Ce module utilise la méthode publique `bike.readCharBytes()` ajoutée à la classe Bike.
 * On ne touche pas au code BLE de moovy : on le consomme uniquement.
 */

import {
    Bike,
    Characteristic,
    FRAME_NUMBER,
    BIKE_FIRMWARE_VERSION,
    BLE_CHIP_FIRMWARE_VERSION,
    CONTROLLER_FIRMWARE_VERSION,
    PCBA_HARDWARE_VERSION,
    GSM_FIRMWARE_VERSION,
    E_SHIFTER_FIRMWARE_VERSION,
    BATTERY_FIRMWARE_VERSION,
    ERRORS,
    MODULE_STATE,
    MODULE_MODE,
    MOTOR_BATTERY_STATE,
    MODULE_BATTERY_STATE,
    MODULE_BATTERY_LEVEL,
    MOTOR_BATTERY_LEVEL,
    SPEED,
    DISTANCE,
    LOCK_STATE,
    ALARM_STATE,
} from './bike'

// ============================================================================
// Types exposés
// ============================================================================

export interface FirmwareVersions {
    bike: string
    bleChip: string
    controller: string
    pcbaHardware: string
    gsm: string
    eShifter: string
    battery: string
}

export interface RawDump {
    rawBytes: number[]
    rawHex: string
}

export interface ErrorInterpretation {
    code: number
    hex: string
    subsystem: string
    title: string
    description: string
    likelyCauses: string[]
    diagSteps: string[]
}

export interface ErrorReport extends RawDump {
    activeCodes: number[]
    interpretations: ErrorInterpretation[]
}

export interface DiagnosticSnapshot {
    timestamp: string
    mac: string
    id: string | null
    frameNumber: string
    firmware: FirmwareVersions
    errors: ErrorReport
    moduleState: RawDump
    moduleMode: RawDump
    motorBattery: { percentage: number | null; state: RawDump }
    moduleBattery: { percentage: number | null; state: RawDump }
    distance: number | null
    currentSpeed: number | null
    lockState: number | null
    alarmState: number | null
}

// ============================================================================
// Lecture des caractéristiques (avec gestion d'erreur défensive)
// ============================================================================

async function readString(bike: Bike, c: Characteristic): Promise<string> {
    try {
        const bytes = await bike.readCharBytes(c)
        return new TextDecoder().decode(bytes).replace(/\0+$/, '').trim()
    } catch (e) {
        console.warn('readString failed for', c.id, e)
        return ''
    }
}

function cleanVersion(s: string): string {
    return s.split('.').map(p => p.match(/^0+(.+)/)?.[1] ?? p).join('.')
}

async function readDump(bike: Bike, c: Characteristic): Promise<RawDump> {
    try {
        const bytes = await bike.readCharBytes(c)
        return {
            rawBytes: Array.from(bytes),
            rawHex: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
        }
    } catch (e) {
        return { rawBytes: [], rawHex: '' }
    }
}

async function readByte(bike: Bike, c: Characteristic): Promise<number | null> {
    try {
        const v = await bike.readCharBytes(c)
        return v[0] ?? null
    } catch (e) {
        return null
    }
}

// ============================================================================
// API publique du module
// ============================================================================

export async function readFrameNumber(bike: Bike): Promise<string> {
    return await readString(bike, FRAME_NUMBER)
}

export async function readAllFirmwareVersions(bike: Bike): Promise<FirmwareVersions> {
    const v = async (c: Characteristic) => cleanVersion(await readString(bike, c))
    return {
        bike: await v(BIKE_FIRMWARE_VERSION),
        bleChip: await v(BLE_CHIP_FIRMWARE_VERSION),
        controller: await v(CONTROLLER_FIRMWARE_VERSION),
        pcbaHardware: await v(PCBA_HARDWARE_VERSION),
        gsm: await v(GSM_FIRMWARE_VERSION),
        eShifter: await v(E_SHIFTER_FIRMWARE_VERSION),
        battery: await v(BATTERY_FIRMWARE_VERSION),
    }
}

export async function readErrors(bike: Bike): Promise<ErrorReport> {
    const dump = await readDump(bike, ERRORS)
    const codes = dump.rawBytes.filter(b => b !== 0)
    return {
        ...dump,
        activeCodes: codes,
        interpretations: codes.map(interpretErrorCode),
    }
}

export async function readCurrentSpeed(bike: Bike): Promise<number | null> {
    try {
        const raw = await bike.readCharBytes(SPEED)
        const v = (raw[0] ?? 0) + ((raw[1] ?? 0) << 8)
        return v / 10
    } catch (e) {
        return null
    }
}

export async function readDistance(bike: Bike): Promise<number | null> {
    try {
        const raw = await bike.readCharBytes(DISTANCE)
        const v = raw.reduce((acc, b, idx) => acc + (b << (idx * 8)), 0)
        return v / 10
    } catch (e) {
        return null
    }
}

/**
 * Snapshot complet pour le rapport de diagnostic atelier.
 * Lance toutes les lectures séquentiellement (la queue côté Bike sérialise déjà).
 */
export async function takeDiagnosticSnapshot(bike: Bike): Promise<DiagnosticSnapshot> {
    return {
        timestamp: new Date().toISOString(),
        mac: bike.mac,
        id: typeof bike.id === 'string' ? bike.id : bike.id?.toString() ?? null,
        frameNumber: await readFrameNumber(bike),
        firmware: await readAllFirmwareVersions(bike),
        errors: await readErrors(bike),
        moduleState: await readDump(bike, MODULE_STATE),
        moduleMode: await readDump(bike, MODULE_MODE),
        motorBattery: {
            percentage: await readByte(bike, MOTOR_BATTERY_LEVEL),
            state: await readDump(bike, MOTOR_BATTERY_STATE),
        },
        moduleBattery: {
            percentage: await readByte(bike, MODULE_BATTERY_LEVEL),
            state: await readDump(bike, MODULE_BATTERY_STATE),
        },
        distance: await readDistance(bike),
        currentSpeed: await readCurrentSpeed(bike),
        lockState: await readByte(bike, LOCK_STATE),
        alarmState: await readByte(bike, ALARM_STATE),
    }
}

// ============================================================================
// Dictionnaire d'interprétation des codes erreur VanMoof S3/X3
//
// Sources : reverse engineering communauté + observations atelier.
// À enrichir au fil du temps : ajoute des entrées dans ERROR_CODE_DICT
// quand tu rencontres un code non documenté.
// ============================================================================

function interpretErrorCode(code: number): ErrorInterpretation {
    const hex = '0x' + code.toString(16).padStart(2, '0').toUpperCase()
    const entry = ERROR_CODE_DICT[code]
    if (entry) return { code, hex, ...entry }
    return {
        code,
        hex,
        subsystem: 'Inconnu',
        title: `Code ${hex} non documenté`,
        description: `Code ${code} (${hex}) remonté par le firmware, pas encore répertorié.`,
        likelyCauses: ['Code propriétaire non documenté publiquement'],
        diagSteps: [
            "Note ce code et le firmware exact (onglet Identité)",
            "Cherche sur le Discord communauté VanMoof / Mooovy",
            "Ajoute-le au dictionnaire dans lib/diagnostics.ts quand tu trouves la cause",
        ],
    }
}

type ErrorCodeEntry = Omit<ErrorInterpretation, 'code' | 'hex'>

const ERROR_CODE_DICT: Record<number, ErrorCodeEntry> = {
    0x01: {
        subsystem: 'Moteur',
        title: 'Erreur moteur générique',
        description: 'Le contrôleur a remonté une anomalie sur le moteur arrière.',
        likelyCauses: ['Câble moteur déconnecté', 'Hall sensor moteur HS', 'Contrôleur moteur en panne'],
        diagSteps: [
            "Vérifie la connexion du câble moteur côté contrôleur",
            "Inspecte le hall sensor moteur (continuité au multimètre)",
            "Si OK → suspect contrôleur",
        ],
    },
    0x02: {
        subsystem: 'Frein',
        title: 'Capteur de frein défaillant',
        description: 'Le signal du capteur de freinage est absent ou incohérent.',
        likelyCauses: ['Câble capteur frein débranché', 'Capteur frein cassé', 'Aimant manquant'],
        diagSteps: [
            "Vérifie la présence et l'alignement de l'aimant sur la poignée de frein",
            "Test continuité câble capteur frein",
            "Remplace le capteur si défaillant",
        ],
    },
    0x03: {
        subsystem: 'Batterie',
        title: 'Batterie déconnectée ou tension hors plage',
        description: 'Le BMS ne communique pas ou la tension batterie est anormale.',
        likelyCauses: ['Connecteur batterie oxydé', 'BMS HS', 'Cell(s) en sous-tension critique'],
        diagSteps: [
            "Nettoie le connecteur batterie",
            "Mesure tension pack (~36V chargée)",
            "Va dans Battery Lab pour voir l'état détaillé des cells",
        ],
    },
    0x04: {
        subsystem: 'E-Shifter',
        title: 'Erreur changement de vitesse',
        description: "L'e-shifter ne répond pas ou est désaligné.",
        likelyCauses: ['Câble e-shifter pincé', 'Capteur position désaligné', 'Moteur shifter HS'],
        diagSteps: [
            "Inspection visuelle câble e-shifter",
            "Recalibration via app officielle si disponible",
            "Remplace l'e-shifter si nécessaire",
        ],
    },
    0x05: {
        subsystem: 'Lumières',
        title: "Erreur sur le système d'éclairage",
        description: 'Une LED ou son driver ne répond pas.',
        likelyCauses: ['LED grillée', 'Câble LED coupé', 'Driver lumière HS'],
        diagSteps: [
            "Test allumage forcé via Controls",
            "Inspection câblage avant + arrière",
            "Remplacement LED ou driver si confirmé",
        ],
    },
    0x06: {
        subsystem: 'GSM',
        title: 'Module GSM injoignable',
        description: "Le module GSM ne s'enregistre pas sur le réseau.",
        likelyCauses: ['Antenne GSM débranchée', 'Carte SIM HS / sans crédit', 'Module GSM en panne'],
        diagSteps: [
            "Vérifie raccordement antenne",
            "Vérifie statut SIM côté VanMoof",
            "Reboot complet (déconnecte batterie 1 min)",
        ],
    },
    0x07: {
        subsystem: 'BLE',
        title: 'Erreur Bluetooth interne',
        description: 'Le chip BLE remonte une erreur.',
        likelyCauses: ['Firmware BLE corrompu', 'Chip BLE défectueux'],
        diagSteps: [
            "Reboot du vélo",
            "Reflashe firmware BLE si possible",
        ],
    },
    0x10: {
        subsystem: 'Capteur',
        title: 'Capteur de cadence ou roue',
        description: 'Capteur de mouvement non détecté.',
        likelyCauses: ['Aimant manquant ou décollé', 'Capteur Hall HS', 'Câble pincé'],
        diagSteps: [
            "Vérifie présence aimant sur rayon (capteur roue)",
            "Vérifie aimants pédalier (capteur cadence)",
            "Mesure signal Hall si possible",
        ],
    },
    // Ajoute ici les codes que tu rencontres en atelier :
    // 0xXX: { subsystem, title, description, likelyCauses, diagSteps },
}
