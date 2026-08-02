class TableService {
  constructor() {
    this.tables = [];
    this.initialized = false;
  }

  init(containerSelector = ".table-container") {
    if (this.initialized) return;

    const containers = document.querySelectorAll(containerSelector);
    containers.forEach((container) => {
      this.setupTable(container);
    });

    this.initialized = true;
    console.log("✅ TableService initialized");
  }

  setupTable(container) {
    const table = container.querySelector(".table");
    if (!table) return;

    // ذخیره در لیست
    this.tables.push({
      container: container,
      table: table,
      data: this.getTableData(table),
    });

    // رویداد کلیک روی ردیف‌ها
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      row.addEventListener("click", (e) => {
        // اگر کلیک روی دکمه‌ها نبود
        if (!e.target.closest(".action-btn")) {
          const event = new CustomEvent("table:row-click", {
            detail: {
              table: table,
              row: row,
              data: this.getRowData(row),
            },
          });
          table.dispatchEvent(event);
        }
      });
    });
  }

  getTableData(table) {
    const headers = [];
    const headerCells = table.querySelectorAll("thead th");
    headerCells.forEach((th) => {
      headers.push(th.textContent.trim());
    });

    const rows = [];
    const bodyRows = table.querySelectorAll("tbody tr");
    bodyRows.forEach((tr) => {
      const rowData = {};
      const cells = tr.querySelectorAll("td");
      cells.forEach((td, index) => {
        rowData[headers[index] || `col${index}`] = td.textContent.trim();
      });
      rows.push(rowData);
    });

    return {
      headers: headers,
      rows: rows,
    };
  }

  getRowData(row) {
    const data = {};
    const cells = row.querySelectorAll("td");
    const table = row.closest(".table");
    const headers = table ? this.getTableData(table).headers : [];

    cells.forEach((td, index) => {
      data[headers[index] || `col${index}`] = td.textContent.trim();
    });

    return data;
  }

  // ===== متدهای کمکی =====

  getTable(container) {
    return this.tables.find((t) => t.container === container);
  }

  getRows(table) {
    return table.querySelectorAll("tbody tr");
  }

  getRowCount(table) {
    return table.querySelectorAll("tbody tr").length;
  }

  getCell(row, column) {
    return row.querySelector(`td:nth-child(${column})`);
  }

  getCellText(row, column) {
    const cell = this.getCell(row, column);
    return cell ? cell.textContent.trim() : "";
  }

  // ===== جستجو =====

  search(table, term, columns = "all") {
    const rows = this.getRows(table);
    let visibleCount = 0;

    rows.forEach((row) => {
      let shouldShow = false;
      const cells = row.querySelectorAll("td");

      if (columns === "all") {
        const text = row.textContent.toLowerCase();
        if (text.includes(term.toLowerCase())) {
          shouldShow = true;
        }
      } else {
        const cell = cells[columns];
        if (
          cell &&
          cell.textContent.toLowerCase().includes(term.toLowerCase())
        ) {
          shouldShow = true;
        }
      }

      if (shouldShow) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    return visibleCount;
  }

  // ===== مرتب‌سازی =====

  sort(table, column, order = "asc") {
    const tbody = table.querySelector("tbody");
    const rows = Array.from(this.getRows(table));

    const sortedRows = rows.sort((a, b) => {
      const aText = this.getCellText(a, column);
      const bText = this.getCellText(b, column);

      // تلاش برای مرتب‌سازی عددی
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }

      // مرتب‌سازی متنی
      const comparison = aText.localeCompare(bText);
      return order === "asc" ? comparison : -comparison;
    });

    sortedRows.forEach((row) => {
      tbody.appendChild(row);
    });

    // به‌روزرسانی نشانگر مرتب‌سازی
    this.updateSortIndicator(table, column, order);
  }

  updateSortIndicator(table, column, order) {
    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, index) => {
      th.dataset.sort = "";
      const icon = th.querySelector(".sort-icon");
      if (icon) icon.remove();
    });

    const header = headers[column];
    if (header) {
      header.dataset.sort = order;
      const icon = document.createElement("i");
      icon.className = `sort-icon fas fa-sort-${order === "asc" ? "up" : "down"}`;
      header.appendChild(icon);
    }
  }

  // ===== دیستروی =====

  destroy() {
    this.tables = [];
    this.initialized = false;
  }
}

// ===== Export =====
export const tableService = new TableService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.TableService = tableService;
  window.tableService = tableService;
}
