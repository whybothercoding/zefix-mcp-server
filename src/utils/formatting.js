/**
 * @fileoverview Utility functions for formatting Swiss business data.
 * Handles UIDs, dates, addresses, and report generation.
 * 
 * @module utils/formatting
 */

/**
 * Format a UID in the standard Swiss format (CHE-XXX.XXX.XXX).
 * 
 * Converts various UID formats to the standardized Swiss format with
 * proper separators. Handles UIDs with or without existing formatting.
 * 
 * @param {string} uid - UID to format (e.g., "CHE123456789" or "CHE-123.456.789")
 * 
 * @returns {string|null} Formatted UID (CHE-XXX.XXX.XXX) or original if invalid format
 * 
 * @example
 * formatUid('CHE123456789');
 * // Returns: 'CHE-123.456.789'
 * 
 * @example
 * formatUid('CHE-123.456.789');
 * // Returns: 'CHE-123.456.789' (already formatted)
 * 
 * @example
 * formatUid('CHE 123 456 789');
 * // Returns: 'CHE-123.456.789'
 */
export function formatUid(uid) {
  if (!uid) return null;
  
  // Remove any existing formatting and convert to uppercase
  const cleaned = uid.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Extract parts
  const prefix = cleaned.substring(0, 3); // CHE
  const numbers = cleaned.substring(3);
  
  // Format as CHE-XXX.XXX.XXX
  if (numbers.length === 9) {
    return `${prefix}-${numbers.substring(0, 3)}.${numbers.substring(3, 6)}.${numbers.substring(6, 9)}`;
  }
  
  return uid; // Return original if format is unexpected
}

/**
 * Parse a UID to extract only the numeric part.
 * 
 * Removes all non-numeric characters from a UID, leaving only digits.
 * Useful for API calls that require numeric-only UIDs.
 * 
 * @param {string} uid - UID to parse (any format)
 * 
 * @returns {string|null} Numeric part only (e.g., "123456789") or null if invalid
 * 
 * @example
 * parseUid('CHE-123.456.789');
 * // Returns: '123456789'
 * 
 * @example
 * parseUid('CHE 123 456 789');
 * // Returns: '123456789'
 */
export function parseUid(uid) {
  if (!uid) return null;
  const cleaned = uid.replace(/[^0-9]/g, '');
  return cleaned;
}

/**
 * Format date to ISO 8601 (YYYY-MM-DD).
 * 
 * Converts various date formats to standardized ISO 8601 date format.
 * Handles Date objects, ISO strings, and other common date formats.
 * 
 * @param {Date|string} date - Date to format
 * 
 * @returns {string|null} ISO 8601 date (YYYY-MM-DD) or null if invalid
 * 
 * @example
 * formatDate(new Date('2024-01-15'));
 * // Returns: '2024-01-15'
 * 
 * @example
 * formatDate('2024-01-15T10:30:00Z');
 * // Returns: '2024-01-15'
 * 
 * @example
 * formatDate('2024-01-15');
 * // Returns: '2024-01-15' (already formatted)
 */
export function formatDate(date) {
  if (!date) return null;
  
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  // Handle various date formats
  if (typeof date === 'string') {
    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Try to parse and format
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return date;
}

/**
 * Format company data for consistent output structure.
 * 
 * Normalizes company data by ensuring consistent field formatting
 * and ordering. Primarily formats the UID field.
 * 
 * @param {Object} company - Raw company data
 * @param {string} company.uid - Company UID
 * @param {string} company.name - Company name
 * @param {string} company.legalForm - Legal form
 * @param {string} company.status - Company status
 * @param {Object} company.address - Address object
 * @param {string} company.canton - Canton code
 * 
 * @returns {Object} Formatted company data with standardized UID
 * 
 * @example
 * const formatted = formatCompanyData({
 *   uid: 'CHE123456789',
 *   name: 'Example AG',
 *   legalForm: 'AG',
 *   status: 'Active'
 * });
 * // Returns: { uid: 'CHE-123.456.789', name: 'Example AG', ... }
 */
export function formatCompanyData(company) {
  return {
    ...company,
    uid: formatUid(company.uid),
    name: company.name,
    legalForm: company.legalForm,
    status: company.status,
    address: company.address,
    canton: company.canton,
  };
}

/**
 * Create markdown formatted due diligence report.
 * 
 * Generates a comprehensive, human-readable due diligence report in
 * Markdown format. Includes:
 * - Basic company information
 * - Business classification (NOGA code, when the register holds one)
 * - Registered office address
 * - Commercial register details
 * - VAT information
 * - Recent SOGC publications
 * - Risk assessment
 * 
 * The report uses visual indicators:
 * - ✅ for positive/active status
 * - ⚠️ for warnings/concerns
 * - ❌ for critical issues
 * 
 * @param {Object} data - Company data for report
 * @param {string} data.uid - Company UID
 * @param {string} data.name - Company name
 * @param {Object} data.legalForm - Legal form details
 * @param {string} data.legalForm.name - Legal form name
 * @param {string} data.legalForm.shortName - Legal form abbreviation
 * @param {string} data.legalForm.code - Legal form code
 * @param {string} data.status - Company status
 * @param {Object} data.address - Address information
 * @param {string} data.canton - Canton code
 * @param {string} data.foundationDate - Foundation date
 * @param {string} data.nogaCode - NOGA economic activity code
 * @param {Object} data.vatInfo - VAT registration details
 * @param {Object} data.commercialRegister - Commercial register info
 * @param {Array<Object>} data.sogcPublications - Recent publications
 * 
 * @returns {string} Markdown formatted report
 * 
 * @example
 * const report = formatDueDiligenceReport({
 *   uid: 'CHE-123.456.789',
 *   name: 'Example AG',
 *   legalForm: { name: 'Aktiengesellschaft', shortName: 'AG', code: '0106' },
 *   status: 'Active',
 *   address: {
 *     street: 'Bahnhofstrasse',
 *     houseNumber: '1',
 *     swissZipCode: '8001',
 *     town: 'Zürich',
 *     canton: 'ZH'
 *   },
 *   vatInfo: { vatStatus: '2', vatNumber: 'CHE-123.456.789' },
 *   commercialRegister: { status: 'Active' },
 *   sogcPublications: []
 * });
 * 
 * // Returns formatted markdown report with sections for:
 * // - Basic Information
 * // - Business Classification
 * // - Registered Office
 * // - Commercial Register
 * // - VAT Information
 * // - Recent Publications
 * // - Risk Assessment
 * 
 * @see {@link module:tools/due-diligence~generateDueDiligenceReport}
 */
export function formatDueDiligenceReport(data) {
  const {
    uid,
    name,
    legalForm,
    status,
    address,
    canton,
    foundationDate,
    nogaCode,
    vatInfo,
    commercialRegister,
    sogcPublications,
  } = data;

  let report = `# Due Diligence Report: ${name || 'Unknown'}\n\n`;
  
  report += `## Basic Information\n`;
  report += `- **UID**: ${formatUid(uid) || 'N/A'}\n`;
  
  // Format legal form with name and short name
  if (legalForm && (legalForm.name || legalForm.shortName)) {
    const formName = legalForm.name || 'N/A';
    const formShort = legalForm.shortName || '';
    const formCode = legalForm.code || 'N/A';
    
    if (formShort && formShort !== formName) {
      report += `- **Legal Form**: ${formName} (${formShort}) - Code: ${formCode}\n`;
    } else {
      report += `- **Legal Form**: ${formName} - Code: ${formCode}\n`;
    }
  } else {
    report += `- **Legal Form**: N/A\n`;
  }
  
  report += `- **Status**: ${status || 'Unknown'}\n`;
  report += `- **Canton**: ${canton || 'N/A'}\n`;
  
  if (foundationDate) {
    report += `- **Founded**: ${formatDate(foundationDate)}\n`;
  }
  report += `\n`;

  if (nogaCode) {
    report += `## Business Classification\n`;
    report += `- **NOGA Code**: ${nogaCode}\n`;
    report += `\n`;
  }

  if (address) {
    report += `## Registered Office\n`;
    if (address.street) report += `${address.street}${address.houseNumber ? ' ' + address.houseNumber : ''}\n`;
    if (address.postOfficeBoxNumber) report += `P.O. Box ${address.postOfficeBoxNumber}\n`;
    
    const zipCode = address.swissZipCode || address.foreignZipCode || '';
    const town = address.town || '';
    if (zipCode || town) {
      report += `${zipCode} ${town}\n`.trim() + '\n';
    }
    
    if (address.canton) report += `Canton: ${address.canton}\n`;
    report += `\n`;
  }

  if (commercialRegister) {
    report += `## Commercial Register\n`;
    // The UID Webservice sends a code: 1=Inactive, 2=Active, 3=Deleted
    const crStatusLabels = { 1: 'Inactive', 2: 'Active', 3: 'Deleted' };
    const crStatus = crStatusLabels[commercialRegister.commercialRegisterStatus]
      || commercialRegister.status
      || 'N/A';
    report += `- **Status**: ${crStatus}\n`;
    if (commercialRegister.entryDate) {
      report += `- **Entry Date**: ${formatDate(commercialRegister.entryDate)}\n`;
    }
    if (commercialRegister.type) {
      report += `- **Type**: ${commercialRegister.type}\n`;
    }
    report += `\n`;
  }

  if (vatInfo) {
    report += `## VAT Information\n`;
    
    // Extract VAT number from uidVat object if present
    let vatNumber = 'N/A';
    if (vatInfo.uidVat) {
      const vatPrefix = vatInfo.uidVat.uidOrganisationIdCategorie || 'CHE';
      const vatId = vatInfo.uidVat.uidOrganisationId || '';
      if (vatId) {
        vatNumber = formatUid(`${vatPrefix}${vatId}`);
      }
    } else if (vatInfo.vatNumber) {
      vatNumber = formatUid(vatInfo.vatNumber);
    }
    
    report += `- **VAT Number**: ${vatNumber}\n`;
    
    // Map VAT status codes to readable status
    let vatStatus = 'N/A';
    let vatStatusForRisk = 'unknown'; // Track for risk assessment
    
    if (vatInfo.vatStatus) {
      const statusCode = String(vatInfo.vatStatus);
      switch (statusCode) {
        case '1': 
          vatStatus = 'Inactive'; 
          vatStatusForRisk = 'inactive';
          break;
        case '2': 
          vatStatus = 'Active'; 
          vatStatusForRisk = 'active';
          break;
        case '3': 
          vatStatus = 'Deleted'; 
          vatStatusForRisk = 'deleted';
          break;
        default: 
          vatStatus = `Unknown (${statusCode})`;
          vatStatusForRisk = 'unknown';
      }
    } else if (vatInfo.status) {
      vatStatus = vatInfo.status;
      vatStatusForRisk = String(vatInfo.status).toLowerCase();
    }
    
    report += `- **Status**: ${vatStatus}\n`;
    
    // Handle entry date
    const entryDate = vatInfo.vatEntryDate || vatInfo.entryDate;
    if (entryDate) {
      report += `- **Entry Date**: ${formatDate(entryDate)}\n`;
    }
    report += `\n`;
    
    // Store for risk assessment
    data._vatStatusForRisk = vatStatusForRisk;
  }

  if (sogcPublications && sogcPublications.length > 0) {
    report += `## Recent Publications (SOGC)\n`;
    sogcPublications.slice(0, 5).forEach(pub => {
      const pubDate = formatDate(pub.sogcDate || pub.date) || 'N/A';
      const pubType = pub.mutationTypes?.[0]?.key || pub.type || 'Update';
      
      // Truncate long messages
      report += `- **${pubDate}**: ${pubType}\n`;
    });
    report += `\n`;
  }

  report += `## Risk Assessment\n`;
  const risks = [];
  
  // Normalize status for comparison (case-insensitive)
  const normalizedStatus = (status || '').toLowerCase();
  
  if (normalizedStatus === 'active') {
    report += `✅ Active and in good standing\n`;
  } else if (normalizedStatus === 'unknown' || !status) {
    report += `⚠️ Status: Unknown\n`;
    risks.push('Status unknown');
  } else {
    report += `⚠️ Status: ${status}\n`;
    risks.push('Non-active status');
  }
  
  // Check VAT status using the stored value from above
  const vatStatusForRisk = data._vatStatusForRisk || 'unknown';
  if (vatStatusForRisk === 'active') {
    report += `✅ VAT registered and active\n`;
  } else if (vatStatusForRisk === 'inactive') {
    report += `⚠️ VAT registration inactive\n`;
    risks.push('VAT inactive');
  } else if (vatStatusForRisk === 'deleted') {
    report += `❌ VAT registration deleted\n`;
    risks.push('VAT deleted');
  }
  
  // Check commercial register status
  // commercialRegisterStatus: 1=Inactive, 2=Active, 3=Deleted
  let crStatusForRisk = 'unknown';
  if (commercialRegister?.commercialRegisterStatus) {
    const crCode = String(commercialRegister.commercialRegisterStatus);
    switch (crCode) {
      case '1': crStatusForRisk = 'inactive'; break;
      case '2': crStatusForRisk = 'active'; break;
      case '3': crStatusForRisk = 'deleted'; break;
    }
  } else if (commercialRegister?.status) {
    crStatusForRisk = String(commercialRegister.status).toLowerCase();
  }
  
  // Only show commercial register status if we have data
  if (crStatusForRisk === 'active') {
    report += `✅ Commercial register entry valid\n`;
  } else if (crStatusForRisk === 'inactive') {
    report += `⚠️ Commercial register inactive\n`;
    risks.push('Commercial register inactive');
  } else if (crStatusForRisk === 'deleted') {
    report += `❌ Commercial register deleted\n`;
    risks.push('Commercial register deleted');
  }

  if (risks.length === 0) {
    report += `\n**Overall**: Low risk\n`;
  } else {
    report += `\n**Risks Identified**: ${risks.join(', ')}\n`;
  }

  return report;
}
