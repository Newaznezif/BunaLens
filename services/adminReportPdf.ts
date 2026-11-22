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

const reportTemplate = require('../components/admin/report-template.json') as { template: string };
const escape = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const dateText = (value: string) => new Date(value).toLocaleString();

function makeHtml(report: Report, admin: string) {
  const columns = report.rows.length ? Object.keys(report.rows[0]!).slice(0, 8) : [];
  const table = columns.length
    ? '<table><thead><tr>' + columns.map(column => '<th>' + escape(column.replaceAll('_', ' ')) + '</th>').join('') + '</tr></thead><tbody>' +
      report.rows.slice(0, 5000).map(row => '<tr>' + columns.map(column => '<td>' + escape(row[column]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
    : '<p>No matching records were found.</p>';
  const metrics = report.metrics.map(metric => '<div data-metric="1"><span>' + escape(metric.label) + '</span><strong>' + escape(metric.value) + '</strong></div>').join('');
  const notes = report.notes.map(note => '<li>' + escape(note) + '</li>').join('');
  let html = reportTemplate.template;
  const replacements: Record<string, string> = {
    TITLE: escape(report.title),
    PERIOD: escape(report.period),
    REFERENCE: escape(report.id),
    ADMIN: escape(admin),
    GENERATED: escape(dateText(report.generated)),
    METRICS: metrics,
    NOTES: notes,
    COUNT: report.count.toLocaleString(),
    TABLE: table,
    TRUNCATION: report.rows.length > 5000 ? '<p>Detail is limited to the first 5,000 rows; summary uses all ' + report.count.toLocaleString() + ' source records.</p>' : '',
  };
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll('__' + key + '__', value);
  return html;
}

export async function exportAdminReportPdf(report: Report, admin: string): Promise<'print' | 'share'> {
  const html = makeHtml(report, admin);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return 'print';
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'BunaLens ' + report.title });
    return 'share';
  }
  await Print.printAsync({ html });
  return 'print';
}
