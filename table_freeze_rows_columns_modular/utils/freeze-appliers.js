/**
 * Freeze Styling Appliers
 * @module utils/freeze-appliers
 */

import { measureColumnWidths, measureHeaderRowHeights, measureBodyRowHeights } from './measurements.js';

/**
 * Apply column freeze styles
 * @param {HTMLTableElement} table - Table element
 * @param {number} colFreeze - Number of columns to freeze
 */
export function applyColumnFreeze(table, colFreeze) {
  try {
    if (colFreeze <= 0) return;
    
    const widths = measureColumnWidths(table);
    if (widths.length === 0) {
      console.warn("Freeze Applier: No columns found to freeze");
      return;
    }

    const leftOffsets = [];
    let acc = 0;
    const actualColFreeze = Math.min(colFreeze, widths.length);
    for (let i = 0; i < actualColFreeze; i += 1) {
      leftOffsets[i] = acc;
      acc += widths[i] || 0;
    }

    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = Array.from(row.children);
      for (let col = 0; col < actualColFreeze && col < cells.length; col += 1) {
        const cell = cells[col];
        if (!cell) continue;
        cell.classList.add("freeze-col");
        cell.style.left = `${leftOffsets[col] || 0}px`;
        if (col === actualColFreeze - 1) {
          cell.classList.add("freeze-boundary-col");
        }
      }
    });
  } catch (error) {
    console.error("Freeze Applier: Error applying column freeze", error);
  }
}

/**
 * Apply row freeze styles
 * @param {HTMLTableElement} table - Table element
 * @param {number} rowFreeze - Number of rows to freeze
 */
export function applyRowFreeze(table, rowFreeze) {
  try {
    const thead = table.tHead;
    const tbody = table.tBodies[0];

    const headerHeights = measureHeaderRowHeights(thead);
    const headerTotal = headerHeights.reduce((sum, h) => sum + h, 0);

    if (thead) {
      let topAcc = 0;
      Array.from(thead.rows).forEach((row, rowIndex) => {
        if (!row || !row.cells) return;
        Array.from(row.cells).forEach((cell) => {
          if (!cell) return;
          cell.classList.add("freeze-row");
          cell.style.top = `${topAcc}px`;
        });
        topAcc += headerHeights[rowIndex] || 0;
      });
    }

    if (rowFreeze <= 0 || !tbody) return;

    const bodyHeights = measureBodyRowHeights(tbody, rowFreeze);
    let bodyTopAcc = headerTotal;

    Array.from(tbody.rows)
      .slice(0, rowFreeze)
      .forEach((row, rowIndex) => {
        if (!row || !row.cells) return;
        Array.from(row.cells).forEach((cell) => {
          if (!cell) return;
          cell.classList.add("freeze-row");
          cell.style.top = `${bodyTopAcc}px`;
          if (rowIndex === rowFreeze - 1) {
            cell.classList.add("freeze-boundary-row");
          }
        });
        bodyTopAcc += bodyHeights[rowIndex] || 0;
      });
  } catch (error) {
    console.error("Freeze Applier: Error applying row freeze", error);
  }
}

/**
 * Apply corner priority for frozen intersections
 * @param {HTMLTableElement} table - Table element
 * @param {number} colFreeze - Number of columns to freeze
 */
export function applyCornerPriority(table, colFreeze) {
  try {
    if (colFreeze <= 0) return;
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      if (!row || !row.children) return;
      const cells = Array.from(row.children);
      for (let col = 0; col < colFreeze && col < cells.length; col += 1) {
        const cell = cells[col];
        if (!cell) continue;
        if (cell.classList.contains("freeze-row")) {
          cell.classList.add("freeze-corner");
        }
      }
    });
  } catch (error) {
    console.error("Freeze Applier: Error applying corner priority", error);
  }
}
