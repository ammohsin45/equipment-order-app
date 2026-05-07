import { useEffect, useMemo, useState } from "react";
import "./App.css";

function App() {
  const [apiBase, setApiBase] = useState(
    import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"
  );

  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    pending: 0,
    closed: 0,
    cancelled: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [editingEquipment, setEditingEquipment] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);

  const [form, setForm] = useState({
    Equipment: "",
    Order: "",
    Vendor: "",
    DeliveryDate: "",
    Status: "",
    Notes: "",
  });

  const normalizeRow = (row) => ({
    id: row.id,
    Equipment: row.Equipment ?? row.equipment ?? "",
    Order: row.Order ?? row.order_number ?? row.order ?? "",
    Vendor: row.Vendor ?? row.vendor ?? "",
    DeliveryDate: row.DeliveryDate ?? row.delivery_date ?? "",
    Status: row.Status ?? row.status ?? "",
    Notes: row.Notes ?? row.notes ?? "",
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
  };

  const loadSummary = async () => {
    try {
      const res = await fetch(`${apiBase}/orders/summary`);
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });

      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (filterStatus && filterStatus !== "All") params.append("status", filterStatus);

      const res = await fetch(`${apiBase}/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to load orders");
      }

      const rows = Array.isArray(data.data) ? data.data.map(normalizeRow) : [];
      setOrders(rows);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.count || 0);
    } catch (err) {
      showMessage("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, pageSize, searchTerm, filterStatus, apiBase]);

  useEffect(() => {
    loadSummary();
  }, [apiBase]);

  const resetForm = () => {
    setEditingEquipment(null);
    setForm({
      Equipment: "",
      Order: "",
      Vendor: "",
      DeliveryDate: "",
      Status: "",
      Notes: "",
    });
  };

  const startEdit = (row) => {
    setEditingEquipment(row.Equipment);
    setForm({
      Equipment: row.Equipment || "",
      Order: row.Order || "",
      Vendor: row.Vendor || "",
      DeliveryDate: row.DeliveryDate ? String(row.DeliveryDate).slice(0, 10) : "",
      Status: row.Status || "",
      Notes: row.Notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.Equipment.trim() || !form.Order.trim()) {
      showMessage("error", "Equipment and Order are required.");
      return;
    }

    const isEdit = !!editingEquipment;
    const url = isEdit
      ? `${apiBase}/orders/${encodeURIComponent(editingEquipment)}`
      : `${apiBase}/orders`;

    const payload = isEdit
      ? {
          Order: form.Order.trim(),
          Vendor: form.Vendor.trim() || null,
          DeliveryDate: form.DeliveryDate || null,
          Status: form.Status || null,
          Notes: form.Notes.trim() || null,
        }
      : {
          Equipment: form.Equipment.trim(),
          Order: form.Order.trim(),
          Vendor: form.Vendor.trim() || null,
          DeliveryDate: form.DeliveryDate || null,
          Status: form.Status || null,
          Notes: form.Notes.trim() || null,
        };

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Save failed");
      }

      showMessage("success", isEdit ? "Order updated successfully" : "Order added successfully");
      resetForm();
      setPage(1);
      await loadOrders();
      await loadSummary();
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  const handleDelete = async (equipment) => {
    const ok = window.confirm(`Delete order for ${equipment}?`);
    if (!ok) return;

    try {
      const res = await fetch(`${apiBase}/orders/${encodeURIComponent(equipment)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Delete failed");
      }

      showMessage("success", "Order deleted successfully");
      await loadOrders();
      await loadSummary();
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  const handleFindOne = async () => {
    const equipment = searchTerm.trim().toUpperCase();

    if (!equipment) {
      showMessage("error", "Enter an equipment value first.");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/find-order/${encodeURIComponent(equipment)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Search failed");
      }

      const found = normalizeRow(data);
      setOrders([found]);
      setTotalCount(1);
      setTotalPages(1);
      setPage(1);
      showMessage("success", `Found ${found.Equipment}`);
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  const handleExcelUpload = async () => {
    if (!uploadFile) {
      showMessage("error", "Please choose an Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch(`${apiBase}/orders/import-excel`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Excel upload failed");
      }

      showMessage(
        "success",
        `Excel imported successfully. Inserted: ${data.inserted}, Updated: ${data.updated}`
      );

      setUploadFile(null);
      setPage(1);
      await loadOrders();
      await loadSummary();
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  const pageNumbers = useMemo(() => {
    const nums = [];
    for (let i = 1; i <= totalPages; i++) nums.push(i);
    return nums;
  }, [totalPages]);

  return (
    <div className="app-container">
      <div className="page">
        <h1>Equipment Order Lookup</h1>
        <p className="subtitle">FastAPI + PostgreSQL + React UI</p>

        {/* Dashboard */}
        <div className="dashboard-grid">
          <div className="dashboard-card total">
            <div className="dashboard-title">Total Orders</div>
            <div className="dashboard-value">{summary.total}</div>
          </div>
          <div className="dashboard-card open">
            <div className="dashboard-title">Open</div>
            <div className="dashboard-value">{summary.open}</div>
          </div>
          <div className="dashboard-card pending">
            <div className="dashboard-title">Pending</div>
            <div className="dashboard-value">{summary.pending}</div>
          </div>
          <div className="dashboard-card closed">
            <div className="dashboard-title">Closed</div>
            <div className="dashboard-value">{summary.closed}</div>
          </div>
          <div className="dashboard-card cancelled">
            <div className="dashboard-title">Cancelled</div>
            <div className="dashboard-value">{summary.cancelled}</div>
          </div>
        </div>

        {/* API + Upload */}
        <div className="card">
          <h2>API & Excel Import</h2>
          <div className="row">
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="API base URL"
            />
            <button type="button" onClick={loadOrders}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="upload-row">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <button type="button" onClick={handleExcelUpload}>
              Import Excel
            </button>
          </div>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="grid">
          {/* Form */}
          <div className="card">
            <h2>{editingEquipment ? `Edit ${editingEquipment}` : "Add New Order"}</h2>

            <form onSubmit={handleSubmit} className="form">
              <input
                type="text"
                placeholder="Equipment"
                value={form.Equipment}
                disabled={!!editingEquipment}
                onChange={(e) =>
                  setForm({ ...form, Equipment: e.target.value.toUpperCase() })
                }
              />

              <input
                type="text"
                placeholder="Order"
                value={form.Order}
                onChange={(e) => setForm({ ...form, Order: e.target.value })}
              />

              <input
                type="text"
                placeholder="Vendor"
                value={form.Vendor}
                onChange={(e) => setForm({ ...form, Vendor: e.target.value })}
              />

              <input
                type="date"
                value={form.DeliveryDate}
                onChange={(e) => setForm({ ...form, DeliveryDate: e.target.value })}
              />

              <select
                value={form.Status}
                onChange={(e) => setForm({ ...form, Status: e.target.value })}
              >
                <option value="">Select Status</option>
                <option value="Open">Open</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <textarea
                placeholder="Notes"
                value={form.Notes}
                onChange={(e) => setForm({ ...form, Notes: e.target.value })}
              />

              <div className="button-row">
                <button type="submit">
                  {editingEquipment ? "Update Order" : "Add Order"}
                </button>
                <button type="button" className="secondary" onClick={resetForm}>
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Search / Filter */}
          <div className="card">
            <h2>Search / Filter</h2>

            <input
              type="text"
              placeholder="Search equipment, order, vendor, notes"
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
            />

            <div className="button-row" style={{ marginTop: "12px", marginBottom: "12px" }}>
              <button type="button" onClick={handleFindOne}>Find One</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPage(1);
                  loadOrders();
                }}
              >
                Refresh
              </button>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setPage(1);
                setFilterStatus(e.target.value);
              }}
            >
              <option value="All">All</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <div className="page-size-row">
              <label>Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="card">
          <h2>Orders ({totalCount})</h2>

          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Order</th>
                  <th>Vendor</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty">
                      No records found
                    </td>
                  </tr>
                ) : (
                  orders.map((row) => (
                    <tr key={row.id || row.Equipment}>
                      <td>{row.Equipment}</td>
                      <td>{row.Order}</td>
                      <td>{row.Vendor || "-"}</td>
                      <td>{row.DeliveryDate ? String(row.DeliveryDate).slice(0, 10) : "-"}</td>
                      <td>{row.Status || "-"}</td>
                      <td>{row.Notes || "-"}</td>
                      <td className="action-cell">
                        <button type="button" className="small" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="small danger"
                          onClick={() => handleDelete(row.Equipment)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only">
            {orders.length === 0 ? (
              <div className="empty mobile-empty">No records found</div>
            ) : (
              orders.map((row) => (
                <div className="mobile-card" key={row.id || row.Equipment}>
                  <div><strong>Equipment:</strong> {row.Equipment}</div>
                  <div><strong>Order:</strong> {row.Order}</div>
                  <div><strong>Vendor:</strong> {row.Vendor || "-"}</div>
                  <div><strong>Delivery Date:</strong> {row.DeliveryDate ? String(row.DeliveryDate).slice(0, 10) : "-"}</div>
                  <div><strong>Status:</strong> {row.Status || "-"}</div>
                  <div><strong>Notes:</strong> {row.Notes || "-"}</div>
                  <div className="button-row mobile-card-actions">
                    <button type="button" className="small" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="small danger"
                      onClick={() => handleDelete(row.Equipment)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              type="button"
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>

            <div className="page-numbers">
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={num === page ? "page-btn active-page" : "page-btn secondary"}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;