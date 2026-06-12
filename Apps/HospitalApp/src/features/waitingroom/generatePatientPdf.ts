// HospitalApp/src/features/waitingroom/generatePatientPdf.ts
// Generates a formatted PDF from encounter data and triggers download.

import jsPDF from 'jspdf';
import type { Encounter } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function getWarnings(encounter: Encounter): string[] {
    const notes: string[] = [];
    const p = encounter.patient;
    if (p?.allergies) notes.push(p.allergies);
    if (p?.conditions) notes.push(p.conditions);
    if (p?.optionalHealthInfo) {
        const info = p.optionalHealthInfo as Record<string, unknown>;
        if (info?.warningNotes) {
            if (Array.isArray(info.warningNotes)) notes.push(...(info.warningNotes as string[]));
        }
    }
    return notes;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const COLORS = {
    primary: [25, 73, 184] as const,    // #1949b8
    dark: [17, 24, 39] as const,        // gray-900
    muted: [107, 114, 128] as const,    // gray-500
    light: [243, 244, 246] as const,    // gray-100
    danger: [220, 38, 38] as const,     // red-600
    white: [255, 255, 255] as const,
};

// ─── PDF Generator ──────────────────────────────────────────────────────────

export function generatePatientPdf(encounter: Encounter): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ── Helper to add a new page if needed ──
    function checkPageBreak(needed: number) {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y + needed > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    }

    // ── Helper to draw section header ──
    function sectionHeader(title: string) {
        checkPageBreak(14);
        y += 4;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.primary);
        doc.text(title.toUpperCase(), margin, y);
        y += 1.5;
        doc.setDrawColor(...COLORS.primary);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + contentWidth, y);
        y += 5;
    }

    // ── Helper to draw a key-value pair ──
    function kvPair(label: string, value: string, indent = 0) {
        checkPageBreak(7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.muted);
        doc.text(label, margin + indent, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.dark);
        doc.text(value, margin + indent + 38, y);
        y += 5.5;
    }

    const name = patientName(encounter.patient);
    const triageAssessments = 'triageAssessments' in encounter ? encounter.triageAssessments : undefined;
    const latestTriage = triageAssessments?.[triageAssessments.length - 1];
    const warnings = getWarnings(encounter);

    // ═══════════════════════════════════════════════════════════════════════════
    // HEADER — Priage branded banner
    // ═══════════════════════════════════════════════════════════════════════════

    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text('Priage', margin, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Patient Profile Report', margin, 18);

    doc.setFontSize(8);
    doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, 18, { align: 'right' });

    y = 36;

    // Patient name + ID
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(name, margin, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(`Encounter #${encounter.id}  ·  Status: ${encounter.status}`, margin, y + 6);

    y += 14;

    // ═══════════════════════════════════════════════════════════════════════════
    // MEDICAL ALERTS
    // ═══════════════════════════════════════════════════════════════════════════

    if (warnings.length > 0) {
        checkPageBreak(18);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(...COLORS.danger);
        doc.setLineWidth(0.3);
        const alertHeight = 8 + warnings.length * 5;
        doc.roundedRect(margin, y, contentWidth, alertHeight, 2, 2, 'FD');

        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.danger);
        doc.text('MEDICAL ALERTS', margin + 4, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        for (const w of warnings) {
            doc.text(`• ${w}`, margin + 6, y);
            y += 5;
        }
        y += 3;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PATIENT INFORMATION
    // ═══════════════════════════════════════════════════════════════════════════

    sectionHeader('Patient Information');
    kvPair('Full Name', name);
    kvPair('Age', encounter.patient.age ? `${encounter.patient.age} years` : 'N/A');
    kvPair('Gender', encounter.patient.gender ?? 'N/A');
    kvPair('Phone', encounter.patient.phone ?? 'N/A');
    kvPair('Language', (encounter.patient as any).preferredLanguage ?? 'en');
    kvPair('Encounter ID', `#${encounter.id}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // CHIEF COMPLAINT
    // ═══════════════════════════════════════════════════════════════════════════

    sectionHeader('Chief Complaint');
    checkPageBreak(12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);

    const complaint = encounter.chiefComplaint || 'No complaint recorded';
    const complaintLines = doc.splitTextToSize(complaint, contentWidth - 4);
    doc.text(complaintLines, margin, y);
    y += complaintLines.length * 5 + 2;

    if (encounter.details) {
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        const detailLines = doc.splitTextToSize(encounter.details, contentWidth - 4);
        doc.text(detailLines, margin, y);
        y += detailLines.length * 4.5 + 2;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRIAGE ASSESSMENT
    // ═══════════════════════════════════════════════════════════════════════════

    if (latestTriage) {
        sectionHeader('Latest Triage Assessment');

        kvPair('CTAS Level', String(latestTriage.ctasLevel));
        kvPair('Pain Level', latestTriage.painLevel != null ? `${latestTriage.painLevel}/10` : 'N/A');
        kvPair('Priority Score', String(latestTriage.priorityScore));
        kvPair('Assessed At', formatTimestamp(latestTriage.createdAt));

        const vs = latestTriage.vitalSigns;
        if (vs) {
            y += 2;
            checkPageBreak(8);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.primary);
            doc.text('Vital Signs', margin, y);
            y += 5;

            if (vs.bloodPressure) kvPair('Blood Pressure', vs.bloodPressure, 2);
            if (vs.heartRate) kvPair('Heart Rate', `${vs.heartRate} bpm`, 2);
            if (vs.temperature) kvPair('Temperature', `${vs.temperature}°C`, 2);
            if (vs.respiratoryRate) kvPair('Respiratory Rate', `${vs.respiratoryRate}/min`, 2);
            if (vs.oxygenSaturation) kvPair('SpO₂', `${vs.oxygenSaturation}%`, 2);
        }

        if (latestTriage.note) {
            y += 1;
            checkPageBreak(8);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...COLORS.muted);
            const noteLines = doc.splitTextToSize(`"${latestTriage.note}"`, contentWidth - 4);
            doc.text(noteLines, margin, y);
            y += noteLines.length * 4.5 + 2;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ENCOUNTER TIMELINE
    // ═══════════════════════════════════════════════════════════════════════════

    sectionHeader('Encounter Timeline');

    const timelineItems: [string, string | null | undefined][] = [
        ['Expected', encounter.expectedAt],
        ['Arrived', encounter.arrivedAt],
        ['Triage Started', encounter.triagedAt],
        ['Waiting', encounter.waitingAt],
        ['Seen', encounter.seenAt],
        ['Departed', encounter.departedAt],
    ];

    for (const [label, time] of timelineItems) {
        checkPageBreak(7);
        doc.setFontSize(9);

        // Dot indicator
        if (time) {
            doc.setFillColor(...COLORS.primary);
        } else {
            doc.setFillColor(209, 213, 219); // gray-300
        }
        doc.circle(margin + 2, y - 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.dark);
        doc.text(label, margin + 7, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.muted);
        doc.text(formatTimestamp(time), margin + 42, y);

        y += 5.5;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════════════════

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(
        'This document was generated by Priage and is intended for clinical use only.',
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' },
    );

    // ── Trigger download ──────────────────────────────────────────────────────

    const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    doc.save(`Patient_${safeName}_${encounter.id}.pdf`);
}
