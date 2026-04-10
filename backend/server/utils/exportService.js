// backend/server/utils/exportService.js

/**
 * Export Service - Comprehensive data export utilities
 * Supports CSV and Excel (XLSX) formats with proper formatting
 */

const XLSX = require('xlsx');

/**
 * Convert array of objects to CSV string
 * @param {Array} data - Array of objects to export
 * @returns {string} CSV formatted string
 */
function jsonToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  const keys = Object.keys(data[0]);

  // Build header
  const header = keys
    .map(key => escapeCSV(String(key)))
    .join(',');

  // Build rows
  const rows = data.map(obj =>
    keys
      .map(key => {
        const value = obj[key] ?? '';
        return escapeCSV(String(value));
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Escape CSV field
 */
function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate Excel workbook with proper formatting
 * @param {Array} data - Array of objects to export
 * @param {string} sheetName - Name of worksheet
 * @returns {Buffer} Excel file buffer
 */
function generateExcel(data, sheetName = 'Report') {
  const workbook = XLSX.utils.book_new();

  if (!Array.isArray(data) || data.length === 0) {
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data, { 
    defval: '',
    blankrows: false 
  });

  // Calculate optimal column widths
  const cols = Object.keys(data[0]);
  const colWidths = cols.map(col => {
    let maxLen = col.length;
    for (const row of data) {
      const cellValue = String(row[col] ?? '');
      maxLen = Math.max(maxLen, cellValue.length);
    }
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  // Style header row
  const headerStyle = {
    fill: { fgColor: { rgb: 'FF4472C4' } },
    font: { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } },
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
    }
  };

  // Apply header styles
  for (let i = 0; i < cols.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = headerStyle;
  }

  // Style data rows
  const dataStyle = {
    border: {
      top: { style: 'thin', color: { rgb: 'FFE7E6E6' } },
      bottom: { style: 'thin', color: { rgb: 'FFE7E6E6' } },
      left: { style: 'thin', color: { rgb: 'FFE7E6E6' } },
      right: { style: 'thin', color: { rgb: 'FFE7E6E6' } },
    },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  for (let r = 1; r < data.length + 1; r++) {
    // Alternate row colors
    const bgColor = r % 2 === 0 ? 'FFF2F2F2' : 'FFFFFFFF';
    
    for (let c = 0; c < cols.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].s = {
        ...dataStyle,
        fill: { fgColor: { rgb: bgColor } }
      };
    }
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, ws, sheetName.substring(0, 31));

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

/**
 * Format data for Reports
 * Returns clean, Excel-ready data with proper types and formatting
 */
const ReportFormatters = {
  /**
   * KPI Report - Key Performance Indicators
   */
  kpi: (kpiData) => {
    return [
      { Metric: 'Total Quotations', Value: Number(kpiData.total_quotations || 0) },
      { Metric: 'Deals Won', Value: Number(kpiData.won || 0) },
      { Metric: 'Deals Lost', Value: Number(kpiData.lost || 0) },
      { Metric: 'Pending Deals', Value: Number(kpiData.pending || 0) },
      { Metric: 'Win Rate (%)', Value: parseFloat(kpiData.win_rate || 0).toFixed(2) },
      { Metric: 'Total Revenue (₹)', Value: Number(parseFloat(kpiData.total_value || 0).toFixed(2)) },
      { Metric: 'Average Deal Size (₹)', Value: Number(parseFloat(kpiData.avg_deal_size || 0).toFixed(2)) },
    ];
  },

  /**
   * Sales Performance Report - Show sales by person with metrics
   */
  salesPerformance: (salesData) => {
    return salesData.map(row => ({
      'Salesperson Name': row.name || '—',
      'Total Quotations': Number(row.total_quotations || 0),
      'Deals Won': Number(row.won || 0),
      'Deals Lost': Number(row.lost || 0),
      'Win Rate (%)': parseFloat(row.win_rate || 0).toFixed(2),
      'Total Revenue (₹)': Number(parseFloat(row.revenue || 0).toFixed(2)),
    }));
  },

  /**
   * Customers Report - Customer analysis with revenue
   */
  customers: (customerData) => {
    return customerData.map(row => ({
      'Customer Name': row.company_name || '—',
      'Total Quotations': Number(row.quotations || 0),
      'Deals Won': Number(row.won || 0),
      'Total Revenue (₹)': Number(parseFloat(row.revenue || 0).toFixed(2)),
      'Last Deal Date': row.last_deal ? new Date(row.last_deal).toLocaleDateString('en-IN') : 'N/A',
    }));
  },

  /**
   * Products Report - Product performance metrics
   */
  products: (productData) => {
    const total = productData.reduce((sum, p) => sum + (parseFloat(p.revenue) || 0), 0);

    return productData.map(row => ({
      'Product Name': row.name || '—',
      'Quantity Sold': Number(row.quantity || 0),
      'Total Revenue (₹)': Number(parseFloat(row.revenue || 0).toFixed(2)),
      'Revenue Percentage (%)': total > 0 
        ? parseFloat(((parseFloat(row.revenue) || 0) / total * 100).toFixed(2))
        : 0,
    }));
  },

  /**
   * Pipeline Report - Sales pipeline by status
   */
  pipeline: (pipelineData) => {
    const total = pipelineData.reduce((sum, p) => sum + (Number(p.count) || 0), 0);

    return pipelineData.map(row => ({
      'Status': row.status || 'Unknown',
      'Deal Count': Number(row.count || 0),
      'Percentage (%)': total > 0 
        ? parseFloat(((Number(row.count) || 0) / total * 100).toFixed(2))
        : 0,
      'Pipeline Value (₹)': Number(parseFloat(row.value || 0).toFixed(2)),
    }));
  },

  /**
   * Audit Logs Report - Activity tracking
   */
  auditLogs: (auditData) => {
    return auditData.map(row => ({
      'Date & Time': row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—',
      'User': row.user_name || '—',
      'Module': row.module || '—',
      'Action': row.action || '—',
      'Entity Type': row.entity_type || '—',
      'Entity ID': row.entity_id || '—',
      'IP Address': row.ip_address || '—',
    }));
  },

  /**
   * Timeseries Report - Revenue trends over time
   */
  timeseries: (timeseriesData) => {
    return timeseriesData.map(row => ({
      'Period': row.period || '—',
      'Total Deals': Number(row.deals || 0),
      'Deals Won': Number(row.won || 0),
      'Revenue (₹)': Number(parseFloat(row.revenue || 0).toFixed(2)),
    }));
  },

  /**
   * User Metrics Report - Performance metrics by individual
   */
  userMetrics: (userData) => {
    return userData.map(row => ({
      'Salesperson': row.name || '—',
      'Total Quotations': Number(row.total_quotations || 0),
      'Won': Number(row.won || 0),
      'Lost': Number(row.lost || 0),
      'Conversion Rate (%)': parseFloat(row.conversion_rate || 0).toFixed(2),
      'Total Revenue (₹)': Number(parseFloat(row.total_revenue || 0).toFixed(2)),
      'Avg Deal Size (₹)': Number(parseFloat(row.avg_deal_size || 0).toFixed(2)),
    }));
  },
};

/**
 * Export service methods
 * Main interface for exporting data
 */
const ExportService = {
  /**
   * Export to CSV format
   * @param {Array} data - Array of objects
   * @returns {string} CSV string
   */
  toCSV: (data) => {
    return jsonToCSV(data);
  },

  /**
   * Export to Excel format (XLSX)
   * @param {Array} data - Array of objects
   * @param {string} sheetName - Name for the worksheet
   * @returns {Buffer} Excel file buffer
   */
  toExcel: (data, sheetName = 'Report') => {
    return generateExcel(data, sheetName);
  },

  /**
   * Formatters object - transform raw data for export
   */
  formatters: ReportFormatters,
};

module.exports = ExportService;
