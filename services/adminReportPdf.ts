import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Report = {
  id: string;
  title: string;
  period: string;
  generated: string;
  rows: Record<string, unknown>[];
  metrics: { label: string; value: string }[];
  notes: string[];
  count: number;
};

const BRAND = '#26372d';
const GREEN = '#55765d';
const MUTED = '#727c70';
const LINE = '#e5e9e0';

const reportTemplate = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__ | BunaLens Report</title>
<style>
  @page { size: A4 portrait; margin: 17mm 15mm 19mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: __BRAND__; background: #fff; font: 10px/1.5 Arial, Helvetica, sans-serif; }
  .document { width: 100%; max-width: 100%; margin: 0 auto; }
  .masthead { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; padding: 0 0 13px; border-bottom: 3px solid __GREEN__; }
  .brand { font-size:25px; line-height:1; font-weight:800; letter-spacing:-1px; }
  .brand-sub { margin-top:6px; color:__MUTED__; font-size:8px; letter-spacing:1.25px; text-transform:uppercase; }
  .document-type { text-align:right; color:__GREEN__; font-size:9px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; }
  .eyebrow { margin:25px 0 6px; color:__GREEN__; font-size:8px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
  h1 { margin:0; font-size:25px; line-height:1.18; letter-spacing:-.5px; }
  .period { margin-top:8px; color:__MUTED__; font-size:11px; }
  .meta { display:grid; grid-template-columns:1.2fr 1fr 1.2fr; gap:12px; margin:19px 0 22px; padding:12px 13px; background:#f4f6f1; border:1px solid __LINE__; border-radius:5px; }
  .meta-label { display:block; margin-bottom:4px; color:__MUTED__; font-size:7px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; }
  .meta-value { display:block; color:__BRAND__; font-size:9px; font-weight:700; overflow-wrap:anywhere; }
  h2 { margin:22px 0 10px; padding-bottom:7px; border-bottom:1px solid __LINE__; font-size:12px; letter-spacing:.1px; }
  .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
  .metric { min-height:66px; padding:11px 10px; border:1px solid __LINE__; border-top:2px solid __GREEN__; border-radius:4px; background:#fbfcfa; break-inside:avoid; }
  .metric-label { display:block; color:__MUTED__; font-size:7px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; }
  .metric-value { display:block; margin-top:7px; color:__BRAND__; font-size:15px; font-weight:800; overflow-wrap:anywhere; }
  .notes { margin:10px 0 0; padding:0; list-style:none; }
  .notes li { position:relative; margin:6px 0; padding-left:13px; color:#586257; font-size:9px; }
  .notes li:before { position:absolute; left:0; color:__GREEN__; content:"•"; font-weight:800; }
  .table-wrap { width:100%; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:8px; }
  thead { display:table-header-group; }
  tfoot { display:table-footer-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th { padding:8px 7px; background:__BRAND__; color:#fff; text-align:left; font-size:7px; font-weight:700; letter-spacing:.45px; text-transform:uppercase; overflow-wrap:anywhere; }
  td { padding:7px; border-bottom:1px solid __LINE__; color:#39443a; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; }
  tbody tr:nth-child(even) td { background:#f7f9f5; }
  .empty { padding:18px; border:1px dashed __LINE__; color:__MUTED__; text-align:center; }
  .truncation { margin-top:10px; padding:9px 11px; background:#f4f6f1; color:__MUTED__; font-size:8px; }
  .endnote { margin-top:22px; padding-top:9px; border-top:1px solid __LINE__; color:__MUTED__; font-size:8px; }
  .page-footer { position:fixed; right:0; bottom:-12mm; left:0; display:flex; justify-content:space-between; gap:12px; padding-top:6px; border-top:1px solid __LINE__; color:#858d82; font-size:7px; }
  .page-footer span:last-child { text-align:right; }
  @media screen {
    body { background:#eef1ec; padding:24px; }
    .document { max-width:790px; min-height:1120px; padding:48px 54px; background:#fff; box-shadow:0 4px 24px rgba(25,40,28,.12); }
    .page-footer { position:static; margin-top:35px; }
  }
  @media print {
    body { background:#fff; }
    .document { max-width:none; min-height:0; padding:0; box-shadow:none; }
    h2 { break-after:avoid; page-break-after:avoid; }
    .metrics { break-inside:avoid; page-break-inside:avoid; }
  }
</style>
</head>
<body>
<main class="document">
  <header class="masthead">
    <div><div class="brand">BunaLens</div><div class="brand-sub">Coffee intelligence platform · Jimma, Ethiopia</div></div>
    <div class="document-type">Administrative report<br>Official system record</div>
  </header>
  <div class="eyebrow">Reporting &amp; analytics</div>
  <h1>__TITLE__</h1>
  <div class="period">Reporting period: __PERIOD__</div>
  <section class="meta" aria-label="Report metadata">
    <div><span class="meta-label">Report reference</span><span class="meta-value">__REFERENCE__</span></div>
    <div><span class="meta-label">Prepared by</span><span class="meta-value">__ADMIN__</span></div>
    <div><span class="meta-label">Generated</span><span class="meta-value">__GENERATED__</span></div>
  </section>
  <section>
    <h2>Executive summary</h2>
    <div class="metrics">__METRICS__</div>
    __NOTES__
  </section>
  <section>
    <h2>Detailed records <span style="color:__MUTED__;font-weight:400">(__COUNT__ records)</span></h2>
    <div class="table-wrap">__TABLE__</div>
    __TRUNCATION__
  </section>
  <div class="endnote">This document was generated by BunaLens from the records available to the authorized administrator at the time shown above. Figures reflect the selected filters and reporting period.</div>
  <footer class="page-footer"><span>CONFIDENTIAL · BunaLens administrative information</span><span>__REFERENCE__</span></footer>
</main>
</body>
</html>`;

const escape = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] || char));

const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escape(value) : escape(date.toLocaleString());
};

function makeHtml(report: Report, admin: string) {
  const columns = report.rows.length ? Object.keys(report.rows[0]!).slice(0, 8) : [];
  const table = columns.length
    ? '<table><thead><tr>' +
      columns.map(column => '<th>' + escape(column.replaceAll('_', ' ')) + '</th>').join('') +
      '</tr></thead><tbody>' +
      report.rows.slice(0, 5000).map(row =>
        '<tr>' + columns.map(column => '<td>' + escape(row[column]) + '</td>').join('') + '</tr>'
      ).join('') +
      '</tbody></table>'
    : '<div class="empty">No matching records were found for the selected period and filters.</div>';

  const metrics = report.metrics.map(metric =>
    '<div class="metric"><span class="metric-label">' + escape(metric.label) +
    '</span><strong class="metric-value">' + escape(metric.value) + '</strong></div>'
  ).join('');

  const notes = report.notes.length
    ? '<ul class="notes">' + report.notes.map(note => '<li>' + escape(note) + '</li>').join('') + '</ul>'
    : '';

  const replacements: Record<string, string> = {
    TITLE: escape(report.title),
    PERIOD: escape(report.period),
    REFERENCE: escape(report.id),
    ADMIN: escape(admin),
    GENERATED: dateText(report.generated),
    METRICS: metrics,
    NOTES: notes,
    COUNT: report.count.toLocaleString(),
    TABLE: table,
    TRUNCATION: report.rows.length > 5000
      ? '<div class="truncation">Detailed rows are limited to the first 5,000 records. Summary figures are calculated from all ' +
        report.count.toLocaleString() + ' source records.</div>'
      : '',
    BRAND,
    GREEN,
    MUTED,
    LINE,
  };

  let html = reportTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll('__' + key + '__', value);
  }
  return html;
}

/**
 * On web, print a dedicated document in a new window. Never call print on the
 * application window: that would capture the dashboard, navigation and sidebar.
 */
function printStandaloneHtml(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('The report window was blocked. Allow pop-ups for BunaLens and try exporting again.');
  }

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === 'complete') {
    window.setTimeout(triggerPrint, 250);
  } else {
    printWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 250), { once: true });
  }

  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
}

export async function exportAdminReportPdf(report: Report, admin: string): Promise<'print' | 'share'> {
  const html = makeHtml(report, admin);

  if (Platform.OS === 'web') {
    printStandaloneHtml(html);
    return 'print';
  }

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'BunaLens ' + report.title,
    });
    return 'share';
  }

  await Print.printAsync({ html });
  return 'print';
}
