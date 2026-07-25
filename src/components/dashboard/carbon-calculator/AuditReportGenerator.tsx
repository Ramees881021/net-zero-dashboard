import * as XLSX from 'xlsx';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';
import type { ReportConfig } from './AuditReportConfigDialog';
import type { Scope1Entry } from './Scope1Form';
import type { Scope2Entry } from './Scope2Form';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

interface GenerateReportParams {
  config: ReportConfig;
  scope1Entries: Scope1Entry[];
  scope2Entries: Scope2Entry[];
  scope3Entries: Scope3Entry[];
  sites: Site[];
  scope1BySite: Record<string, Scope1Entry[]>;
  scope2BySite: Record<string, Scope2Entry[]>;
  companyName: string;
  auditLogs?: any[];
}

const BOUNDARY_LABELS: Record<string, string> = {
  operational_control: 'Operational Control',
  financial_control: 'Financial Control',
  equity_share: 'Equity Share',
};

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Unverified',
  self_declared: 'Self-Declared',
  third_party_limited: 'Third-Party Limited Assurance',
  third_party_reasonable: 'Third-Party Reasonable Assurance',
};

export const generateAuditReport = ({
  config,
  scope1Entries,
  scope2Entries,
  scope3Entries,
  sites,
  scope1BySite,
  scope2BySite,
  companyName,
  auditLogs = [],
}: GenerateReportParams) => {
  const wb = XLSX.utils.book_new();

  // 1. Cover Page
  const coverData = [
    ['ISO 14064-1 GHG Inventory Report'],
    [],
    ['Organisation', companyName],
    ['Reporting Year', config.reportingYear],
    ['Boundary Approach', BOUNDARY_LABELS[config.boundaryApproach] || config.boundaryApproach],
    ['Verification Status', VERIFICATION_LABELS[config.verificationStatus] || config.verificationStatus],
    ['Generated', new Date().toISOString().split('T')[0]],
    [],
    ['Total Scope 1 (tCO₂e)', scope1Entries.reduce((s, e) => s + e.tco2e, 0).toFixed(2)],
    ['Total Scope 2 (tCO₂e)', scope2Entries.reduce((s, e) => s + e.tco2e, 0).toFixed(2)],
    ['Total Scope 3 (tCO₂e)', scope3Entries.reduce((s, e) => s + e.tco2e, 0).toFixed(2)],
    ['Grand Total (tCO₂e)', (scope1Entries.reduce((s, e) => s + e.tco2e, 0) + scope2Entries.reduce((s, e) => s + e.tco2e, 0) + scope3Entries.reduce((s, e) => s + e.tco2e, 0)).toFixed(2)],
    [],
    ['Sites/Facilities', sites.length],
    ...sites.map(s => ['  ' + s.name, s.country || '']),
  ];
  const coverWs = XLSX.utils.aoa_to_sheet(coverData);
  coverWs['!cols'] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, coverWs, 'Cover');

  // 2. Scope 1 Detail
  const s1Headers = ['Site', 'Sub-Category', 'Type', 'Quantity', 'Unit', 'tCO₂e', 'Description'];
  const s1Rows = scope1Entries.map(e => {
    const site = sites.find(s => Object.entries(scope1BySite).find(([sId, entries]) => entries.includes(e) && s.id === sId));
    return [site?.name || 'Unknown', e.subCategory, e.type, e.quantity, e.unit, e.tco2e.toFixed(4), e.description];
  });
  const s1Ws = XLSX.utils.aoa_to_sheet([s1Headers, ...s1Rows]);
  s1Ws['!cols'] = s1Headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, s1Ws, 'Scope 1 Detail');

  // 3. Scope 2 Detail
  const s2Headers = ['Site', 'Sub-Category', 'Grid Region', 'Quantity (kWh)', 'Method', 'Renewable %', 'tCO₂e', 'Description'];
  const s2Rows = scope2Entries.map(e => {
    const site = sites.find(s => Object.entries(scope2BySite).find(([sId, entries]) => entries.includes(e) && s.id === sId));
    return [site?.name || 'Unknown', e.subCategory, e.gridRegion, e.quantity, e.method, e.renewablePercentage, e.tco2e.toFixed(4), e.description];
  });
  const s2Ws = XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
  s2Ws['!cols'] = s2Headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, s2Ws, 'Scope 2 Detail');

  // 4. Scope 3 Detail
  const s3Headers = ['Category', 'Type', 'Quantity', 'Unit', 'tCO₂e', 'Site', 'Description'];
  const s3Rows = scope3Entries.map(e => {
    const catLabel = SCOPE3_CATEGORIES.find(c => c.code === e.categoryCode)?.label || e.categoryCode;
    const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
    return [catLabel, e.type, e.quantity, e.unit, e.tco2e.toFixed(4), site?.name || 'Global', e.description];
  });
  const s3Ws = XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
  s3Ws['!cols'] = s3Headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, s3Ws, 'Scope 3 Detail');

  // 5. Scope 3 by Category Summary
  const s3SummaryHeaders = ['Category', 'Entries', 'tCO₂e', '% of Scope 3'];
  const s3Total = scope3Entries.reduce((s, e) => s + e.tco2e, 0);
  const s3SummaryRows = SCOPE3_CATEGORIES.map(cat => {
    const catEntries = scope3Entries.filter(e => e.categoryCode === cat.code);
    const catTotal = catEntries.reduce((s, e) => s + e.tco2e, 0);
    return [cat.label, catEntries.length, catTotal.toFixed(2), s3Total > 0 ? ((catTotal / s3Total) * 100).toFixed(1) + '%' : '0%'];
  }).filter(r => Number(r[1]) > 0);
  const s3SumWs = XLSX.utils.aoa_to_sheet([s3SummaryHeaders, ...s3SummaryRows]);
  s3SumWs['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s3SumWs, 'Scope 3 Summary');

  // 6. Exclusions & Justifications
  const exclData = [
    ['Exclusions & De Minimis Justifications'],
    [],
    [config.exclusionsLog || 'No exclusions documented.'],
    [],
    ['Methodology Notes'],
    [],
    [config.methodologyNotes || 'No methodology notes documented.'],
  ];
  const exclWs = XLSX.utils.aoa_to_sheet(exclData);
  exclWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, exclWs, 'Exclusions');

  // 7. Audit Trail Summary (recent)
  if (auditLogs.length > 0) {
    const atHeaders = ['Date', 'Action', 'Entry ID', 'Reason', 'Changes'];
    const atRows = auditLogs.slice(0, 100).map((log: any) => [
      new Date(log.created_at).toLocaleString(),
      log.action,
      log.entry_id?.slice(0, 8) || '',
      log.reason || '',
      log.action === 'update' ? JSON.stringify(log.new_values || {}).slice(0, 100) : '',
    ]);
    const atWs = XLSX.utils.aoa_to_sheet([atHeaders, ...atRows]);
    atWs['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, atWs, 'Audit Trail');
  }

  // Download
  const fileName = `ISO14064_Audit_Report_${companyName.replace(/\s+/g, '_')}_${config.reportingYear}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
