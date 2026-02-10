/**
 * TableFreezeController - Production-grade modular table freeze controller
 * 
 * @module table-freeze-controller
 * 
 * @example
 * import TableFreezeController from './table-freeze-controller.js';
 * 
 * const controller = new TableFreezeController({
 *   offsetSelector: ".page-header"
 * });
 * controller.init();
 * 
 * @typedef {Object} TableFreezeOptions
 * @property {string} [offsetSelector=""] - CSS selector for sticky offset element
 */

import { getStickyOffset, getFreezeCount, clearFreezeStyles, isValidTable } from './utils/dom-helpers.js';
import { measureBodyRowHeights } from './utils/measurements.js';
import { applyColumnFreeze, applyRowFreeze, applyCornerPriority } from './utils/freeze-appliers.js';
import { createResizeObserver, createIntersectionObserver, createMutationObserver, syncObservers } from './utils/observers.js';

export default class TableFreezeController {
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
    this._mutationRaf = 0;
    this._onResize = this._onResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onIntersection = this._onIntersection.bind(this);
    this._resizeObserver = null;
    this._intersectionObserver = null;
    this._mutationObserver = null;
    this._isDestroyed = false;
    this._observedTables = new Map();
    this._tablesInStickyZone = new Set();
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

      // Check for tables but don't fail if none exist yet
      const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
      if (tables.length === 0) {
        console.warn("TableFreezeController: No tables with class 'freeze-table' or 'editor360-table' found. Will watch for dynamic additions.");
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
      this._resizeObserver = createResizeObserver(() => {
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

      if (!this._resizeObserver) return;

      const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
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
      const stickyOffset = getStickyOffset(this.options.offsetSelector);
      
      this._intersectionObserver = createIntersectionObserver(
        this._onIntersection,
        stickyOffset
      );

      if (!this._intersectionObserver) {
        console.warn("TableFreezeController: IntersectionObserver not supported, using scroll listener");
        this._attachScrollListener();
        return;
      }

      const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
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
      this._mutationObserver = createMutationObserver(() => {
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
    syncObservers(
      this._observedTables,
      this._resizeObserver,
      this._intersectionObserver,
      this._tablesInStickyZone
    );
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

    // Dynamically attach/detach scroll listener based on tables in sticky zone
    if (this._tablesInStickyZone.size > 0) {
      this._attachScrollListener();
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
   * Apply freeze styles to a single table
   * @private
   * @param {HTMLTableElement} table - Table element
   */
  applyFreezeToTable(table) {
    try {
      if (!isValidTable(table)) {
        console.warn("TableFreezeController: Invalid or detached table");
        return;
      }
      
      clearFreezeStyles(table);
      const colFreeze = getFreezeCount(table, "data-col-freeze");
      const rowFreeze = getFreezeCount(table, "data-row-freeze");

      table.dataset.colFreeze = colFreeze;
      table.dataset.rowFreeze = rowFreeze;

      applyRowFreeze(table, rowFreeze, colFreeze);
      applyColumnFreeze(table, colFreeze);
      applyCornerPriority(table, colFreeze);
    } catch (error) {
      console.error("TableFreezeController: Error applying freeze to table", error);
    }
  }

  /**
   * Apply freeze styles to all .freeze-table and .editor360-table elements
   */
  applyAll() {
    try {
      const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
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
      const tables = this._tablesInStickyZone.size > 0
        ? Array.from(this._tablesInStickyZone)
        : document.querySelectorAll("table.freeze-table, table.editor360-table");
      
      const stickyOffset = getStickyOffset(this.options.offsetSelector);

      tables.forEach((table) => {
        try {
          if (!document.contains(table)) {
            this._tablesInStickyZone.delete(table);
            return;
          }

          const container = table.closest(".table-content, [data-type='table-content']");
          if (!container) return;

          const thead = table.tHead;
          const tbody = table.tBodies[0];
          
          // Only proceed if there's either thead or tbody
          if (!thead && !tbody) return;

          const containerRect = container.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          const rowFreeze = getFreezeCount(table, "data-row-freeze");

          const isInStickyZone = containerRect.top <= stickyOffset && containerRect.bottom > stickyOffset;

          if (isInStickyZone && rowFreeze > 0) {
            const stickyTop = Math.max(0, stickyOffset - tableRect.top);
            
            // Get all rows that should be frozen
            const allRows = [];
            if (thead) {
              allRows.push(...Array.from(thead.rows));
            }
            if (tbody) {
              allRows.push(...Array.from(tbody.rows).slice(0, rowFreeze));
            }

            let topAcc = stickyTop;
            for (let i = 0; i < allRows.length; i++) {
              const row = allRows[i];
              const rowHeight = row.getBoundingClientRect().height;
              Array.from(row.cells).forEach((cell) => {
                // Only update cells that have sticky positioning (frozen cells)
                if (cell.style.position === "sticky" && cell.style.top !== "") {
                  cell.style.top = `${topAcc}px`;
                }
              });
              topAcc += rowHeight;
            }
          } else {
            const colFreeze = getFreezeCount(table, "data-col-freeze");
            applyRowFreeze(table, rowFreeze, colFreeze);
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
      const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
      tables.forEach((table) => clearFreezeStyles(table));

      // Reset initialization flag
      this._isInitialized = false;
    } catch (error) {
      console.error("TableFreezeController: Error during destroy", error);
    }
  }
}
