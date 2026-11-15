/**
 * Inventory Management System - Frontend Controller
 * Plain Vanilla Modern JavaScript (ES6+)
 */

// Global State
let allProductsCache = [];
let pendingDeleteId = null;

// DOM Elements
const elements = {
  // Tabs & Navigation
  navItems: document.querySelectorAll('.nav-item'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  currentSectionTitle: document.getElementById('currentSectionTitle'),
  currentSectionSubtitle: document.getElementById('currentSectionSubtitle'),

  // Status indicators
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  dbAlertBanner: document.getElementById('dbAlertBanner'),
  btnRetryDb: document.getElementById('btnRetryDb'),

  // Dashboard Stats
  statTotalProducts: document.getElementById('statTotalProducts'),
  statTotalQty: document.getElementById('statTotalQty'),
  statTotalValuation: document.getElementById('statTotalValuation'),
  statLowStock: document.getElementById('statLowStock'),
  statOutOfStock: document.getElementById('statOutOfStock'),
  lowStockTableBody: document.getElementById('lowStockTableBody'),
  recentActivityFeed: document.getElementById('recentActivityFeed'),
  btnViewAllLowStock: document.getElementById('btnViewAllLowStock'),
  btnViewAllHistory: document.getElementById('btnViewAllHistory'),

  // Inventory Table & Filters
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  productsTableBody: document.getElementById('productsTableBody'),
  productCountLabel: document.getElementById('productCountLabel'),
  categoryDatalist: document.getElementById('categoryDatalist'),

  // Transactions Tab
  txTypeFilter: document.getElementById('txTypeFilter'),
  transactionsTableBody: document.getElementById('transactionsTableBody'),

  // Action Buttons
  btnOpenAddProduct: document.getElementById('btnOpenAddProduct'),
  btnQuickStock: document.getElementById('btnQuickStock'),
  btnExportProducts: document.getElementById('btnExportProducts'),
  btnExportTransactions: document.getElementById('btnExportTransactions'),

  // Modals
  productDialog: document.getElementById('productDialog'),
  productDialogTitle: document.getElementById('productDialogTitle'),
  productForm: document.getElementById('productForm'),
  productIdInput: document.getElementById('productId'),
  initialQtyGroup: document.getElementById('initialQtyGroup'),

  stockDialog: document.getElementById('stockDialog'),
  stockForm: document.getElementById('stockForm'),
  stockProductId: document.getElementById('stockProductId'),
  stockProductPreview: document.getElementById('stockProductPreview'),
  previewCurrentStock: document.getElementById('previewCurrentStock'),

  deleteDialog: document.getElementById('deleteDialog'),
  deleteProductName: document.getElementById('deleteProductName'),
  btnConfirmDelete: document.getElementById('btnConfirmDelete'),

  toastContainer: document.getElementById('toastContainer'),
};

// -----------------------------------------------------------------------------
// Formatters & Helpers
// -----------------------------------------------------------------------------
const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
};

const formatDate = (isoStr) => {
  if (!isoStr) return 'N/A';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -----------------------------------------------------------------------------
// Modal Dialog Management (with Light-Dismiss Fallback)
// -----------------------------------------------------------------------------
function setupDialogBackdrops() {
  document.querySelectorAll('dialog').forEach((dialog) => {
    // Close button inside dialog
    dialog.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });

    // Fallback for browsers without native <dialog closedby> support
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;

        if (!isDialogContent) {
          dialog.close();
        }
      });
    }
  });
}

// -----------------------------------------------------------------------------
// Tab Switching
// -----------------------------------------------------------------------------
function switchTab(tabId) {
  elements.navItems.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  elements.tabPanes.forEach((pane) => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'dashboard-tab') {
    elements.currentSectionTitle.textContent = 'Dashboard Overview';
    elements.currentSectionSubtitle.textContent = 'Real-time stock valuation and inventory metrics';
    loadDashboardStats();
  } else if (tabId === 'inventory-tab') {
    elements.currentSectionTitle.textContent = 'Products Inventory';
    elements.currentSectionSubtitle.textContent = 'Manage catalog, stock levels, and item details';
    loadCategories();
    loadProducts();
  } else if (tabId === 'transactions-tab') {
    elements.currentSectionTitle.textContent = 'Stock History & Audit Log';
    elements.currentSectionSubtitle.textContent = 'Complete record of inventory receipts and dispatches';
    loadTransactions();
  }
}

// -----------------------------------------------------------------------------
// Database Health Check
// -----------------------------------------------------------------------------
async function checkDbStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();

    if (json.database && json.database.connected) {
      elements.statusIndicator.className = 'status-indicator online';
      elements.statusText.textContent = `Online (${json.database.database})`;
      elements.dbAlertBanner.style.display = 'none';
      return true;
    } else {
      elements.statusIndicator.className = 'status-indicator offline';
      elements.statusText.textContent = 'MySQL Disconnected';
      elements.dbAlertBanner.style.display = 'flex';
      return false;
    }
  } catch (err) {
    elements.statusIndicator.className = 'status-indicator offline';
    elements.statusText.textContent = 'Server Offline';
    elements.dbAlertBanner.style.display = 'flex';
    return false;
  }
}

// -----------------------------------------------------------------------------
// Dashboard API & Rendering
// -----------------------------------------------------------------------------
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const result = await res.json();

    if (!result.success) {
      console.warn('Dashboard stats notice:', result.message);
      return;
    }

    const { summary, recentTransactions } = result.data;

    elements.statTotalProducts.textContent = summary.total_products || 0;
    elements.statTotalQty.textContent = (summary.total_items || 0).toLocaleString();
    elements.statTotalValuation.textContent = formatCurrency(summary.total_valuation);
    elements.statLowStock.textContent = summary.low_stock || 0;
    elements.statOutOfStock.textContent = summary.out_of_stock || 0;

    // Load low stock items in table
    loadLowStockItems();

    // Render Recent Activity Feed
    if (recentTransactions && recentTransactions.length > 0) {
      elements.recentActivityFeed.innerHTML = recentTransactions
        .map((tx) => {
          const isStockIn = tx.type === 'IN';
          return `
            <div class="feed-item">
              <div class="feed-icon ${isStockIn ? 'bg-blue' : 'bg-rose'}">
                ${isStockIn ? '📥' : '📤'}
              </div>
              <div class="feed-details">
                <div class="feed-title">
                  <strong>${isStockIn ? '+' : '-'}${tx.quantity} units</strong> &bull; ${escapeHtml(tx.product_name)}
                </div>
                <div class="feed-meta">
                  SKU: <code>${escapeHtml(tx.product_sku)}</code> &bull; ${formatDate(tx.created_at)}
                </div>
                ${tx.notes ? `<div class="feed-notes">${escapeHtml(tx.notes)}</div>` : ''}
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      elements.recentActivityFeed.innerHTML = '<p class="text-center text-muted py-4">No recent stock movements recorded.</p>';
    }
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

async function loadLowStockItems() {
  try {
    const res = await fetch('/api/products?status=low');
    const result = await res.json();

    if (!result.success || !result.data) return;

    // Also get out of stock items
    const resOut = await fetch('/api/products?status=out');
    const resultOut = await resOut.json();
    const attentionItems = [...(resultOut.data || []), ...(result.data || [])];

    if (attentionItems.length === 0) {
      elements.lowStockTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            🎉 All products have healthy stock levels above minimum thresholds!
          </td>
        </tr>
      `;
      return;
    }

    elements.lowStockTableBody.innerHTML = attentionItems
      .slice(0, 5)
      .map((p) => {
        const isOut = p.quantity === 0;
        return `
          <tr>
            <td class="sku-cell">${escapeHtml(p.sku)}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.category)}</td>
            <td class="qty-cell">
              <span class="badge ${isOut ? 'badge-danger' : 'badge-warning'}">
                ${p.quantity} units
              </span>
            </td>
            <td>${p.min_stock} units</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="openStockModal(${p.id}, 'IN')">
                + Restock
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Error loading low stock items:', err);
  }
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const result = await res.json();
    if (result.success && result.data) {
      // Update Category Filter dropdown
      const currentSelected = elements.categoryFilter.value;
      elements.categoryFilter.innerHTML = '<option value="ALL">All Categories</option>' +
        result.data.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
      elements.categoryFilter.value = currentSelected || 'ALL';

      // Update datalist for Add Product modal
      elements.categoryDatalist.innerHTML = result.data
        .map(cat => `<option value="${escapeHtml(cat)}">`)
        .join('');
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// -----------------------------------------------------------------------------
// Products Inventory API & Rendering
// -----------------------------------------------------------------------------
let searchDebounceTimeout = null;

async function loadProducts() {
  try {
    const search = elements.searchInput.value.trim();
    const category = elements.categoryFilter.value;
    const status = elements.statusFilter.value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'ALL') params.append('category', category);
    if (status && status !== 'all') params.append('status', status);

    const res = await fetch(`/api/products?${params.toString()}`);
    const result = await res.json();

    if (!result.success) {
      elements.productsTableBody.innerHTML = `
        <tr><td colspan="8" class="text-center text-muted py-4">${escapeHtml(result.message)}</td></tr>
      `;
      return;
    }

    allProductsCache = result.data || [];
    renderProductsTable(allProductsCache);
    updateStockModalProducts(allProductsCache);
  } catch (err) {
    elements.productsTableBody.innerHTML = `
      <tr><td colspan="8" class="text-center text-muted py-4">Failed to load products. Check server connection.</td></tr>
    `;
  }
}

function renderProductsTable(products) {
  elements.productCountLabel.textContent = `Showing ${products.length} product${products.length === 1 ? '' : 's'}`;

  if (products.length === 0) {
    elements.productsTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">
          No products found matching your search and filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  elements.productsTableBody.innerHTML = products
    .map((p) => {
      let statusBadge = `<span class="badge badge-success">In Stock</span>`;
      if (p.quantity === 0) {
        statusBadge = `<span class="badge badge-danger">Out of Stock</span>`;
      } else if (p.quantity <= p.min_stock) {
        statusBadge = `<span class="badge badge-warning">Low Stock (≤ ${p.min_stock})</span>`;
      }

      const totalVal = (p.price * p.quantity);

      return `
        <tr>
          <td class="sku-cell">${escapeHtml(p.sku)}</td>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            ${p.description ? `<br><small class="text-muted">${escapeHtml(p.description)}</small>` : ''}
          </td>
          <td><span class="badge badge-in">${escapeHtml(p.category)}</span></td>
          <td class="price-cell">${formatCurrency(p.price)}</td>
          <td class="qty-cell"><strong>${p.quantity}</strong> units</td>
          <td>${statusBadge}</td>
          <td class="value-cell">${formatCurrency(totalVal)}</td>
          <td class="text-right">
            <div class="action-buttons">
              <button class="icon-btn stock-btn" title="Quick Stock Movement" onclick="openStockModal(${p.id}, 'IN')">
                ⚡ Stock
              </button>
              <button class="icon-btn edit-btn" title="Edit Product" onclick="openEditProductModal(${p.id})">
                ✏️
              </button>
              <button class="icon-btn delete-btn" title="Delete Product" onclick="openDeleteModal(${p.id}, '${escapeHtml(p.name)}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// -----------------------------------------------------------------------------
// Stock Movement Modal & Transactions
// -----------------------------------------------------------------------------
function updateStockModalProducts(products) {
  const currentVal = elements.stockProductId.value;
  elements.stockProductId.innerHTML = '<option value="">-- Choose a product --</option>' +
    products.map(p => `<option value="${p.id}" data-qty="${p.quantity}">${escapeHtml(p.sku)} - ${escapeHtml(p.name)} (Stock: ${p.quantity})</option>`).join('');
  if (currentVal) elements.stockProductId.value = currentVal;
}

window.openStockModal = function (productId = null, defaultType = 'IN') {
  elements.stockForm.reset();
  if (productId) {
    elements.stockProductId.value = productId;
    triggerStockPreview(productId);
  } else {
    elements.stockProductPreview.style.display = 'none';
  }

  const radio = elements.stockForm.querySelector(`input[name="stockType"][value="${defaultType}"]`);
  if (radio) radio.checked = true;

  elements.stockDialog.showModal();
};

function triggerStockPreview(productId) {
  const selected = allProductsCache.find(p => p.id === Number(productId));
  if (selected) {
    elements.stockProductPreview.style.display = 'block';
    elements.previewCurrentStock.textContent = selected.quantity;
  } else {
    elements.stockProductPreview.style.display = 'none';
  }
}

elements.stockProductId.addEventListener('change', (e) => {
  triggerStockPreview(e.target.value);
});

elements.stockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(elements.stockForm);
  const productId = formData.get('product_id');
  const type = formData.get('stockType');
  const quantity = formData.get('quantity');
  const notes = formData.get('notes');

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, type, quantity, notes }),
    });

    const result = await res.json();
    if (!result.success) {
      showToast(result.message, 'error');
      return;
    }

    showToast(result.message, 'success');
    elements.stockDialog.close();

    // Refresh views
    loadProducts();
    loadDashboardStats();
    loadTransactions();
  } catch (err) {
    showToast('Failed to record transaction. Check server.', 'error');
  }
});

// -----------------------------------------------------------------------------
// Add / Edit Product Modal
// -----------------------------------------------------------------------------
function openAddProductModal() {
  elements.productForm.reset();
  elements.productIdInput.value = '';
  elements.productDialogTitle.textContent = 'Add New Product';
  elements.initialQtyGroup.style.display = 'block';
  elements.productSku.removeAttribute('readonly');
  elements.productDialog.showModal();
}

window.openEditProductModal = function (id) {
  const product = allProductsCache.find(p => p.id === id);
  if (!product) return;

  elements.productIdInput.value = product.id;
  elements.productDialogTitle.textContent = `Edit Product: ${product.name}`;
  elements.productSku.value = product.sku;
  elements.productName.value = product.name;
  elements.productCategory.value = product.category;
  elements.productPrice.value = product.price;
  elements.productMinStock.value = product.min_stock;
  elements.productDescription.value = product.description || '';

  // Initial stock quantity is not edited directly here; stock in/out is used for tracking
  elements.initialQtyGroup.style.display = 'none';

  elements.productDialog.showModal();
};

elements.productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = elements.productIdInput.value;
  const isEdit = Boolean(id);

  const payload = {
    sku: elements.productSku.value.trim(),
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    price: parseFloat(elements.productPrice.value),
    min_stock: parseInt(elements.productMinStock.value, 10),
    description: elements.productDescription.value.trim(),
  };

  if (!isEdit) {
    payload.quantity = parseInt(elements.productQuantity.value, 10) || 0;
  }

  try {
    const url = isEdit ? `/api/products/${id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!result.success) {
      showToast(result.message, 'error');
      return;
    }

    showToast(result.message, 'success');
    elements.productDialog.close();
    loadCategories();
    loadProducts();
    loadDashboardStats();
  } catch (err) {
    showToast('Failed to save product.', 'error');
  }
});

// -----------------------------------------------------------------------------
// Delete Product Modal
// -----------------------------------------------------------------------------
window.openDeleteModal = function (id, name) {
  pendingDeleteId = id;
  elements.deleteProductName.textContent = `"${name}"`;
  elements.deleteDialog.showModal();
};

elements.btnConfirmDelete.addEventListener('click', async () => {
  if (!pendingDeleteId) return;

  try {
    const res = await fetch(`/api/products/${pendingDeleteId}`, { method: 'DELETE' });
    const result = await res.json();

    if (!result.success) {
      showToast(result.message, 'error');
      return;
    }

    showToast('Product deleted successfully', 'success');
    elements.deleteDialog.close();
    pendingDeleteId = null;

    loadCategories();
    loadProducts();
    loadDashboardStats();
  } catch (err) {
    showToast('Failed to delete product.', 'error');
  }
});

// -----------------------------------------------------------------------------
// Transactions History Log
// -----------------------------------------------------------------------------
async function loadTransactions() {
  try {
    const type = elements.txTypeFilter.value;
    const params = new URLSearchParams();
    if (type && type !== 'ALL') params.append('type', type);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      elements.transactionsTableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-muted py-4">${escapeHtml(result.message || 'No records')}</td></tr>
      `;
      return;
    }

    const txs = result.data;
    if (txs.length === 0) {
      elements.transactionsTableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-muted py-4">No stock transactions found.</td></tr>
      `;
      return;
    }

    elements.transactionsTableBody.innerHTML = txs
      .map((t) => {
        const isStockIn = t.type === 'IN';
        return `
          <tr>
            <td>${formatDate(t.created_at)}</td>
            <td class="sku-cell">${escapeHtml(t.product_sku)}</td>
            <td><strong>${escapeHtml(t.product_name)}</strong></td>
            <td>
              <span class="badge ${isStockIn ? 'badge-in' : 'badge-out'}">
                ${isStockIn ? '📥 Stock IN' : '📤 Stock OUT'}
              </span>
            </td>
            <td class="qty-cell">
              <strong>${isStockIn ? '+' : '-'}${t.quantity}</strong> units
            </td>
            <td>
              <span class="text-muted">${t.previous_quantity}</span> → <strong>${t.new_quantity}</strong>
            </td>
            <td>${t.notes ? escapeHtml(t.notes) : '<em class="text-muted">—</em>'}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    elements.transactionsTableBody.innerHTML = `
      <tr><td colspan="7" class="text-center text-muted py-4">Failed to load transactions.</td></tr>
    `;
  }
}

// -----------------------------------------------------------------------------
// Exports to CSV
// -----------------------------------------------------------------------------
elements.btnExportProducts.addEventListener('click', () => {
  window.location.href = '/api/export/products';
});

elements.btnExportTransactions.addEventListener('click', () => {
  window.location.href = '/api/export/transactions';
});

// -----------------------------------------------------------------------------
// Event Listeners & Initialization
// -----------------------------------------------------------------------------
function setupEventListeners() {
  // Navigation tabs
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Action buttons
  elements.btnOpenAddProduct.addEventListener('click', openAddProductModal);
  elements.btnQuickStock.addEventListener('click', () => openStockModal());

  // Dashboard shortcuts
  elements.btnViewAllLowStock.addEventListener('click', () => {
    elements.statusFilter.value = 'low';
    switchTab('inventory-tab');
  });

  elements.btnViewAllHistory.addEventListener('click', () => {
    switchTab('transactions-tab');
  });

  // Search input debounced
  elements.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(loadProducts, 250);
  });

  elements.btnClearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    loadProducts();
  });

  // Filter dropdowns
  elements.categoryFilter.addEventListener('change', loadProducts);
  elements.statusFilter.addEventListener('change', loadProducts);
  elements.txTypeFilter.addEventListener('change', loadTransactions);

  // Retry DB connection
  elements.btnRetryDb.addEventListener('click', async () => {
    elements.statusText.textContent = 'Retrying connection...';
    const ok = await checkDbStatus();
    if (ok) {
      showToast('Database connected successfully!', 'success');
      loadDashboardStats();
      loadCategories();
      loadProducts();
    } else {
      showToast('MySQL is still unreachable. Check XAMPP.', 'error');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupDialogBackdrops();
  setupEventListeners();

  await checkDbStatus();
  await loadDashboardStats();
  await loadCategories();
  await loadProducts();
});
