/**
 * funmoov atelier — Générateur de rapport PDF client.
 *
 * Produit un rapport formaté à partir d'un DiagnosticSnapshot, structuré en
 * sections claires lisibles pour un client final (pas un mécano).
 *
 * On utilise jsPDF + jspdf-autotable, deux libs très légères et bien éprouvées
 * pour les exports PDF dans des SPA React.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DiagnosticSnapshot } from './diagnostics'

const COLOR_BRAND = [29, 58, 74] as [number, number, number] // #1d3a4a
const COLOR_ACCENT = [196, 168, 122] as [number, number, number] // #c4a87a (beige ATELIER)
const COLOR_TEXT = [40, 40, 40] as [number, number, number]
const COLOR_MUTED = [120, 120, 120] as [number, number, number]
const COLOR_ERROR = [200, 60, 40] as [number, number, number]

export function generatePdfReport(snapshot: DiagnosticSnapshot, bikeName?: string): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 16
    let y = margin

    // ============================================================
    // En-tête : bandeau brand + titre rapport
    // ============================================================
    doc.setFillColor(...COLOR_BRAND)
    doc.rect(0, 0, pageWidth, 28, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('funmoov atelier', margin, 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_ACCENT)
    doc.text('ATELIER & BOUTIQUE VANMOOF PARIS', margin, 19)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.text('funmoovparis.fr', margin, 24)

    // Date du rapport (alignée à droite)
    const reportDate = new Date(snapshot.timestamp).toLocaleString('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
    })
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.text(reportDate, pageWidth - margin, 13, { align: 'right' })
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_ACCENT)
    doc.text('Rapport de diagnostic', pageWidth - margin, 19, { align: 'right' })

    y = 38

    // ============================================================
    // Titre rapport
    // ============================================================
    doc.setTextColor(...COLOR_BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(`Diagnostic VanMoof${bikeName ? ' — ' + bikeName : ''}`, margin, y)
    y += 8

    // ============================================================
    // Section : Identité
    // ============================================================
    y = section(doc, 'Identité du vélo', y)
    autoTable(doc, {
        startY: y,
        head: [['Champ', 'Valeur']],
        body: [
            ['Numéro de cadre', snapshot.frameNumber || '—'],
            ['Adresse MAC', snapshot.mac],
            ['ID compte VanMoof', snapshot.id ?? '—'],
        ],
        ...tableStyle(),
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // ============================================================
    // Section : Firmware & Hardware
    // ============================================================
    y = section(doc, 'Versions Firmware & Hardware', y)
    autoTable(doc, {
        startY: y,
        head: [['Composant', 'Version']],
        body: [
            ['Vélo (firmware principal)', snapshot.firmware.bike || '—'],
            ['Module BLE', snapshot.firmware.bleChip || '—'],
            ['Contrôleur moteur', snapshot.firmware.controller || '—'],
            ['Hardware PCBA', snapshot.firmware.pcbaHardware || '—'],
            ['Module GSM', snapshot.firmware.gsm || '—'],
            ['E-Shifter', snapshot.firmware.eShifter || '—'],
            ['Batterie', snapshot.firmware.battery || '—'],
        ],
        ...tableStyle(),
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // ============================================================
    // Section : Codes erreur
    // ============================================================
    y = section(doc, 'Codes erreur', y, snapshot.errors.activeCodes.length > 0)

    if (snapshot.errors.activeCodes.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(40, 140, 60)
        doc.text('Aucun code erreur actif. ✓', margin, y)
        doc.setTextColor(...COLOR_TEXT)
        y += 10
    } else {
        const errorRows = snapshot.errors.interpretations.map(err => [
            err.hex,
            err.subsystem,
            err.title,
            err.likelyCauses.join('\n• '),
        ])
        autoTable(doc, {
            startY: y,
            head: [['Code', 'Sous-système', 'Description', 'Causes probables']],
            body: errorRows,
            ...tableStyle(COLOR_ERROR),
            columnStyles: {
                0: { cellWidth: 18, fontStyle: 'bold' },
                1: { cellWidth: 28 },
                2: { cellWidth: 55 },
                3: { cellWidth: 'auto' },
            },
        })
        y = (doc as any).lastAutoTable.finalY + 8

        // Démarches de diag (détail par code)
        for (const err of snapshot.errors.interpretations) {
            if (y > 250) { doc.addPage(); y = margin }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(...COLOR_BRAND)
            doc.text(`${err.hex} — Démarche de diagnostic`, margin, y)
            y += 5
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.setTextColor(...COLOR_TEXT)
            for (const step of err.diagSteps) {
                const lines = doc.splitTextToSize(`• ${step}`, pageWidth - 2 * margin)
                doc.text(lines, margin + 2, y)
                y += lines.length * 4
            }
            y += 4
        }
    }

    // ============================================================
    // Section : État roulement & sécurité
    // ============================================================
    if (y > 230) { doc.addPage(); y = margin }
    y = section(doc, 'État roulement & sécurité', y)
    autoTable(doc, {
        startY: y,
        head: [['Mesure', 'Valeur']],
        body: [
            ['Distance totale parcourue', snapshot.distance !== null ? `${snapshot.distance} km` : '—'],
            ['Vitesse instantanée', snapshot.currentSpeed !== null ? `${snapshot.currentSpeed} km/h` : '—'],
            ['Batterie moteur', snapshot.motorBattery.percentage !== null ? `${snapshot.motorBattery.percentage} %` : '—'],
            ['Batterie module BLE/GSM', snapshot.moduleBattery.percentage !== null ? `${snapshot.moduleBattery.percentage} %` : '—'],
            ['État du verrou', formatLockState(snapshot.lockState)],
            ['État de l\'alarme', snapshot.alarmState !== null ? snapshot.alarmState.toString() : '—'],
        ],
        ...tableStyle(),
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // ============================================================
    // Section : Données techniques (annexe pour le mécano)
    // ============================================================
    if (y > 220) { doc.addPage(); y = margin }
    y = section(doc, 'Annexe technique (hex bruts)', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text('Données brutes pour archivage / analyse approfondie.', margin, y)
    y += 5
    autoTable(doc, {
        startY: y,
        head: [['Caractéristique', 'Bytes hex']],
        body: [
            ['Module state', snapshot.moduleState.rawHex || '(vide)'],
            ['Module mode', snapshot.moduleMode.rawHex || '(vide)'],
            ['Errors', snapshot.errors.rawHex || '(vide)'],
            ['Motor battery state', snapshot.motorBattery.state.rawHex || '(vide)'],
            ['Module battery state', snapshot.moduleBattery.state.rawHex || '(vide)'],
        ],
        ...tableStyle(),
        styles: { ...tableStyle().styles, font: 'courier', fontSize: 8 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // ============================================================
    // Pied de page sur chaque page
    // ============================================================
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setDrawColor(...COLOR_BRAND)
        doc.setLineWidth(0.3)
        doc.line(margin, 285, pageWidth - margin, 285)
        doc.setFontSize(8)
        doc.setTextColor(...COLOR_MUTED)
        doc.text('funmoov atelier · funmoovparis.fr · contact@funmoovparis.fr', margin, 290)
        doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, 290, { align: 'right' })
    }

    // Téléchargement
    const ts = snapshot.timestamp.replace(/[:.]/g, '-')
    const filename = `diagnostic-${snapshot.frameNumber || snapshot.mac.replaceAll(':', '')}-${ts}.pdf`
    doc.save(filename)
}

// ====================================================================
// Helpers
// ====================================================================

function section(doc: jsPDF, title: string, y: number, alert = false): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...(alert ? COLOR_ERROR : COLOR_BRAND))
    doc.text(title, 16, y)
    doc.setDrawColor(...(alert ? COLOR_ERROR : COLOR_ACCENT))
    doc.setLineWidth(0.5)
    doc.line(16, y + 1, 60, y + 1)
    return y + 6
}

function tableStyle(headColor: [number, number, number] = COLOR_BRAND) {
    return {
        styles: {
            font: 'helvetica' as const,
            fontSize: 9,
            cellPadding: 2.5,
            textColor: COLOR_TEXT,
        },
        headStyles: {
            fillColor: headColor,
            textColor: [255, 255, 255] as [number, number, number],
            fontStyle: 'bold' as const,
        },
        alternateRowStyles: {
            fillColor: [245, 245, 247] as [number, number, number],
        },
        margin: { left: 16, right: 16 },
    }
}

function formatLockState(state: number | null): string {
    if (state === null) return '—'
    switch (state) {
        case 0: return 'Déverrouillé'
        case 1: return 'Verrouillé'
        case 2: return 'En attente de verrouillage'
        default: return `Code ${state}`
    }
}
