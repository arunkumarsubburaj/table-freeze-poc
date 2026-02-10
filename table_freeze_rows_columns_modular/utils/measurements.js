/**
 * Measurement Utilities for Table Dimensions
 * @module utils/measurements
 */

/**
 * Measure column widths from first row
 * @param {HTMLTableElement} table - Table element
 * @returns {number[]} - Array of column widths
 */
export function measureColumnWidths(table) {
  try {
    const firstRow = table.querySelector("thead tr") || table.querySelector("tbody tr");
    if (!firstRow || !firstRow.children || firstRow.children.length === 0) return [];
    return Array.from(firstRow.children).map((cell) => {
      if (!cell) return 0;
      const rect = cell.getBoundingClientRect();
      return Math.max(0, rect.width || 0);
    });
  } catch (error) {
    console.error("Measurement: Error measuring column widths", error);
    return [];
  }
}

/**
 * Measure header row heights
 * @param {HTMLTableSectionElement} thead - Table head element
 * @returns {number[]} - Array of row heights
 */
export function measureHeaderRowHeights(thead) {
  try {
    if (!thead) return [];
    return Array.from(thead.rows).map((row) => {
      const rect = row.getBoundingClientRect();
      return Math.max(0, rect.height);
    });
  } catch (error) {
    console.error("Measurement: Error measuring header row heights", error);
    return [];
  }
}

/**
 * Measure body row heights
 * @param {HTMLTableSectionElement} tbody - Table body element
 * @param {number} rowCount - Number of rows to measure
 * @returns {number[]} - Array of row heights
 */
export function measureBodyRowHeights(tbody, rowCount) {
  try {
    if (!tbody || rowCount <= 0) return [];
    return Array.from(tbody.rows)
      .slice(0, rowCount)
      .map((row) => {
        const rect = row.getBoundingClientRect();
        return Math.max(0, rect.height);
      });
  } catch (error) {
    console.error("Measurement: Error measuring body row heights", error);
    return [];
  }
}
