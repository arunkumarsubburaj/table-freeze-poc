/**
 * DOM Helper Utilities
 * @module utils/dom-helpers
 */

/**
 * Get sticky offset from configured element
 * @param {string} offsetSelector - CSS selector for offset element
 * @returns {number} - Height of offset element in pixels
 */
export function getStickyOffset(offsetSelector) {
  try {
    if (offsetSelector) {
      const el = document.querySelector(offsetSelector);
      if (el) {
        const height = el.offsetHeight || 0;
        return Math.max(0, height);
      }
    }
  } catch (error) {
    console.error("DOM Helper: Error getting sticky offset", error);
  }
  return 0;
}

/**
 * Get header rows from table (either from thead or first rows in tbody with th tags)
 * @param {HTMLTableElement} table - Table element
 * @returns {HTMLTableRowElement[]} - Array of header rows
 */
export function getHeaderRows(table) {
  try {
    if (table.tHead) {
      return Array.from(table.tHead.rows);
    }
    
    // If no thead, check tbody for header rows (rows with th tags)
    const tbody = table.tBodies[0];
    if (!tbody) return [];
    
    const headerRows = [];
    for (const row of tbody.rows) {
      // Check if this row has any th elements
      const hasThElements = Array.from(row.cells).some(cell => cell.tagName === 'TH');
      if (hasThElements) {
        headerRows.push(row);
      } else {
        // Stop at first non-header row
        break;
      }
    }
    return headerRows;
  } catch (error) {
    console.error("DOM Helper: Error getting header rows", error);
    return [];
  }
}

/**
 * Get freeze count from table attribute
 * @param {HTMLTableElement} table - Table element
 * @param {string} attrName - Attribute name (data-col-freeze or data-row-freeze)
 * @returns {number} - Freeze count
 */
export function getFreezeCount(table, attrName) {
  try {
    const raw = table.getAttribute(attrName);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch (error) {
    console.error(`DOM Helper: Error getting freeze count for ${attrName}`, error);
    return 0;
  }
}

/**
 * Clear all freeze-related styles from a table
 * @param {HTMLTableElement} table - Table element
 */
export function clearFreezeStyles(table) {
  try {
    // Clear all cells with freeze-related classes or inline styles
    table
      .querySelectorAll(
        ".freeze-col, .freeze-row, .freeze-both, .freeze-boundary-col, .freeze-boundary-row"
      )
      .forEach((cell) => {
        cell.classList.remove(
          "freeze-col",
          "freeze-row",
          "freeze-both",
          "freeze-boundary-col",
          "freeze-boundary-row"
        );
        // Clear inline styles related to freezing
        cell.style.position = "";
        cell.style.left = "";
        cell.style.top = "";
      });
    
    // Remove CSS variable from table
    table.style.removeProperty('--freeze-bg-color');
  } catch (error) {
    console.error("DOM Helper: Error clearing freeze styles", error);
  }
}

/**
 * Validate table is valid and in DOM
 * @param {HTMLTableElement} table - Table element
 * @returns {boolean} - True if table is valid
 */
export function isValidTable(table) {
  return !!(table && table.classList && document.contains(table));
}
