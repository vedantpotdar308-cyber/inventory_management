/**
 * StockMaster - Inventory & Sales Management
 * Frontend Controller (Vanilla JavaScript)
 */

// Application State
let currentUser = null;
let productsCache = [];
let salesCache = [];
let currentReportType = 'products';
let pendingDeleteId = null;

// DOM Elements Map
const dom = {
  // Login
  loginOverlay: document.getElementById('loginOverlay'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  appLayout: document.getElementById('appLayout'),
  loggedUserName: document.getElementById('loggedUserName'),
  loggedUserRole: document.getElementById('loggedUserRole'),
  btnLogout: document.getElementById('btnLogout'),

  // Navigation
  navBtns: document.querySelectorAll('.nav-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  pageHeading: document.getElementById('pageHeading'),
  pageSubheading: document.getElementById('pageSubheading'),
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),

  // Dashboard Elements
  dashTotalProducts: document.getElementById('dashTotalProducts'),
  dashTotalStock: document.getElementById('dashTotalStock'),
  dashStockValuation: document.getElementById('dashStockValuation'),
  dashCostValuation: document.getElementById('dashCostValuation'),
  dashTodaySales: document.getElementById('dashTodaySales'),
  dashTodayOrders: document.getElementById('dashTodayOrders'),
  dashLowStockCount: document.getElementById('dashLowStockCount'),
  dashLowStockTableBody: document.getElementById('dashLowStockTableBody'),
  dashRecentSalesTableBody: document.getElementById('dashRecentSalesTableBody'),
  btnGoToLowStock: document.getElementById('btnGoToLowStock'),
  btnGoToSales: document.getElementById('btnGoToSales'),

  // Product Management
  productSearchInput: document.getElementById('productSearchInput'),
  productCategoryFilter: document.getElementById('productCategoryFilter'),
  productStatusFilter: document.getElementById('productStatusFilter'),
  productsTableBody: document.getElementById('productsTableBody'),
  productTableCount: document.getElementById('productTableCount'),
  btnOpenAddProduct: document.getElementById('btnOpenAddProduct'),
  categoryList: document.getElementById('categoryList'),

  // Modals
  productDialog: document.getElementById('productDialog'),
  productDialogHeading: document.getElementById('productDialogHeading'),
  productModalForm: document.getElementById('productModalForm'),
  modalProductId: document.getElementById('modalProductId'),
  modalProductCode: document.getElementById('modalProductCode'),
  modalProductName: document.getElementById('modalProductName'),
  modalCategory: document.getElementById('modalCategory'),
  modalPurchasePrice: document.getElementById('modalPurchasePrice'),
  modalSalesPrice: document.getElementById('modalSalesPrice'),
  modalQuantity: document.getElementById('modalQuantity'),
  modalMinStock: document.getElementById('modalMinStock'),
  modalDescription: document.getElementById('modalDescription'),

  deleteDialog: document.getElementById('deleteDialog'),
  deleteTargetName: document.getElementById('deleteTargetName'),
  btnConfirmDelete: document.getElementById('btnConfirmDelete'),

  // Sales Management
  newSaleForm: document.getElementById('newSaleForm'),
  saleProductSelect: document.getElementById('saleProductSelect'),
  saleProductStockHint: document.getElementById('saleProductStockHint'),
  saleQuantity: document.getElementById('saleQuantity'),
  saleCalculatedTotal: document.getElementById('saleCalculatedTotal'),
  saleCustomerName: document.getElementById('saleCustomerName'),
  salePaymentMethod: document.getElementById('salePaymentMethod'),
  saleNotes: document.getElementById('saleNotes'),
  salesTableBody: document.getElementById('salesTableBody'),

  // Invoice Modal
  invoiceDialog: document.getElementById('invoiceDialog'),
  invModalNumber: document.getElementById('invModalNumber'),
  invModalDate: document.getElementById('invModalDate'),
  invModalCustomer: document.getElementById('invModalCustomer'),
  invModalPayment: document.getElementById('invModalPayment'),
  invModalItemsBody: document.getElementById('invModalItemsBody'),
  invModalGrandTotal: document.getElementById('invModalGrandTotal'),

  // Reports
  reportPills: document.querySelectorAll('.report-pill'),
  reportStartDate: document.getElementById('reportStartDate'),
  reportEndDate: document.getElementById('reportEndDate'),
  btnApplyDateFilter: document.getElementById('btnApplyDateFilter'),
  btnResetDateFilter: document.getElementById('btnResetDateFilter'),
  btnPrintReport: document.getElementById('btnPrintReport'),
  reportDisplayTitle: document.getElementById('reportDisplayTitle'),
  reportGeneratedTime: document.getElementById('reportGeneratedTime'),
  reportSummaryCards: document.getElementById('reportSummaryCards'),
  reportTableHead: document.getElementById('reportTableHead'),
  reportTableBody: document.getElementById('reportTableBody'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),
};

// -------------------------------------------------------------
// Utilities & Formatters
// -------------------------------------------------------------
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

const formatDate = (isoString) => {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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

// -------------------------------------------------------------
// Modal Dialogs & Light Dismiss Fallback
// -------------------------------------------------------------
function setupDialogBackdrops() {
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });

    // Fallback for browsers without native <dialog closedby>
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!inside) {
          dialog.close();
        }
      });
    }
  });
}

// -------------------------------------------------------------
// Authentication System
// -------------------------------------------------------------
function checkAuth() {
  const saved = localStorage.getItem('stockmaster_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      dom.loggedUserName.textContent = currentUser.full_name || currentUser.username;
      dom.loggedUserRole.textContent = currentUser.role || 'Admin';
      dom.loginOverlay.style.display = 'none';
      dom.appLayout.style.display = 'flex';
      loadDashboard();
      loadProducts();
      loadCategories();
      return true;
    } catch (e) {
      localStorage.removeItem('stockmaster_user');
    }
  }

  dom.loginOverlay.style.display = 'flex';
  dom.appLayout.style.display = 'none';
  return false;
}

dom.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = dom.loginUsername.value.trim();
  const password = dom.loginPassword.value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Login failed.');
      return;
    }

    localStorage.setItem('stockmaster_user', JSON.stringify(data.user));
    showToast('Signed in successfully!');
    checkAuth();
  } catch (err) {
    alert('Failed to connect to backend server. Make sure "npm start" is running.');
  }
});

dom.btnLogout.addEventListener('click', () => {
  localStorage.removeItem('stockmaster_user');
  currentUser = null;
  dom.loginOverlay.style.display = 'flex';
  dom.appLayout.style.display = 'none';
  showToast('Logged out.');
});

// -------------------------------------------------------------
// Navigation & Tab Switching
// -------------------------------------------------------------
function switchTab(tabId) {
  dom.navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  dom.tabContents.forEach((content) => content.classList.toggle('active', content.id === tabId));

  if (tabId === 'tab-dashboard') {
    dom.pageHeading.textContent = 'Dashboard Overview';
    dom.pageSubheading.textContent = 'Real-time stock, valuation, and sales metrics';
    loadDashboard();
  } else if (tabId === 'tab-products') {
    dom.pageHeading.textContent = 'Product Management';
    dom.pageSubheading.textContent = 'Manage catalog, pricing, and stock thresholds';
    loadCategories();
    loadProducts();
  } else if (tabId === 'tab-sales') {
    dom.pageHeading.textContent = 'Sales Management';
    dom.pageSubheading.textContent = 'Record sales, auto-calculate totals, and print receipts';
    loadSalesTab();
  } else if (tabId === 'tab-reports') {
    dom.pageHeading.textContent = 'Reports & Analytics';
    dom.pageSubheading.textContent = 'Generate, filter, and print comprehensive business reports';
    loadCurrentReport();
  }
}

dom.navBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

dom.btnGoToLowStock.addEventListener('click', () => {
  dom.productStatusFilter.value = 'low';
  switchTab('tab-products');
});

dom.btnGoToSales.addEventListener('click', () => {
  switchTab('tab-sales');
});

// -------------------------------------------------------------
// TAB 1: Dashboard
// -------------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const json = await res.json();
    if (!json.success) return;

    const { summary, today, recentSales, lowStockItems } = json.data;

    dom.dashTotalProducts.textContent = summary.total_products || 0;
    dom.dashTotalStock.textContent = Number(summary.total_stock || 0).toLocaleString();
    dom.dashStockValuation.textContent = formatCurrency(summary.total_sales_value);
    dom.dashCostValuation.textContent = `Cost: ${formatCurrency(summary.total_cost_value)}`;
    dom.dashTodaySales.textContent = formatCurrency(today.today_revenue);
    dom.dashTodayOrders.textContent = `${today.today_orders || 0} order(s) today`;
    dom.dashLowStockCount.textContent = summary.low_stock_count || 0;

    // Render low stock table
    if (lowStockItems && lowStockItems.length > 0) {
      dom.dashLowStockTableBody.innerHTML = lowStockItems
        .map((p) => `
          <tr>
            <td class="code-cell">${escapeHtml(p.product_code)}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td><span class="badge badge-pill">${escapeHtml(p.category)}</span></td>
            <td class="qty-cell"><span class="badge ${p.available_quantity === 0 ? 'badge-danger' : 'badge-warning'}">${p.available_quantity}</span></td>
            <td>${p.minimum_stock_level}</td>
          </tr>
        `)
        .join('');
    } else {
      dom.dashLowStockTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">All stock levels healthy!</td></tr>';
    }

    // Render recent sales table
    if (recentSales && recentSales.length > 0) {
      dom.dashRecentSalesTableBody.innerHTML = recentSales
        .map((s) => `
          <tr>
            <td class="code-cell">${escapeHtml(s.invoice_no)}</td>
            <td>${escapeHtml(s.customer_name)}</td>
            <td class="price-cell"><strong>${formatCurrency(s.total_amount)}</strong></td>
            <td>${formatDate(s.created_at)}</td>
          </tr>
        `)
        .join('');
    } else {
      dom.dashRecentSalesTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No sales recorded yet.</td></tr>';
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// -------------------------------------------------------------
// TAB 2: Product Management
// -------------------------------------------------------------
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success && json.data) {
      const selected = dom.productCategoryFilter.value;
      dom.productCategoryFilter.innerHTML =
        '<option value="ALL">All Categories</option>' +
        json.data.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      dom.productCategoryFilter.value = selected || 'ALL';

      dom.categoryList.innerHTML = json.data.map((c) => `<option value="${escapeHtml(c)}">`).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadProducts() {
  try {
    const search = dom.productSearchInput.value.trim();
    const category = dom.productCategoryFilter.value;
    const status = dom.productStatusFilter.value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'ALL') params.append('category', category);
    if (status && status !== 'all') params.append('status', status);

    const res = await fetch(`/api/products?${params.toString()}`);
    const json = await res.json();

    if (!json.success) {
      dom.productsTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">${escapeHtml(json.message)}</td></tr>`;
      return;
    }

    productsCache = json.data || [];
    renderProductsTable(productsCache);
  } catch (err) {
    dom.productsTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Error loading products.</td></tr>';
  }
}

function renderProductsTable(products) {
  dom.productTableCount.textContent = `Showing ${products.length} product(s)`;

  if (products.length === 0) {
    dom.productsTableBody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted py-4">No products found matching criteria.</td></tr>';
    return;
  }

  dom.productsTableBody.innerHTML = products
    .map((p) => {
      let badge = '<span class="badge badge-success">In Stock</span>';
      if (p.available_quantity === 0) {
        badge = '<span class="badge badge-danger">Out of Stock</span>';
      } else if (p.available_quantity <= p.minimum_stock_level) {
        badge = `<span class="badge badge-warning">Low Stock (≤ ${p.minimum_stock_level})</span>`;
      }

      return `
        <tr>
          <td class="code-cell">${escapeHtml(p.product_code)}</td>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            ${p.description ? `<br><small class="text-muted">${escapeHtml(p.description)}</small>` : ''}
          </td>
          <td><span class="badge badge-pill">${escapeHtml(p.category)}</span></td>
          <td class="price-cell">${formatCurrency(p.purchase_price)}</td>
          <td class="price-cell"><strong>${formatCurrency(p.sales_price)}</strong></td>
          <td class="qty-cell"><strong>${p.available_quantity}</strong></td>
          <td>${p.minimum_stock_level}</td>
          <td>${badge}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline" onclick="openEditProductModal(${p.id})">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="openDeleteProductModal(${p.id}, '${escapeHtml(p.name)}')">🗑️</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

// Search and filter listeners
dom.productSearchInput.addEventListener('input', () => {
  clearTimeout(window.searchTimer);
  window.searchTimer = setTimeout(loadProducts, 250);
});
dom.productCategoryFilter.addEventListener('change', loadProducts);
dom.productStatusFilter.addEventListener('change', loadProducts);

// Open Add Product Modal
dom.btnOpenAddProduct.addEventListener('click', () => {
  dom.productModalForm.reset();
  dom.modalProductId.value = '';
  dom.productDialogHeading.textContent = 'Add New Product';
  dom.modalProductCode.removeAttribute('readonly');
  dom.productDialog.showModal();
});

// Open Edit Product Modal
window.openEditProductModal = function (id) {
  const p = productsCache.find((item) => item.id === id);
  if (!p) return;

  dom.modalProductId.value = p.id;
  dom.productDialogHeading.textContent = `Edit Product: ${p.name}`;
  dom.modalProductCode.value = p.product_code;
  dom.modalProductName.value = p.name;
  dom.modalCategory.value = p.category;
  dom.modalPurchasePrice.value = p.purchase_price;
  dom.modalSalesPrice.value = p.sales_price;
  dom.modalQuantity.value = p.available_quantity;
  dom.modalMinStock.value = p.minimum_stock_level;
  dom.modalDescription.value = p.description || '';

  dom.productDialog.showModal();
};

// Save Product Form
dom.productModalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = dom.modalProductId.value;
  const isEdit = Boolean(id);

  const payload = {
    product_code: dom.modalProductCode.value.trim(),
    name: dom.modalProductName.value.trim(),
    category: dom.modalCategory.value.trim(),
    purchase_price: parseFloat(dom.modalPurchasePrice.value) || 0,
    sales_price: parseFloat(dom.modalSalesPrice.value) || 0,
    available_quantity: parseInt(dom.modalQuantity.value, 10) || 0,
    minimum_stock_level: parseInt(dom.modalMinStock.value, 10) || 5,
    description: dom.modalDescription.value.trim(),
  };

  try {
    const url = isEdit ? `/api/products/${id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      showToast(json.message, 'error');
      return;
    }

    showToast(json.message, 'success');
    dom.productDialog.close();
    loadProducts();
    loadCategories();
    loadDashboard();
  } catch (err) {
    showToast('Failed to save product.', 'error');
  }
});

// Delete Product Modal
window.openDeleteProductModal = function (id, name) {
  pendingDeleteId = id;
  dom.deleteTargetName.textContent = `"${name}"`;
  dom.deleteDialog.showModal();
};

dom.btnConfirmDelete.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  try {
    const res = await fetch(`/api/products/${pendingDeleteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) {
      showToast(json.message, 'error');
      return;
    }
    showToast(json.message, 'success');
    dom.deleteDialog.close();
    pendingDeleteId = null;
    loadProducts();
    loadCategories();
    loadDashboard();
  } catch (err) {
    showToast('Error deleting product.', 'error');
  }
});

// -------------------------------------------------------------
// TAB 3: Sales Management
// -------------------------------------------------------------
async function loadSalesTab() {
  await loadProductSelector();
  await loadSalesHistory();
}

async function loadProductSelector() {
  try {
    const res = await fetch('/api/products');
    const json = await res.json();
    if (!json.success) return;

    productsCache = json.data || [];
    dom.saleProductSelect.innerHTML =
      '<option value="">-- Choose a product --</option>' +
      productsCache
        .filter((p) => p.available_quantity > 0)
        .map(
          (p) =>
            `<option value="${p.id}" data-price="${p.sales_price}" data-stock="${p.available_quantity}">
              ${escapeHtml(p.product_code)} - ${escapeHtml(p.name)} (Stock: ${p.available_quantity} | Price: ₹${p.sales_price})
            </option>`
        )
        .join('');

    updateSaleCalculation();
  } catch (err) {
    console.error(err);
  }
}

function updateSaleCalculation() {
  const selectedOption = dom.saleProductSelect.options[dom.saleProductSelect.selectedIndex];
  if (!selectedOption || !selectedOption.value) {
    dom.saleProductStockHint.textContent = 'Choose product to view stock and sales price';
    dom.saleCalculatedTotal.value = '₹0.00';
    dom.saleQuantity.max = 1;
    return;
  }

  const stock = parseInt(selectedOption.getAttribute('data-stock'), 10) || 0;
  const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
  const qty = parseInt(dom.saleQuantity.value, 10) || 1;

  dom.saleQuantity.max = stock;
  dom.saleProductStockHint.innerHTML = `Available in stock: <strong>${stock} units</strong> | Unit Sales Price: <strong>₹${price.toFixed(2)}</strong>`;

  const total = qty * price;
  dom.saleCalculatedTotal.value = formatCurrency(total);
}

dom.saleProductSelect.addEventListener('change', updateSaleCalculation);
dom.saleQuantity.addEventListener('input', () => {
  const selectedOption = dom.saleProductSelect.options[dom.saleProductSelect.selectedIndex];
  if (selectedOption && selectedOption.value) {
    const stock = parseInt(selectedOption.getAttribute('data-stock'), 10) || 0;
    if (parseInt(dom.saleQuantity.value, 10) > stock) {
      dom.saleQuantity.value = stock;
    }
  }
  updateSaleCalculation();
});

// Create Sale Form Submission
dom.newSaleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const productId = dom.saleProductSelect.value;
  const quantity = parseInt(dom.saleQuantity.value, 10);
  const customerName = dom.saleCustomerName.value.trim() || 'Walk-in Customer';
  const paymentMethod = dom.salePaymentMethod.value;
  const notes = dom.saleNotes.value.trim();

  if (!productId || quantity <= 0) {
    showToast('Please select a product and valid quantity.', 'error');
    return;
  }

  const payload = {
    customer_name: customerName,
    payment_method: paymentMethod,
    notes,
    items: [
      {
        product_id: productId,
        quantity,
      },
    ],
  };

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      showToast(json.message, 'error');
      return;
    }

    showToast(`Sale completed! Invoice: ${json.invoice_no}`, 'success');
    dom.newSaleForm.reset();
    dom.saleCustomerName.value = 'Walk-in Customer';

    // Refresh view
    await loadSalesTab();
    loadDashboard();

    // Open receipt modal automatically
    viewInvoice(json.sale_id);
  } catch (err) {
    showToast('Error recording sale.', 'error');
  }
});

// Sales History List
async function loadSalesHistory() {
  try {
    const res = await fetch('/api/sales');
    const json = await res.json();
    if (!json.success) return;

    salesCache = json.data || [];
    if (salesCache.length === 0) {
      dom.salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No sales records found.</td></tr>';
      return;
    }

    dom.salesTableBody.innerHTML = salesCache
      .map(
        (s) => `
        <tr>
          <td class="code-cell">${escapeHtml(s.invoice_no)}</td>
          <td>${formatDate(s.created_at)}</td>
          <td><strong>${escapeHtml(s.customer_name)}</strong></td>
          <td><span class="badge badge-pill">${escapeHtml(s.payment_method)}</span></td>
          <td class="price-cell"><strong>${formatCurrency(s.total_amount)}</strong></td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline" onclick="viewInvoice(${s.id})">👁️ View / Print</button>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
}

// View / Print Invoice Modal
window.viewInvoice = async function (saleId) {
  try {
    const res = await fetch(`/api/sales/${saleId}`);
    const json = await res.json();
    if (!json.success) return;

    const sale = json.data;
    dom.invModalNumber.textContent = sale.invoice_no;
    dom.invModalDate.textContent = `Date: ${formatDate(sale.created_at)}`;
    dom.invModalCustomer.textContent = sale.customer_name;
    dom.invModalPayment.textContent = sale.payment_method;
    dom.invModalGrandTotal.textContent = formatCurrency(sale.total_amount);

    dom.invModalItemsBody.innerHTML = (sale.items || [])
      .map(
        (item) => `
        <tr>
          <td><strong>${escapeHtml(item.product_name)}</strong> <small class="text-muted">(${escapeHtml(item.product_code)})</small></td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.sales_price)}</td>
          <td class="text-right"><strong>${formatCurrency(item.subtotal)}</strong></td>
        </tr>
      `
      )
      .join('');

    dom.invoiceDialog.showModal();
  } catch (err) {
    showToast('Failed to load invoice.', 'error');
  }
};

// -------------------------------------------------------------
// TAB 4: Reports & Analytics
// -------------------------------------------------------------
dom.reportPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    dom.reportPills.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentReportType = pill.getAttribute('data-report');
    loadCurrentReport();
  });
});

dom.btnApplyDateFilter.addEventListener('click', loadCurrentReport);
dom.btnResetDateFilter.addEventListener('click', () => {
  dom.reportStartDate.value = '';
  dom.reportEndDate.value = '';
  loadCurrentReport();
});

dom.btnPrintReport.addEventListener('click', () => {
  window.print();
});

async function loadCurrentReport() {
  const startDate = dom.reportStartDate.value;
  const endDate = dom.reportEndDate.value;
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  dom.reportGeneratedTime.textContent = `Generated: ${new Date().toLocaleString('en-IN')}`;
  dom.reportSummaryCards.innerHTML = '';

  try {
    if (currentReportType === 'products') {
      dom.reportDisplayTitle.textContent = '1. Product Catalog Report';
      const res = await fetch(`/api/reports/products?${params.toString()}`);
      const json = await res.json();
      renderProductReport(json.data || []);
    } else if (currentReportType === 'stock') {
      dom.reportDisplayTitle.textContent = '2. Available Stock & Valuation Report';
      const res = await fetch(`/api/reports/stock?${params.toString()}`);
      const json = await res.json();
      renderStockReport(json.summary, json.data || []);
    } else if (currentReportType === 'low-stock') {
      dom.reportDisplayTitle.textContent = '3. Low Stock & Reorder Alert Report';
      const res = await fetch(`/api/reports/low-stock?${params.toString()}`);
      const json = await res.json();
      renderLowStockReport(json.data || []);
    } else if (currentReportType === 'daily-sales') {
      dom.reportDisplayTitle.textContent = '4. Daily Sales Performance Report';
      const res = await fetch(`/api/reports/daily-sales?${params.toString()}`);
      const json = await res.json();
      renderDailySalesReport(json.data || []);
    } else if (currentReportType === 'monthly-sales') {
      dom.reportDisplayTitle.textContent = '5. Monthly Sales Report';
      const res = await fetch(`/api/reports/monthly-sales?${params.toString()}`);
      const json = await res.json();
      renderMonthlySalesReport(json.data || []);
    } else if (currentReportType === 'movements') {
      dom.reportDisplayTitle.textContent = '6. Purchase & Stock Movement Audit Report';
      const res = await fetch(`/api/reports/movements?${params.toString()}`);
      const json = await res.json();
      renderMovementReport(json.data || []);
    }
  } catch (err) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Error loading report data.</td></tr>';
  }
}

function renderProductReport(data) {
  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Code</th>
      <th>Product Name</th>
      <th>Category</th>
      <th>Cost Price</th>
      <th>Sales Price</th>
      <th>Profit Margin</th>
      <th>Stock</th>
    </tr>
  `;
  if (data.length === 0) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No records found.</td></tr>';
    return;
  }
  dom.reportTableBody.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td class="code-cell">${escapeHtml(r.product_code)}</td>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(r.category)}</td>
      <td>${formatCurrency(r.purchase_price)}</td>
      <td><strong>${formatCurrency(r.sales_price)}</strong></td>
      <td><span class="badge badge-success">+${formatCurrency(r.margin)}</span></td>
      <td>${r.available_quantity}</td>
    </tr>
  `
    )
    .join('');
}

function renderStockReport(summary, data) {
  if (summary) {
    dom.reportSummaryCards.innerHTML = `
      <div class="report-sum-card">
        <span>Total Stocked Units</span>
        <strong>${Number(summary.total_units || 0).toLocaleString()}</strong>
      </div>
      <div class="report-sum-card">
        <span>Total Cost Valuation</span>
        <strong>${formatCurrency(summary.total_cost_valuation)}</strong>
      </div>
      <div class="report-sum-card">
        <span>Total Retail Valuation</span>
        <strong style="color: #2563eb;">${formatCurrency(summary.total_sales_valuation)}</strong>
      </div>
      <div class="report-sum-card">
        <span>Potential Gross Profit</span>
        <strong style="color: #059669;">${formatCurrency((summary.total_sales_valuation || 0) - (summary.total_cost_valuation || 0))}</strong>
      </div>
    `;
  }

  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Code</th>
      <th>Product Name</th>
      <th>Stock Level</th>
      <th>Status</th>
      <th>Cost Value</th>
      <th>Sales Value</th>
    </tr>
  `;

  dom.reportTableBody.innerHTML = data
    .map((r) => {
      let b = '<span class="badge badge-success">Healthy</span>';
      if (r.stock_status === 'Low Stock') b = '<span class="badge badge-warning">Low Stock</span>';
      if (r.stock_status === 'Out of Stock') b = '<span class="badge badge-danger">Out of Stock</span>';
      return `
      <tr>
        <td class="code-cell">${escapeHtml(r.product_code)}</td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td><strong>${r.available_quantity}</strong> (Min: ${r.minimum_stock_level})</td>
        <td>${b}</td>
        <td>${formatCurrency(r.cost_valuation)}</td>
        <td><strong>${formatCurrency(r.sales_valuation)}</strong></td>
      </tr>
    `;
    })
    .join('');
}

function renderLowStockReport(data) {
  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Code</th>
      <th>Product Name</th>
      <th>Category</th>
      <th>Current Stock</th>
      <th>Min Required</th>
      <th>Deficit Units</th>
      <th>Est. Reorder Cost</th>
    </tr>
  `;
  if (data.length === 0) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">🎉 No items are below minimum stock level!</td></tr>';
    return;
  }
  dom.reportTableBody.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td class="code-cell">${escapeHtml(r.product_code)}</td>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(r.category)}</td>
      <td><span class="badge ${r.available_quantity === 0 ? 'badge-danger' : 'badge-warning'}">${r.available_quantity}</span></td>
      <td>${r.minimum_stock_level}</td>
      <td><strong style="color: #dc2626;">-${r.deficit}</strong></td>
      <td>${formatCurrency(r.estimated_reorder_cost)}</td>
    </tr>
  `
    )
    .join('');
}

function renderDailySalesReport(data) {
  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Sale Date</th>
      <th>Orders Count</th>
      <th>Total Revenue</th>
      <th>Cost Amount</th>
      <th>Net Profit</th>
    </tr>
  `;
  if (data.length === 0) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No sales records in selected date range.</td></tr>';
    return;
  }
  dom.reportTableBody.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td><strong>${new Date(r.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></td>
      <td>${r.orders_count}</td>
      <td><strong>${formatCurrency(r.revenue)}</strong></td>
      <td>${formatCurrency(r.cost)}</td>
      <td><strong style="color: #059669;">${formatCurrency(r.profit)}</strong></td>
    </tr>
  `
    )
    .join('');
}

function renderMonthlySalesReport(data) {
  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Month</th>
      <th>Orders Completed</th>
      <th>Monthly Revenue</th>
      <th>Monthly Cost</th>
      <th>Gross Profit</th>
    </tr>
  `;
  if (data.length === 0) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No monthly sales recorded yet.</td></tr>';
    return;
  }
  dom.reportTableBody.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td><strong>${escapeHtml(r.sale_month)}</strong></td>
      <td>${r.orders_count}</td>
      <td><strong>${formatCurrency(r.revenue)}</strong></td>
      <td>${formatCurrency(r.cost)}</td>
      <td><strong style="color: #059669;">${formatCurrency(r.profit)}</strong></td>
    </tr>
  `
    )
    .join('');
}

function renderMovementReport(data) {
  dom.reportTableHead.innerHTML = `
    <tr>
      <th>Date & Time</th>
      <th>Product</th>
      <th>Movement Type</th>
      <th>Quantity</th>
      <th>Stock Change</th>
      <th>Reference</th>
    </tr>
  `;
  if (data.length === 0) {
    dom.reportTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No stock movements recorded yet.</td></tr>';
    return;
  }
  dom.reportTableBody.innerHTML = data
    .map((r) => {
      let b = '<span class="badge badge-success">PURCHASE</span>';
      if (r.type === 'SALE') b = '<span class="badge badge-danger">SALE</span>';
      if (r.type === 'ADJUSTMENT') b = '<span class="badge badge-warning">ADJUSTMENT</span>';

      return `
      <tr>
        <td>${formatDate(r.created_at)}</td>
        <td><strong>${escapeHtml(r.product_name)}</strong> <small class="text-muted">(${escapeHtml(r.product_code)})</small></td>
        <td>${b}</td>
        <td><strong>${r.quantity}</strong></td>
        <td>${r.previous_stock} → <strong>${r.new_stock}</strong></td>
        <td><code>${escapeHtml(r.reference_no || '--')}</code></td>
      </tr>
    `;
    })
    .join('');
}

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupDialogBackdrops();
  checkAuth();
});
