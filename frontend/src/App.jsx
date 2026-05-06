import { useEffect, useMemo, useState } from "react";
import "./App.css";

function App() {
  const [apiBase, setApiBase] = useState("http://127.0.0.1:8000");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [editingEquipment, setEditingEquipment] = useState(null);

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
    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/orders`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to load orders");
      }

      const rows = Array.isArray(data.data) ? data.data.map(normalizeRow) : [];
      setOrders(rows);
    } catch (err) {
      showMessage("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((row) => {
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !q ||
        row.Equipment.toLowerCase().includes(q) ||
        row.Order.toLowerCase().includes(q) ||
        (row.Vendor || "").toLowerCase().includes(q) ||
        (row.Notes || "").toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === "All" ||
        (row.Status || "").toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  const dashboardStats = useMemo(() => {
    const total = orders.length;
    const open = orders.filter(
      (row) => (row.Status || "").toLowerCase() === "open"
    ).length;
    const pending = orders.filter(
      (row) => (row.Status || "").toLowerCase() === "pending"
    ).length;
    const closed = orders.filter(
      (row) => (row.Status || "").toLowerCase() === "closed"
    ).length;
    const cancelled = orders.filter(
      (row) => (row.Status || "").toLowerCase() === "cancelled"
    ).length;

    return { total, open, pending, closed, cancelled };
  }, [orders]);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Save failed");
      }

      showMessage(
        "success",
        isEdit ? "Order updated successfully" : "Order added successfully"
      );
      resetForm();
      loadOrders();
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
      loadOrders();
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
      showMessage("success", `Found ${found.Equipment}`);
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  return (
    <div className="app-container">
      <div className="page">
        <h1>Equipment Order Lookup</h1>
        <p className="subtitle">FastAPI + PostgreSQL + Plain React UI</p>

        <div className="dashboard-grid">
          <div className="dashboard-card total">
            <div className="dashboard-title">Total Orders</div>
            <div className="dashboard-value">{dashboardStats.total}</div>
          </div>

          <div className="dashboard-card open">
            <div className="dashboard-title">Open</div>
            <div className="dashboard-value">{dashboardStats.open}</div>
          </div>

          <div className="dashboard-card pending">
            <div className="dashboard-title">Pending</div>
            <div className="dashboard-value">{dashboardStats.pending}</div>
          </div>

          <div className="dashboard-card closed">
            <div className="dashboard-title">Closed</div>
            <div className="dashboard-value">{dashboardStats.closed}</div>
          </div>

          <div className="dashboard-card cancelled">
            <div className="dashboard-title">Cancelled</div>
            <div className="dashboard-value">{dashboardStats.cancelled}</div>
          </div>
        </div>

        <div className="card">
          <h2>API Connection</h2>
          <div className="row">
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://127.0.0.1:8000"
            />
            <button onClick={loadOrders}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="grid">
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
                onChange={(e) =>
                  setForm({ ...form, Order: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Vendor"
                value={form.Vendor}
                onChange={(e) =>
                  setForm({ ...form, Vendor: e.target.value })
                }
              />

              <input
                type="date"
                value={form.DeliveryDate}
                onChange={(e) =>
                  setForm({ ...form, DeliveryDate: e.target.value })
                }
              />

              <select
                value={form.Status}
                onChange={(e) =>
                  setForm({ ...form, Status: e.target.value })
                }
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
                onChange={(e) =>
                  setForm({ ...form, Notes: e.target.value })
                }
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

          <div className="card">
            <h2>Search / Filter</h2>

            <input
              type="text"
              placeholder="Search equipment, order, vendor, notes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div
              className="button-row"
              style={{ marginTop: "12px", marginBottom: "12px" }}
            >
              <button type="button" onClick={handleFindOne}>
                Find One
              </button>
              <button type="button" className="secondary" onClick={loadOrders}>
                Show All
              </button>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h2>Orders ({filteredOrders.length})</h2>

          <div className="table-wrap">
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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((row) => (
                    <tr key={row.id || row.Equipment}>
                      <td>{row.Equipment}</td>
                      <td>{row.Order}</td>
                      <td>{row.Vendor || "-"}</td>
                      <td>
                        {row.DeliveryDate
                          ? String(row.DeliveryDate).slice(0, 10)
                          : "-"}
                      </td>
                      <td>{row.Status || "-"}</td>
                      <td>{row.Notes || "-"}</td>
                      <td className="action-cell">
                        <button
                          type="button"
                          className="small"
                          onClick={() => startEdit(row)}
                        >
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
        </div>
      </div>
    </div>
  );
}

export default App;