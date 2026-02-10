/**
 * Colspan and Rowspan Helper Utilities
 * @module utils/span-helpers
 */

/**
 * Build a cell matrix that accounts for colspan and rowspan
 * This creates a 2D array where each position maps to the actual cell element
 * 
 * @param {HTMLTableElement} table - Table element
 * @returns {Object} - Object with matrix, maxRow, maxCol
 */
export function buildCellMatrix(table) {
  const matrix = [];
  const cellInfo = new Map(); // Store cell -> {row, col, rowspan, colspan}
  
  try {
    const rows = Array.from(table.rows);
    
    rows.forEach((row, rowIndex) => {
      if (!matrix[rowIndex]) {
        matrix[rowIndex] = [];
      }
      
      let colIndex = 0;
      Array.from(row.cells).forEach((cell) => {
        // Find next available column (skip cells occupied by rowspan from above)
        while (matrix[rowIndex][colIndex]) {
          colIndex++;
        }
        
        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        
        // Store cell info
        cellInfo.set(cell, {
          row: rowIndex,
          col: colIndex,
          rowspan,
          colspan
        });
        
        // Fill matrix positions occupied by this cell
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            const targetRow = rowIndex + r;
            const targetCol = colIndex + c;
            
            if (!matrix[targetRow]) {
              matrix[targetRow] = [];
            }
            matrix[targetRow][targetCol] = cell;
          }
        }
        
        colIndex += colspan;
      });
    });
    
    // Calculate dimensions
    const maxRow = matrix.length;
    const maxCol = Math.max(...matrix.map(row => row ? row.length : 0));
    
    return { matrix, cellInfo, maxRow, maxCol };
  } catch (error) {
    console.error("Span Helper: Error building cell matrix", error);
    return { matrix: [], cellInfo: new Map(), maxRow: 0, maxCol: 0 };
  }
}

/**
 * Get all cells that should be frozen for columns considering colspan
 * A cell is frozen if its starting column is within freeze range OR it spans into the freeze range
 * 
 * @param {Object} matrixData - Result from buildCellMatrix
 * @param {number} colFreeze - Number of columns to freeze
 * @returns {Set} - Set of cells that should have freeze-col class
 */
export function getCellsForColumnFreeze(matrixData, colFreeze) {
  const { matrix, cellInfo } = matrixData;
  const frozenCells = new Set();
  
  try {
    if (colFreeze <= 0) return frozenCells;
    
    cellInfo.forEach((info, cell) => {
      const { col, colspan } = info;
      const cellEndCol = col + colspan - 1;
      
      // Cell should be frozen if it starts before freeze boundary OR spans into it
      if (col < colFreeze || (col < colFreeze && cellEndCol >= colFreeze)) {
        frozenCells.add(cell);
      }
    });
  } catch (error) {
    console.error("Span Helper: Error getting column freeze cells", error);
  }
  
  return frozenCells;
}

/**
 * Get all cells that should be frozen for rows considering rowspan
 * For header rows: always freeze
 * For body rows: freeze if within rowFreeze count considering rowspan
 * 
 * @param {HTMLTableElement} table - Table element
 * @param {Object} matrixData - Result from buildCellMatrix
 * @param {number} rowFreeze - Number of body rows to freeze
 * @returns {Set} - Set of cells that should have freeze-row class
 */
export function getCellsForRowFreeze(table, matrixData, rowFreeze) {
  const { cellInfo } = matrixData;
  const frozenCells = new Set();
  
  try {
    const allRows = [];
    if (table.tHead) {
      allRows.push(...Array.from(table.tHead.rows));
    }
    const tbody = table.tBodies[0];
    if (tbody) {
      allRows.push(...Array.from(tbody.rows));
    }
    
    // Freeze first N rows (as specified by rowFreeze attribute)
    if (rowFreeze > 0 && allRows.length > 0) {
      for (let rowIndex = 0; rowIndex < Math.min(rowFreeze, allRows.length); rowIndex++) {
        const row = allRows[rowIndex];
        Array.from(row.cells).forEach(cell => {
          const info = cellInfo.get(cell);
          if (!info) return;
          
          const cellEndRow = rowIndex + info.rowspan - 1;
          
          // Freeze if cell starts within freeze zone OR spans into it
          if (rowIndex < rowFreeze || cellEndRow < rowFreeze) {
            frozenCells.add(cell);
          }
        });
      }
    }
  } catch (error) {
    console.error("Span Helper: Error getting row freeze cells", error);
  }
  
  return frozenCells;
}

/**
 * Get the last column index that should have boundary marker
 * Considers colspan - boundary is at the last column touched by freeze zone
 * 
 * @param {Object} matrixData - Result from buildCellMatrix
 * @param {number} colFreeze - Number of columns to freeze
 * @returns {number} - Column index for boundary (0-based)
 */
export function getColumnBoundaryIndex(matrixData, colFreeze) {
  const { cellInfo } = matrixData;
  let maxBoundaryCol = colFreeze - 1;
  
  try {
    if (colFreeze <= 0) return -1;
    
    cellInfo.forEach((info, cell) => {
      const { col, colspan } = info;
      
      // If cell starts in freeze zone, check its end position
      if (col < colFreeze) {
        const cellEndCol = col + colspan - 1;
        maxBoundaryCol = Math.max(maxBoundaryCol, Math.min(cellEndCol, colFreeze - 1));
      }
    });
  } catch (error) {
    console.error("Span Helper: Error getting column boundary", error);
  }
  
  return maxBoundaryCol;
}

/**
 * Get the last row index that should have boundary marker
 * Considers rowspan - boundary is at the last row touched by freeze zone
 * 
 * @param {HTMLTableElement} table - Table element
 * @param {Object} matrixData - Result from buildCellMatrix
 * @param {number} rowFreeze - Number of body rows to freeze
 * @returns {number} - Row index for boundary (0-based, relative to tbody)
 */
export function getRowBoundaryIndex(table, matrixData, rowFreeze) {
  const { cellInfo } = matrixData;
  let maxBoundaryRow = rowFreeze - 1;
  
  try {
    if (rowFreeze <= 0) return -1;
    
    const tbody = table.tBodies[0];
    if (!tbody) return -1;
    
    const bodyRows = Array.from(tbody.rows);
    
    bodyRows.forEach((row, rowIndex) => {
      Array.from(row.cells).forEach(cell => {
        const info = cellInfo.get(cell);
        if (!info) return;
        
        const tbodyRowIndex = rowIndex;
        
        // If cell starts in freeze zone, check its end position
        if (tbodyRowIndex < rowFreeze) {
          const cellEndRow = tbodyRowIndex + info.rowspan - 1;
          maxBoundaryRow = Math.max(maxBoundaryRow, Math.min(cellEndRow, rowFreeze - 1));
        }
      });
    });
  } catch (error) {
    console.error("Span Helper: Error getting row boundary", error);
  }
  
  return maxBoundaryRow;
}
