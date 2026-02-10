/**
 * Observer Management Module
 * @module utils/observers
 */

/**
 * Create and manage ResizeObserver for table layout updates
 * @param {Function} callback - Callback function when resize detected
 * @param {number} rafId - RAF ID reference for debouncing
 * @returns {ResizeObserver|null} - ResizeObserver instance
 */
export function createResizeObserver(callback) {
  try {
    if (!window.ResizeObserver) return null;

    return new ResizeObserver(() => {
      callback();
    });
  } catch (error) {
    console.error("Observer: Failed to create ResizeObserver", error);
    return null;
  }
}

/**
 * Create IntersectionObserver for viewport tracking
 * @param {Function} callback - Callback for intersection changes
 * @param {number} rootMargin - Root margin offset
 * @returns {IntersectionObserver|null} - IntersectionObserver instance
 */
export function createIntersectionObserver(callback, rootMargin) {
  try {
    if (!window.IntersectionObserver) {
      console.warn("Observer: IntersectionObserver not supported");
      return null;
    }

    return new IntersectionObserver(callback, {
      rootMargin: `${-rootMargin}px 0px ${rootMargin}px 0px`,
      threshold: 0
    });
  } catch (error) {
    console.error("Observer: Failed to create IntersectionObserver", error);
    return null;
  }
}

/**
 * Create MutationObserver for dynamic content changes
 * @param {Function} callback - Callback for mutations
 * @returns {MutationObserver|null} - MutationObserver instance
 */
export function createMutationObserver(callback) {
  try {
    if (!window.MutationObserver) return null;

    const observer = new MutationObserver((mutations) => {
      // Only refresh if new tables were added or removed
      let shouldRefresh = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches("table.freeze-table, table.editor360-table")) {
              shouldRefresh = true;
              break;
            }
            if (node.querySelector && node.querySelector("table.freeze-table, table.editor360-table")) {
              shouldRefresh = true;
              break;
            }
          }
        }
        for (const node of mutation.removedNodes) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches("table.freeze-table, table.editor360-table")) {
              shouldRefresh = true;
              break;
            }
          }
        }
        if (shouldRefresh) break;
      }

      if (shouldRefresh) {
        callback();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    return observer;
  } catch (error) {
    console.error("Observer: Failed to create MutationObserver", error);
    return null;
  }
}

/**
 * Sync observers with current DOM tables
 * @param {Map} observedTables - Map of observed tables
 * @param {ResizeObserver} resizeObserver - ResizeObserver instance
 * @param {IntersectionObserver} intersectionObserver - IntersectionObserver instance
 * @param {Set} tablesInStickyZone - Set of tables in sticky zone
 */
export function syncObservers(observedTables, resizeObserver, intersectionObserver, tablesInStickyZone) {
  try {
    const tables = document.querySelectorAll("table.freeze-table, table.editor360-table");
    
    // Add new tables to observers
    tables.forEach((table) => {
      if (!observedTables.has(table)) {
        if (resizeObserver) {
          resizeObserver.observe(table);
        }
        if (intersectionObserver) {
          intersectionObserver.observe(table);
        }
        observedTables.set(table, true);
      }
    });

    // Remove tables that no longer exist
    const currentTables = new Set(tables);
    observedTables.forEach((_, table) => {
      if (!currentTables.has(table)) {
        if (resizeObserver) {
          resizeObserver.unobserve(table);
        }
        if (intersectionObserver) {
          intersectionObserver.unobserve(table);
        }
        observedTables.delete(table);
        tablesInStickyZone.delete(table);
      }
    });
  } catch (error) {
    console.error("Observer: Error syncing observers", error);
  }
}
