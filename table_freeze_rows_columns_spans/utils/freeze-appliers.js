/**
 * Freeze Styling Appliers with Colspan/Rowspan Support
 * @module utils/freeze-appliers
 */

import { measureColumnWidths, measureBodyRowHeights } from './measurements.js';
import { 
  buildCellMatrix, 
  getCellsForColumnFreeze, 
  getCellsForRowFreeze,
  getColumnBoundaryIndex,
  getRowBoundaryIndex
} from './span-helpers.js';

/**
 * Apply column freeze styles with colspan support
 * @param {HTMLTableElement} table - Table element
 * @param {number} colFreeze - Number of columns to freeze
 */
export function applyColumnFreeze(table, colFreeze) {
  try {
    if (colFreeze <= 0) return;
    
    // Build cell matrix to handle colspan
    const matrixData = buildCellMatrix(table);
    if (matrixData.maxCol === 0) {
      console.warn("Freeze Applier: No columns found to freeze");
      return;
    }

    // Get column widths (accounting for visual layout)
    const widths = measureColumnWidths(table);
    if (widths.length === 0) return;

    // Calculate left offsets for each column
    const leftOffsets = [];
    let acc = 0;
    const actualColFreeze = Math.min(colFreeze, widths.length);
    for (let i = 0; i < actualColFreeze; i += 1) {
      leftOffsets[i] = acc;
      acc += widths[i] || 0;
    }

    // Get cells that should be frozen (considering colspan)
    const frozenCells = getCellsForColumnFreeze(matrixData, actualColFreeze);
    const boundaryCol = getColumnBoundaryIndex(matrixData, actualColFreeze);

    // Apply freeze styles to cells (inline)
    frozenCells.forEach((cell) => {
      const info = matrixData.cellInfo.get(cell);
      if (!info) return;
      
      // Apply sticky positioning inline (z-index and background-color handled by CSS)
      cell.style.position = "sticky";
      cell.style.left = `${leftOffsets[info.col] || 0}px`;
      
      // Add freeze-col class for CSS styling
      cell.classList.add("freeze-col");
      
      // Mark boundary cell (last column in freeze zone)
      const cellEndCol = info.col + info.colspan - 1;
      if (cellEndCol === boundaryCol || info.col === actualColFreeze - 1) {
        cell.classList.add("freeze-boundary-col");
      }
    });
  } catch (error) {
    console.error("Freeze Applier: Error applying column freeze", error);
  }
}

/**
 * Apply row freeze styles with rowspan support
 * @param {HTMLTableElement} table - Table element
 * @param {number} rowFreeze - Number of rows to freeze
 * @param {number} colFreeze - Number of columns to freeze (for corner detection)
 */
export function applyRowFreeze(table, rowFreeze, colFreeze = 0) {
  try {
    const tbody = table.tBodies[0];
    if (!tbody || rowFreeze <= 0) return;

    // Build cell matrix to handle rowspan
    const matrixData = buildCellMatrix(table);

    // Get all rows (from thead if exists, then tbody)
    const allRows = [];
    if (table.tHead) {
      allRows.push(...Array.from(table.tHead.rows));
    }
    allRows.push(...Array.from(tbody.rows));

    // Measure heights of all rows that will be frozen
    const frozenRowHeights = [];
    for (let i = 0; i < Math.min(rowFreeze, allRows.length); i++) {
      const rect = allRows[i].getBoundingClientRect();
      frozenRowHeights.push(Math.max(0, rect.height));
    }

    // Get cells that should be frozen (considering rowspan)
    const frozenCells = getCellsForRowFreeze(table, matrixData, rowFreeze);
    const boundaryRow = getRowBoundaryIndex(table, matrixData, rowFreeze);

    // Get column widths to calculate left positions for corner cells only
    const widths = measureColumnWidths(table);
    const leftOffsets = [];
    let leftAcc = 0;
    for (let i = 0; i < Math.min(colFreeze, widths.length); i += 1) {
      leftOffsets[i] = leftAcc;
      leftAcc += widths[i] || 0;
    }

    // Apply styles to frozen rows
    let topAcc = 0;
    for (let i = 0; i < Math.min(rowFreeze, allRows.length); i++) {
      const row = allRows[i];
      if (!row || !row.cells) continue;
      
      Array.from(row.cells).forEach((cell) => {
        if (!cell) return;
        if (frozenCells.has(cell)) {
          const info = matrixData.cellInfo.get(cell);
          
          // Apply sticky positioning inline (z-index and background-color handled by CSS)
          cell.style.position = "sticky";
          cell.style.top = `${topAcc}px`;
          
          // Add freeze-row class for CSS styling
          cell.classList.add("freeze-row");
          
          // Only apply left positioning to cells in frozen columns (corner cells)
          // This allows non-frozen column cells in frozen rows to scroll horizontally
          if (colFreeze > 0 && info && info.col < colFreeze && leftOffsets[info.col] !== undefined) {
            cell.style.left = `${leftOffsets[info.col]}px`;
          }
          
          // Mark boundary cell
          if (info) {
            const cellEndRow = i + info.rowspan - 1;
            if (cellEndRow === boundaryRow || i === rowFreeze - 1) {
              cell.classList.add("freeze-boundary-row");
            }
          }
        }
      });
      topAcc += frozenRowHeights[i] || 0;
    }
  } catch (error) {
    console.error("Freeze Applier: Error applying row freeze", error);
  }
}

/**
 * Apply corner priority for frozen intersections with span support
 * @param {HTMLTableElement} table - Table element
 * @param {number} colFreeze - Number of columns to freeze
 */
export function applyCornerPriority(table, colFreeze) {
  try {
    if (colFreeze <= 0) return;
    
    // Build cell matrix to properly identify corner cells with spans
    const matrixData = buildCellMatrix(table);
    const frozenColCells = getCellsForColumnFreeze(matrixData, colFreeze);
    
    // Mark cells that are both column and row frozen
    table.querySelectorAll('.freeze-col.freeze-row').forEach((cell) => {
      // Cell has both classes - replace with freeze-both only (highest priority)
      cell.classList.remove("freeze-col", "freeze-row");
      cell.classList.add("freeze-both");
    });
  } catch (error) {
    console.error("Freeze Applier: Error applying corner priority", error);
  }
}
