/**
 * Reporting service.
 *
 * `buildReport` produces the JSON payload that powers the on-screen report and
 * the PDF export, so both always agree. `streamPdf` renders that payload with
 * PDFKit (server side) - government heading, summary statistics, charts drawn
 * as vector bars, the filtered complaint table and resolution statistics.
 */
import PDFDocument from 'pdfkit';
import { db, asIso } from '../db/index.js';
import { STATUS_LABELS, PRIORITY_LABELS, ROLES } from '../config/constants.js';
import { applyComplaintScope } from './scope.js';
import config from '../config/env.js';

const PAGE = { margin: 40, width: 595.28, height: 841.89, contentWidth: 515.28 };
const NAVY = '#1e3a8a';
const GREY = '#64748b';
const LIGHT = '#e2e8f0';

const buildQuery = (user, filters = {}) => {
  const q = db('complaints as c')
    .leftJoin('categories as cat', 'cat.id', 'c.category_id')
    .leftJoin('wards as w', 'w.id', 'c.ward_id')
    .leftJoin('users as o', 'o.id', 'c.assigned_officer_id')
    .leftJoin('users as cu', 'cu.id', 'c.citizen_id');
  applyComplaintScope(q, user);

  if (filters.from) q.where('c.complaint_date', '>=', new Date(`${filters.from}T00:00:00.000Z`));
  if (filters.to) q.where('c.complaint_date', '<=', new Date(`${filters.to}T23:59:59.999Z`));
  if (filters.categoryId) q.where('c.category_id', filters.categoryId);
  if (filters.wardId) q.where('c.ward_id', filters.wardId);
  if (filters.officerId) q.where('c.assigned_officer_id', filters.officerId);
  if (filters.status && filters.status !== 'all') q.where('c.status', filters.status);
  if (filters.priority && filters.priority !== 'all') q.where('c.priority', filters.priority);
  return q;
};

const labelFor = (filters, key, value) => value ?? filters[`${key}Label`] ?? 'All';

export const buildReport = async (user, filters = {}) => {
  const rows = await buildQuery(user, filters).orderBy('c.complaint_date', 'desc').limit(5000).select(
    'c.id',
    'c.complaint_id',
    'c.citizen_name',
    'c.ration_number',
    'c.mobile_number',
    'c.location',
    'c.ward_id',
    'c.street_name',
    'c.priority',
    'c.status',
    'c.complaint_date',
    'c.resolution_date',
    'c.description',
    'cat.name as category_name',
    'w.name as ward_name',
    'o.name as officer_name',
  );

  const categoryNames = await db('categories').orderBy('sort_order').select('id', 'name');
  const wardNames = await db('wards').orderBy('code').select('id', 'name', 'code');
  const officers = await db('users').where({ role: ROLES.OFFICER }).select('id', 'name');

  const total = rows.length;
  const counts = { pending: 0, in_progress: 0, resolved: 0, rejected: 0 };
  const priorityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const categoryCounts = new Map();
  const wardCounts = new Map();
  const officerCounts = new Map();
  let resolutionDays = 0;
  let resolvedCount = 0;

  rows.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
    priorityCounts[r.priority] = (priorityCounts[r.priority] || 0) + 1;
    categoryCounts.set(r.category_name ?? 'Uncategorised', (categoryCounts.get(r.category_name ?? 'Uncategorised') || 0) + 1);
    wardCounts.set(r.ward_name ?? 'Unassigned', (wardCounts.get(r.ward_name ?? 'Unassigned') || 0) + 1);
    if (r.officer_name) officerCounts.set(r.officer_name, (officerCounts.get(r.officer_name) || 0) + 1);
    if (r.status === 'resolved' && r.resolution_date) {
      const diff = (new Date(asIso(r.resolution_date)) - new Date(asIso(r.complaint_date))) / 86400000;
      if (Number.isFinite(diff) && diff >= 0) {
        resolutionDays += diff;
        resolvedCount += 1;
      }
    }
  });

  const round = (value) => Number(value.toFixed(1));

  return {
    meta: {
      organisation: config.branding.org,
      title: 'Village Complaint Management Report',
      subtitle: config.branding.tagline,
      generatedAt: new Date().toISOString(),
      generatedBy: user.name,
      generatedByRole: user.role,
      disclaimer:
        'This report is generated from the Village Complaint Management System portal and is intended for internal administrative review.',
    },
    filters: {
      from: filters.from ?? null,
      to: filters.to ?? null,
      status: labelFor(filters, 'status', filters.status === 'all' ? null : filters.status ? STATUS_LABELS[filters.status] : null) ?? 'All',
      priority: labelFor(filters, 'priority', filters.priority === 'all' ? null : filters.priority ? PRIORITY_LABELS[filters.priority] : null) ?? 'All',
      category:
        filters.categoryId ? categoryNames.find((c) => c.id === Number(filters.categoryId))?.name ?? 'All' : 'All',
      ward: filters.wardId ? wardNames.find((w) => w.id === Number(filters.wardId))?.name ?? 'All' : 'All',
      officer: filters.officerId ? officers.find((o) => o.id === Number(filters.officerId))?.name ?? 'All' : 'All',
    },
    summary: {
      total,
      pending: counts.pending,
      inProgress: counts.in_progress,
      resolved: counts.resolved,
      rejected: counts.rejected,
      resolutionRate: total ? round((counts.resolved / total) * 100) : 0,
      pendingRate: total ? round((counts.pending / total) * 100) : 0,
      rejectionRate: total ? round((counts.rejected / total) * 100) : 0,
      averageResolutionDays: resolvedCount ? round(resolutionDays / resolvedCount) : 0,
      byPriority: priorityCounts,
      byCategory: [...categoryCounts.entries()].map(([name, count]) => ({ name, count, percentage: total ? round((count / total) * 100) : 0 })).sort((a, b) => b.count - a.count),
      byWard: [...wardCounts.entries()].map(([name, count]) => ({ name, count, percentage: total ? round((count / total) * 100) : 0 })).sort((a, b) => b.count - a.count),
      byOfficer: [...officerCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      statusBreakdown: Object.entries(counts).map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status],
        count,
        percentage: total ? round((count / total) * 100) : 0,
      })),
    },
    complaints: rows.map((r) => ({
      id: r.id,
      complaintId: r.complaint_id,
      citizenName: r.citizen_name,
      rationNumber: r.ration_number,
      mobileNumber: r.mobile_number,
      category: r.category_name,
      ward: r.ward_name,
      location: r.location,
      street: r.street_name,
      priority: r.priority,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status],
      officer: r.officer_name,
      complaintDate: asIso(r.complaint_date),
      resolutionDate: asIso(r.resolution_date),
      description: r.description,
    })),
    reference: {
      categories: categoryNames,
      wards: wardNames,
      officers,
    },
  };
};

/** Simple horizontal bar chart drawn with vector rectangles. */
const drawBarChart = (doc, { x, y, width, title, data, colour = NAVY }) => {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(title, x, y);
  let cursor = y + 16;
  const max = Math.max(1, ...data.map((d) => d.count));
  data.slice(0, 8).forEach((d) => {
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(String(d.name).slice(0, 26), x, cursor, { width: 120 });
    const barWidth = Math.max(2, (Number(d.count) / max) * (width - 190));
    doc.rect(x + 126, cursor + 1, barWidth, 8).fill(colour);
    doc.font('Helvetica').fontSize(8).fillColor(GREY).text(String(d.count), x + 126 + barWidth + 6, cursor);
    cursor += 14;
  });
  return cursor;
};

/** Renders the report as a PDF and streams it to the response. */
export const streamPdf = (report, res, { filename = null } = {}) => {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, info: { Title: report.meta.title, Author: report.meta.organisation, Subject: report.meta.subtitle } });

  const safeName = filename || `VCMS-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  doc.pipe(res);

  // ── Government style header ────────────────────────────────────────────
  doc.rect(0, 0, PAGE.width, 74).fill(NAVY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(report.meta.organisation, PAGE.margin, 18, { width: PAGE.contentWidth });
  doc.font('Helvetica').fontSize(9.5).text(report.meta.subtitle, PAGE.margin, 38, { width: PAGE.contentWidth });
  doc.fontSize(8).fillColor('#c7d2fe').text('Digital Grievance Redressal Portal — Unofficial demonstration build', PAGE.margin, 54, { width: PAGE.contentWidth });

  doc.moveDown(3);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(15).text(report.meta.title, PAGE.margin, 92);
  doc.font('Helvetica').fontSize(8.5).fillColor(GREY);
  doc.text(`Generated on: ${new Date(report.meta.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, PAGE.margin, 114);
  doc.text(`Generated by: ${report.meta.generatedBy} (${report.meta.generatedByRole})`, PAGE.margin, 126);
  doc.text(
    `Filters — From: ${report.filters.from ?? 'Any'}  To: ${report.filters.to ?? 'Any'}  Status: ${report.filters.status}  Priority: ${report.filters.priority}`,
    PAGE.margin,
    138,
    { width: PAGE.contentWidth },
  );
  doc.text(`Category: ${report.filters.category}   Ward: ${report.filters.ward}   Officer: ${report.filters.officer}`, PAGE.margin, 150, {
    width: PAGE.contentWidth,
  });

  doc.moveTo(PAGE.margin, 168).lineTo(PAGE.margin + PAGE.contentWidth, 168).strokeColor(LIGHT).stroke();

  // ── Summary statistics ─────────────────────────────────────────────────
  let y = 180;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Summary Statistics', PAGE.margin, y);
  y += 16;

  const stats = [
    ['Total complaints', report.summary.total],
    ['Pending', report.summary.pending],
    ['In progress', report.summary.inProgress],
    ['Resolved', report.summary.resolved],
    ['Rejected', report.summary.rejected],
    ['Resolution rate', `${report.summary.resolutionRate}%`],
    ['Average resolution time', `${report.summary.averageResolutionDays} days`],
    ['Rejection rate', `${report.summary.rejectionRate}%`],
  ];

  const colWidth = PAGE.contentWidth / 4;
  stats.forEach((stat, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const bx = PAGE.margin + col * colWidth;
    const by = y + row * 42;
    doc.roundedRect(bx + 2, by, colWidth - 6, 34, 4).fillAndStroke('#f8fafc', LIGHT);
    doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text(String(stat[0]).toUpperCase(), bx + 8, by + 6, { width: colWidth - 20 });
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(String(stat[1]), bx + 8, by + 17, { width: colWidth - 20 });
  });
  y += Math.ceil(stats.length / 4) * 42 + 8;

  // ── Charts ─────────────────────────────────────────────────────────────
  const half = PAGE.contentWidth / 2;
  const leftEnd = drawBarChart(doc, {
    x: PAGE.margin,
    y,
    width: half - 12,
    title: 'Complaints by category',
    data: report.summary.byCategory,
    colour: '#2563eb',
  });
  const rightEnd = drawBarChart(doc, {
    x: PAGE.margin + half + 12,
    y,
    width: half - 12,
    title: 'Complaints by ward',
    data: report.summary.byWard,
    colour: '#0f766e',
  });
  y = Math.max(leftEnd, rightEnd) + 12;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Status distribution', PAGE.margin, y);
  y += 14;
  const totalForBars = Math.max(1, report.summary.total);
  const barColours = { resolved: '#15803d', pending: '#d97706', in_progress: '#0284c7', rejected: '#b91c1c' };
  report.summary.statusBreakdown.forEach((entry) => {
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(entry.label, PAGE.margin, y, { width: 80 });
    const barWidth = Math.max(2, (entry.count / totalForBars) * (PAGE.contentWidth - 160));
    doc.rect(PAGE.margin + 84, y + 1, barWidth, 8).fill(barColours[entry.status] || GREY);
    doc.fillColor(GREY).text(`${entry.count} (${entry.percentage}%)`, PAGE.margin + 90 + barWidth, y);
    y += 14;
  });

  // ── Complaint table ────────────────────────────────────────────────────
  doc.addPage();
  let ty = PAGE.margin;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Complaint register', PAGE.margin, ty);
  ty += 18;

  const columns = [
    { key: 'complaintId', label: 'Complaint ID', width: 92 },
    { key: 'citizenName', label: 'Citizen', width: 88 },
    { key: 'category', label: 'Category', width: 96 },
    { key: 'location', label: 'Location', width: 100 },
    { key: 'priority', label: 'Priority', width: 45 },
    { key: 'statusLabel', label: 'Status', width: 60 },
    { key: 'complaintDate', label: 'Date', width: 52 },
  ];

  const drawTableHeader = () => {
    doc.rect(PAGE.margin, ty, PAGE.contentWidth, 16).fill('#eff6ff');
    let x = PAGE.margin + 4;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY);
    columns.forEach((col) => {
      doc.text(col.label, x, ty + 5, { width: col.width - 6 });
      x += col.width;
    });
    ty += 18;
  };

  drawTableHeader();
  doc.font('Helvetica').fontSize(7.5);
  report.complaints.forEach((row, index) => {
    if (ty > PAGE.height - 70) {
      doc.addPage();
      ty = PAGE.margin;
      drawTableHeader();
      doc.font('Helvetica').fontSize(7.5);
    }
    if (index % 2 === 1) doc.rect(PAGE.margin, ty - 3, PAGE.contentWidth, 15).fill('#f8fafc');
    let x = PAGE.margin + 4;
    doc.fillColor('#0f172a');
    columns.forEach((col) => {
      const value =
        col.key === 'complaintDate'
          ? String(row[col.key] ?? '').slice(0, 10)
          : col.key === 'priority'
            ? PRIORITY_LABELS[row.priority] || row.priority
            : String(row[col.key] ?? '—');
      doc.text(value, x, ty, { width: col.width - 6, lineBreak: false, ellipsis: true });
      x += col.width;
    });
    ty += 15;
  });

  if (!report.complaints.length) {
    doc.fillColor(GREY).text('No complaints matched the selected filters.', PAGE.margin, ty);
    ty += 20;
  }

  // ── Resolution statistics ──────────────────────────────────────────────
  if (ty > PAGE.height - 150) {
    doc.addPage();
    ty = PAGE.margin;
  }
  ty += 10;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Resolution statistics', PAGE.margin, ty);
  ty += 16;
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
  const resolutionLines = [
    `Resolved complaints: ${report.summary.resolved} of ${report.summary.total} (${report.summary.resolutionRate}%)`,
    `Average resolution time: ${report.summary.averageResolutionDays} day(s)`,
    `Pending complaints: ${report.summary.pending} (${report.summary.pendingRate}%)`,
    `Rejected complaints: ${report.summary.rejected} (${report.summary.rejectionRate}%)`,
    `Highest complaint ward: ${report.summary.byWard[0]?.name ?? '—'} (${report.summary.byWard[0]?.count ?? 0})`,
    `Most common category: ${report.summary.byCategory[0]?.name ?? '—'} (${report.summary.byCategory[0]?.count ?? 0})`,
  ];
  resolutionLines.forEach((line) => {
    doc.text(`• ${line}`, PAGE.margin, ty);
    ty += 13;
  });

  if (report.summary.byOfficer.length) {
    ty += 6;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Officer-wise distribution', PAGE.margin, ty);
    ty += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
    report.summary.byOfficer.slice(0, 12).forEach((entry) => {
      doc.text(`• ${entry.name}: ${entry.count} complaint(s)`, PAGE.margin, ty);
      ty += 12;
    });
  }

  // ── Footer on every page ───────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7).fillColor(GREY);
    doc.text(report.meta.disclaimer, PAGE.margin, PAGE.height - 52, { width: PAGE.contentWidth - 60 });
    doc.text(`Page ${i + 1} of ${range.count}`, PAGE.width - PAGE.margin - 60, PAGE.height - 34, { width: 60, align: 'right' });
  }

  doc.end();
  return doc;
};

export default { buildReport, streamPdf };
