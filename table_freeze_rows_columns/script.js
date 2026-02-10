// POC VERSION - keep unchanged for reference.
class TableFreezeController {
    constructor(options = {}) {
      this.options = {
        offsetSelector: "",
        ...options,
      };
      this._refreshRaf = 0;
      this._scrollRaf = 0;
      this._onResize = this._onResize.bind(this);
      this._onScroll = this._onScroll.bind(this);
    }

    init() {
      this.refresh();
      this.handlePageScroll();
      window.addEventListener("resize", this._onResize);
      window.addEventListener("scroll", this._onScroll, { passive: true });
    }

    refresh() {
      this.applyAll();
    }

    getStickyOffset() {
      if (this.options.offsetSelector) {
        const el = document.querySelector(this.options.offsetSelector);
        if (el) {
          return el.offsetHeight || 0;
        }
      }
      return 0;
    }

    getFreezeCount(table, attrName) {
      const raw = table.getAttribute(attrName);
      if (!raw) return 0;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    }

    clearFreezeStyles(table) {
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
    }

    measureColumnWidths(table) {
      const firstRow = table.querySelector("thead tr") || table.querySelector("tbody tr");
      if (!firstRow) return [];
      return Array.from(firstRow.children).map((cell) => cell.getBoundingClientRect().width);
    }

    measureHeaderRowHeights(thead) {
      if (!thead) return [];
      return Array.from(thead.rows).map((row) => row.getBoundingClientRect().height);
    }

    measureBodyRowHeights(tbody, rowCount) {
      if (!tbody) return [];
      return Array.from(tbody.rows)
        .slice(0, rowCount)
        .map((row) => row.getBoundingClientRect().height);
    }

    applyColumnFreeze(table, colFreeze) {
      if (colFreeze <= 0) return;
      const widths = this.measureColumnWidths(table);
      const leftOffsets = [];
      let acc = 0;
      for (let i = 0; i < colFreeze; i += 1) {
        leftOffsets[i] = acc;
        acc += widths[i] || 0;
      }

      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = Array.from(row.children);
        for (let col = 0; col < colFreeze && col < cells.length; col += 1) {
          const cell = cells[col];
          cell.classList.add("freeze-col");
          cell.style.left = `${leftOffsets[col]}px`;
          if (col === colFreeze - 1) {
            cell.classList.add("freeze-boundary-col");
          }
        }
      });
    }

    applyRowFreeze(table, rowFreeze) {
      const thead = table.tHead;
      const tbody = table.tBodies[0];

      const headerHeights = this.measureHeaderRowHeights(thead);
      const headerTotal = headerHeights.reduce((sum, h) => sum + h, 0);

      if (thead) {
        let topAcc = 0;
        Array.from(thead.rows).forEach((row, rowIndex) => {
          Array.from(row.cells).forEach((cell) => {
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
          Array.from(row.cells).forEach((cell) => {
            cell.classList.add("freeze-row");
            cell.style.top = `${bodyTopAcc}px`;
            if (rowIndex === rowFreeze - 1) {
              cell.classList.add("freeze-boundary-row");
            }
          });
          bodyTopAcc += bodyHeights[rowIndex] || 0;
        });
    }

    applyCornerPriority(table, colFreeze) {
      if (colFreeze <= 0) return;
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = Array.from(row.children);
        for (let col = 0; col < colFreeze && col < cells.length; col += 1) {
          const cell = cells[col];
          if (cell.classList.contains("freeze-row")) {
            cell.classList.add("freeze-corner");
          }
        }
      });
    }

    applyFreezeToTable(table) {
      this.clearFreezeStyles(table);
      const colFreeze = this.getFreezeCount(table, "data-col-freeze");
      const rowFreeze = this.getFreezeCount(table, "data-row-freeze");

      table.dataset.colFreeze = colFreeze;
      table.dataset.rowFreeze = rowFreeze;

      this.applyRowFreeze(table, rowFreeze);
      this.applyColumnFreeze(table, colFreeze);
      this.applyCornerPriority(table, colFreeze);
    }

    applyAll() {
      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => this.applyFreezeToTable(table));
    }

    handlePageScroll() {
      const tables = document.querySelectorAll("table.freeze-table");
      tables.forEach((table) => {
        const container = table.closest(".table-content");
        if (!container) return;

        const thead = table.tHead;
        const tbody = table.tBodies[0];
        if (!thead) return;

        const containerRect = container.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const stickyOffset = this.getStickyOffset();
        const rowFreeze = this.getFreezeCount(table, "data-row-freeze");

        if (containerRect.top <= stickyOffset && containerRect.bottom > stickyOffset) {
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
          this.applyRowFreeze(table, rowFreeze);
        }
      });
    }

    _onResize() {
      if (this._refreshRaf) cancelAnimationFrame(this._refreshRaf);
      this._refreshRaf = requestAnimationFrame(() => {
        this._refreshRaf = 0;
        this.applyAll();
      });
    }

    _onScroll() {
      if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = requestAnimationFrame(() => {
        this._scrollRaf = 0;
        this.handlePageScroll();
      });
    }
  }

