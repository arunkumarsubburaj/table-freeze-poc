/**
 * TableFreezeController - Production-grade table freeze rows/columns controller
 * 
 * Features:
 * - Freeze arbitrary number of columns and rows
 * - Page-level sticky headers with configurable offset
 * - ResizeObserver for automatic layout updates
 * - IntersectionObserver for efficient viewport tracking
 * - Dynamic content support via MutationObserver
 * - Complete cleanup with destroy() method
 * - RAF debouncing for performance
 * - Error boundaries for robustness
 * 
 * @example
 * const controller = new TableFreezeController({
 *   offsetSelector: ".page-header"
 * });
 * controller.init();
 * // ... later
 * controller.destroy();
 * 
 * @typedef {Object} TableFreezeOptions
 * @property {string} [offsetSelector=""] - CSS selector for sticky offset element (e.g., fixed header)
 */
class TableFreezeController {
  /**
   * @param {TableFreezeOptions} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      offsetSelector: "",
      ...options,
    };
    this._refreshRaf = 0;
    this._scrollRaf = 0;
    this._onResize = this._onResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onIntersection = this._onIntersection.bind(this);
    this._resizeObserver = null;
    this._intersectionObserver = null;
    this._mutationObserver = null;
    this._isDestroyed = false;
    this._observedTables = new Map();
    this._tablesInStickyZone = new Set();
    this._mutationRaf = 0;
    this._scrollListenerAttached = false;
    this._isInitialized = false;
  }

  /**
   * Initialize the controller and start monitoring tables
   * @returns {boolean} - True if initialized successfully
   */
  init() {
    try {
      if (this._isDestroyed) {
        console.warn("TableFreezeController: Cannot reinitialize destroyed instance");
        return false;
      }

      if (this._isInitialized) {
        console.warn("TableFreezeController: Already initialized");
        return false;
      }

      // Validate offset selector if provided
      if (this.options.offsetSelector && typeof this.options.offsetSelector !== "string") {
        console.error("TableFreezeController: offsetSelector must be a string");
        return false;
      }

      // Check for tables but don't fail if none exist yet (might be added dynamically)
      const tables = document.querySelectorAll("table.freeze-table");
      if (tables.length === 0) {
        console.warn("TableFreezeController: No tables with class 'freeze-table' found. Will watch for dynamic additions.");
      } else {
        this.refresh();
      }

      window.addEventListener("resize", this._onResize);
      this._initResizeObserver();
      this._initIntersectionObserver();
      this._initMutationObserver();
      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error("TableFreezeController: Failed to initialize", error);
      return false;
    }
  }

  /**
   * Initialize ResizeObserver for automatic layout recalculation
   * @private
   */
  _initResizeObserver() {
    try {
      if (!window.ResizeObserver) return;

      this._resizeObserver = new ResizeObserver(() => {
        if (this._refreshRaf) return;
        this._refreshRaf = requestAnimationFrame(() => {
          this._refreshRaf = 0;
          try {
            this.applyAll();
          } catch (error) {
            console.error("TableFreezeController: Error in ResizeObserver", error);
          }
        });
      });

      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => {
        this._resizeObserver.observe(table);
        this._observedTables.set(table, true);
      });
    } catch (error) {
      console.error("TableFreezeController: Failed to initialize ResizeObserver", error);
    }
  }

  /**
   * Initialize IntersectionObserver for viewport-aware sticky positioning
   * @private
   */
  _initIntersectionObserver() {
    try {
      if (!window.IntersectionObserver) {
        console.warn("TableFreezeController: IntersectionObserver not supported, using scroll listener");
        this._attachScrollListener();
        return;
      }

      const stickyOffset = this.getStickyOffset();
      const rootMargin = `${-stickyOffset}px 0px ${stickyOffset}px 0px`;

      this._intersectionObserver = new IntersectionObserver(
        this._onIntersection,
        { rootMargin, threshold: 0 }
      );

      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => {
        this._intersectionObserver.observe(table);
      });
    } catch (error) {
      console.error("TableFreezeController: Failed to initialize IntersectionObserver", error);
      this._attachScrollListener();
    }
  }

  /**
   * Initialize MutationObserver for dynamic content changes
   * @private
   */
  _initMutationObserver() {
    try {
      if (!window.MutationObserver) return;

      this._mutationObserver = new MutationObserver((mutations) => {
        // Only refresh if new tables were added or removed
        let shouldRefresh = false;
        
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.matches && node.matches("table.freeze-table")) {
                shouldRefresh = true;
                break;
              }
              if (node.querySelector && node.querySelector("table.freeze-table")) {
                shouldRefresh = true;
                break;
              }
            }
          }
          for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) {
              if (node.matches && node.matches("table.freeze-table")) {
                shouldRefresh = true;
                break;
              }
            }
          }
          if (shouldRefresh) break;
        }

        if (shouldRefresh) {
          if (this._mutationRaf) return;
          this._mutationRaf = requestAnimationFrame(() => {
            this._mutationRaf = 0;
            try {
              this.applyAll();
              this._syncObservers();
            } catch (error) {
              console.error("TableFreezeController: Error in MutationObserver", error);
            }
          });
        }
      });

      this._mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    } catch (error) {
      console.error("TableFreezeController: Failed to initialize MutationObserver", error);
    }
  }

  /**
   * Sync ResizeObserver and IntersectionObserver with current tables
   * @private
   */
  _syncObservers() {
    try {
      const tables = document.querySelectorAll("table.freeze-table");
      
      // Add new tables to observers
      tables.forEach((table) => {
        if (!this._observedTables.has(table)) {
          if (this._resizeObserver) {
            this._resizeObserver.observe(table);
          }
          if (this._intersectionObserver) {
            this._intersectionObserver.observe(table);
          }
          this._observedTables.set(table, true);
        }
      });

      // Remove tables that no longer exist
      const currentTables = new Set(tables);
      this._observedTables.forEach((_, table) => {
        if (!currentTables.has(table)) {
          if (this._resizeObserver) {
            this._resizeObserver.unobserve(table);
          }
          if (this._intersectionObserver) {
            this._intersectionObserver.unobserve(table);
          }
          this._observedTables.delete(table);
          this._tablesInStickyZone.delete(table);
        }
      });
    } catch (error) {
      console.error("TableFreezeController: Error syncing observers", error);
    }
  }

  /**
   * Handle IntersectionObserver entries
   * @private
   */
  _onIntersection(entries) {
    entries.forEach((entry) => {
      const table = entry.target;
      
      // Validate table is still observed and in DOM
      if (!this._observedTables.has(table) || !document.contains(table)) {
        return;
      }
      
      if (entry.isIntersecting) {
        this._tablesInStickyZone.add(table);
      } else {
        this._tablesInStickyZone.delete(table);
      }
    });

    // Dynamically attach/detach scroll listener based on whether any tables are in sticky zone
    if (this._tablesInStickyZone.size > 0) {
      this._attachScrollListener();
      // Trigger immediate update when entering sticky zone
      this.handlePageScroll();
    } else {
      this._detachScrollListener();
    }
  }

  /**
   * Attach scroll listener if not already attached
   * @private
   */
  _attachScrollListener() {
    if (!this._scrollListenerAttached) {
      window.addEventListener("scroll", this._onScroll, { passive: true });
      this._scrollListenerAttached = true;
    }
  }

  /**
   * Detach scroll listener if attached
   * @private
   */
  _detachScrollListener() {
    if (this._scrollListenerAttached) {
      window.removeEventListener("scroll", this._onScroll);
      this._scrollListenerAttached = false;
      
      // Cancel any pending scroll RAF
      if (this._scrollRaf) {
        cancelAnimationFrame(this._scrollRaf);
        this._scrollRaf = 0;
      }
    }
  }

  /**
   * Refresh freeze styles on all tables
   * @public
   */
  refresh() {
    try {
      this.applyAll();
    } catch (error) {
      console.error("TableFreezeController: Error during refresh", error);
    }
  }

  /**
   * Get sticky offset from configured element
   * @returns {number} - Height of offset element in pixels
   */
  getStickyOffset() {
    try {
      if (this.options.offsetSelector) {
        const el = document.querySelector(this.options.offsetSelector);
        if (el) {
          const height = el.offsetHeight || 0;
          return Math.max(0, height);
        }
      }
    } catch (error) {
      console.error("TableFreezeController: Error getting sticky offset", error);
    }
    return 0;
  }

  /**
   * Get freeze count from table attribute
   * @private
   * @param {HTMLTableElement} table - Table element
   * @param {string} attrName - Attribute name (data-col-freeze or data-row-freeze)
   * @returns {number} - Freeze count
   */
  getFreezeCount(table, attrName) {
    try {
      const raw = table.getAttribute(attrName);
      if (!raw) return 0;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    } catch (error) {
      console.error(`TableFreezeController: Error getting freeze count for ${attrName}`, error);
      return 0;
    }
  }

  /**
   * Clear all freeze-related styles from a table
   * @private
   * @param {HTMLTableElement} table - Table element
   */
  clearFreezeStyles(table) {
    try {
      table
        .querySelectorAll(
          ".freeze-col, .freeze-row, .freeze-corner, .freeze-boundary-col, .freeze-boundary-row"
        )
        .forEach((cell) => {
          cell.classList.remove(
            "freeze-col",
            "freeze-row",
            "freeze-corner",
            "freeze-boundary-col",
            "freeze-boundary-row"
          );
          cell.style.left = "";
          cell.style.top = "";
        });
    } catch (error) {
      console.error("TableFreezeController: Error clearing freeze styles", error);
    }
  }

  /**
   * Measure column widths
   * @private
   * @param {HTMLTableElement} table - Table element
   * @returns {number[]} - Array of column widths
   */
  measureColumnWidths(table) {
    try {
      const firstRow = table.querySelector("thead tr") || table.querySelector("tbody tr");
      if (!firstRow || !firstRow.children || firstRow.children.length === 0) return [];
      return Array.from(firstRow.children).map((cell) => {
        if (!cell) return 0;
        const rect = cell.getBoundingClientRect();
        return Math.max(0, rect.width || 0);
      });
    } catch (error) {
      console.error("TableFreezeController: Error measuring column widths", error);
      return [];
    }
  }

  /**
   * Measure header row heights
   * @private
   * @param {HTMLTableSectionElement} thead - Table head element
   * @returns {number[]} - Array of row heights
   */
  measureHeaderRowHeights(thead) {
    try {
      if (!thead) return [];
      return Array.from(thead.rows).map((row) => {
        const rect = row.getBoundingClientRect();
        return Math.max(0, rect.height);
      });
    } catch (error) {
      console.error("TableFreezeController: Error measuring header row heights", error);
      return [];
    }
  }

  /**
   * Measure body row heights
   * @private
   * @param {HTMLTableSectionElement} tbody - Table body element
   * @param {number} rowCount - Number of rows to measure
   * @returns {number[]} - Array of row heights
   */
  measureBodyRowHeights(tbody, rowCount) {
    try {
      if (!tbody || rowCount <= 0) return [];
      return Array.from(tbody.rows)
        .slice(0, rowCount)
        .map((row) => {
          const rect = row.getBoundingClientRect();
          return Math.max(0, rect.height);
        });
    } catch (error) {
      console.error("TableFreezeController: Error measuring body row heights", error);
      return [];
    }
  }

  /**
   * Apply column freeze styles
   * @private
   * @param {HTMLTableElement} table - Table element
   * @param {number} colFreeze - Number of columns to freeze
   */
  applyColumnFreeze(table, colFreeze) {
    try {
      if (colFreeze <= 0) return;
      
      const widths = this.measureColumnWidths(table);
      if (widths.length === 0) {
        console.warn("TableFreezeController: No columns found to freeze");
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
      console.error("TableFreezeController: Error applying column freeze", error);
    }
  }

  /**
   * Apply row freeze styles
   * @private
   * @param {HTMLTableElement} table - Table element
   * @param {number} rowFreeze - Number of rows to freeze
   */
  applyRowFreeze(table, rowFreeze) {
    try {
      const thead = table.tHead;
      const tbody = table.tBodies[0];

      const headerHeights = this.measureHeaderRowHeights(thead);
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

      const bodyHeights = this.measureBodyRowHeights(tbody, rowFreeze);
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
      console.error("TableFreezeController: Error applying row freeze", error);
    }
  }

  /**
   * Apply corner priority for frozen intersections
   * @private
   * @param {HTMLTableElement} table - Table element
   * @param {number} colFreeze - Number of columns to freeze
   */
  applyCornerPriority(table, colFreeze) {
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
      console.error("TableFreezeController: Error applying corner priority", error);
    }
  }

  /**
   * Apply freeze styles to a single table
   * @private
   * @param {HTMLTableElement} table - Table element
   */
  applyFreezeToTable(table) {
    try {
      if (!table || !table.classList || !document.contains(table)) {
        console.warn("TableFreezeController: Invalid or detached table");
        return;
      }
      
      this.clearFreezeStyles(table);
      const colFreeze = this.getFreezeCount(table, "data-col-freeze");
      const rowFreeze = this.getFreezeCount(table, "data-row-freeze");

      table.dataset.colFreeze = colFreeze;
      table.dataset.rowFreeze = rowFreeze;

      this.applyRowFreeze(table, rowFreeze);
      this.applyColumnFreeze(table, colFreeze);
      this.applyCornerPriority(table, colFreeze);
    } catch (error) {
      console.error("TableFreezeController: Error applying freeze to table", error);
    }
  }

  /**
   * Apply freeze styles to all .freeze-table elements
   */
  applyAll() {
    try {
      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => this.applyFreezeToTable(table));
    } catch (error) {
      console.error("TableFreezeController: Error applying freeze to all tables", error);
    }
  }

  /**
   * Handle page scroll for sticky positioning
   */
  handlePageScroll() {
    try {
      // Only process tables that are in the sticky zone (performance optimization)
      const tables = this._tablesInStickyZone.size > 0
        ? Array.from(this._tablesInStickyZone)
        : document.querySelectorAll("table.freeze-table");
      
      const stickyOffset = this.getStickyOffset();

      tables.forEach((table) => {
        try {
          // Validate table is still in DOM
          if (!document.contains(table)) {
            this._tablesInStickyZone.delete(table);
            return;
          }

          const container = table.closest(".table-content");
          if (!container) return;

          const thead = table.tHead;
          const tbody = table.tBodies[0];
          if (!thead) return;

          const containerRect = container.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          const rowFreeze = this.getFreezeCount(table, "data-row-freeze");

          // Check if table is in sticky zone
          const isInStickyZone = containerRect.top <= stickyOffset && containerRect.bottom > stickyOffset;

          if (isInStickyZone) {
            // Dynamically update sticky positions
            const stickyTop = Math.max(0, stickyOffset - tableRect.top);
            const headerHeights = this.measureHeaderRowHeights(thead);
            let headerTopAcc = stickyTop;

            Array.from(thead.rows).forEach((row, rowIndex) => {
              Array.from(row.cells).forEach((cell) => {
                cell.style.top = `${headerTopAcc}px`;
              });
              headerTopAcc += headerHeights[rowIndex] || 0;
            });

            if (rowFreeze > 0 && tbody) {
              const bodyHeights = this.measureBodyRowHeights(tbody, rowFreeze);
              let bodyTopAcc = headerTopAcc;
              Array.from(tbody.rows)
                .slice(0, rowFreeze)
                .forEach((row, idx) => {
                  Array.from(row.cells).forEach((cell) => {
                    cell.style.top = `${bodyTopAcc}px`;
                  });
                  bodyTopAcc += bodyHeights[idx] || 0;
                });
            }
          } else {
            // Reset to static positions when outside sticky zone
            this.applyRowFreeze(table, rowFreeze);
          }
        } catch (error) {
          console.error("TableFreezeController: Error handling scroll for table", error);
        }
      });
    } catch (error) {
      console.error("TableFreezeController: Error during page scroll handling", error);
    }
  }

  /**
   * Handle window resize events
   * @private
   */
  _onResize() {
    if (this._refreshRaf) cancelAnimationFrame(this._refreshRaf);
    this._refreshRaf = requestAnimationFrame(() => {
      this._refreshRaf = 0;
      try {
        this.applyAll();
        this.handlePageScroll();
      } catch (error) {
        console.error("TableFreezeController: Error in resize handler", error);
      }
    });
  }

  /**
   * Handle window scroll events
   * @private
   */
  _onScroll() {
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = 0;
      try {
        this.handlePageScroll();
      } catch (error) {
        console.error("TableFreezeController: Error in scroll handler", error);
      }
    });
  }

  /**
   * Completely cleanup the controller and remove all listeners
   * Safe to call multiple times
   */
  destroy() {
    if (this._isDestroyed) return;

    this._isDestroyed = true;

    try {
      // Cancel all pending animation frames
      if (this._refreshRaf) {
        cancelAnimationFrame(this._refreshRaf);
        this._refreshRaf = 0;
      }

      if (this._scrollRaf) {
        cancelAnimationFrame(this._scrollRaf);
        this._scrollRaf = 0;
      }

      if (this._mutationRaf) {
        cancelAnimationFrame(this._mutationRaf);
        this._mutationRaf = 0;
      }

      // Remove event listeners
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("scroll", this._onScroll);
      this._scrollListenerAttached = false;

      // Disconnect and cleanup observers
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }

      if (this._intersectionObserver) {
        this._intersectionObserver.disconnect();
        this._intersectionObserver = null;
      }

      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
      }

      // Clear tracking collections
      this._observedTables.clear();
      this._tablesInStickyZone.clear();

      // Remove freeze styles from all tables
      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => this.clearFreezeStyles(table));

      // Reset initialization flag
      this._isInitialized = false;
    } catch (error) {
      console.error("TableFreezeController: Error during destroy", error);
    }
  }
}
