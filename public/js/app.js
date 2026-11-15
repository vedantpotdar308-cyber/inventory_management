/**
 * Simple Inventory Management - Frontend Controller
 * Plain HTML, CSS, JavaScript (ES6+)
 * Compatible with Node.js backend AND PHP/XAMPP backend
 */

let products = [];
let deleteId = null;

// DOM Elements
const el = {
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  warningBanner: document.getElementById('warningBanner'),

  dashTotalProducts: document.getElementById('dashTotalProducts'),
  dashTotalQty: document.getElementById('dashTotalQty'),
  dashTotalValue: document.getElementById('dashTotalValue'),

  searchInput: document.getElementById('searchInput'),
  btnOpenAddModal: document.getElementById('btnOpenAddModal'),
  tableBody: document.getElementById('productsTableBody'),

  productDialog: document.getElementById('productDialog'),
  productForm: document.getElementById('productForm'),
  modalHeading: document.getElementById('modalHeading'),
  editProductId: document.getElementById('editProductId'),
  inputName: document.getElementById('inputName'),
  inputCategory: document.getElementById('inputCategory'),
  inputPrice: document.getElementById('inputPrice'),
  inputQuantity: document.getElementById('inputQuantity'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnCancelModal: document.getElementById('btnCancelModal'),

  deleteDialog: document.getElementById('deleteDialog'),
  deleteTargetName: document.getElementById('deleteTargetName'),
  btnCancelDelete: document.getElementById('btnCancelDelete'),
  btnConfirmDelete: document.getElementById('btnConfirmDelete'),

  toast: document.getElementById('toastMessage'),
};

// Auto-detect backend (Node.js or PHP in XAMPP)
const isPhpMode = window.location.port !== '3000' || window.location.pathname.includes('/inventory');

function getApiUrl(action, id = null) {
  if (isPhpMode) {
    if (action === 'status') return 'api.php?action=status';
    if (action === 'quantity') return `api.php?action=quantity&id=${id}`;
    if (action === 'edit' || action === 'delete') return `api.php?id=${id}`;
    return 'api.php';
  } else {
    if (action === 'status') return '/api/status';
    if (action === 'quantity') return `/api/products/${id}/quantity`;
    if (action === 'edit' || action === 'delete') return `/api/products/${id}`;
    return '/api/products';
  }
}

// Format currency in Indian Rupees (₹)
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// Show simple toast alert
function showToast(text) {
  if (!el.toast) return;
  el.toast.textContent = text;
  el.toast.classList.add('show');
  setTimeout(() => el.toast.classList.remove('show'), 3000);
}

// -------------------------------------------------------------
// Database Status
// -------------------------------------------------------------
async function checkStatus() {
  try {
    const res = await fetch(getApiUrl('status'));
    const data = await res.json();
    if (data.online) {
      el.statusDot.className = 'status-dot online';
      el.statusLabel.textContent = 'MySQL Connected';
      el.warningBanner.style.display = 'none';
      return true;
    } else {
      el.statusDot.className = 'status-dot offline';
      el.statusLabel.textContent = 'MySQL Offline';
      el.warningBanner.style.display = 'block';
      return false;
    }
  } catch (err) {
    el.statusDot.className = 'status-dot offline';
    el.statusLabel.textContent = 'Server Offline';
    el.warningBanner.style.display = 'block';
    return false;
  }
}

// -------------------------------------------------------------
// Fetch & Render Products + Dashboard
// -------------------------------------------------------------
async function loadInventory() {
  try {
    const res = await fetch(getApiUrl('list'));
    const data = await res.json();

    if (!data.success) {
      el.tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">${data.message}</td></tr>`;
      return;
    }

    products = data.products || [];

    // 1. Update Dashboard
    el.dashTotalProducts.textContent = data.stats.totalProducts;
    el.dashTotalQty.textContent = Number(data.stats.totalQuantity).toLocaleString();
    el.dashTotalValue.textContent = formatCurrency(data.stats.totalValue);

    // 2. Render Table
    renderTable(products);
  } catch (err) {
    el.tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">Could not load products. Please check MySQL in XAMPP.</td></tr>`;
  }
}

function renderTable(list) {
  const query = el.searchInput.value.trim().toLowerCase();
  const filtered = list.filter((p) =>
    p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    el.tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="loading-cell">No products found. Click "+ Add Product" to add one!</td>
      </tr>
    `;
    return;
  }

  el.tableBody.innerHTML = filtered
    .map((p) => {
      const totalVal = (Number(p.price) || 0) * (Number(p.quantity) || 0);
      const isZero = p.quantity === 0;

      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td><span class="category-pill">${escapeHtml(p.category)}</span></td>
          <td class="price-text">${formatCurrency(p.price)}</td>
          <td>
            <div class="qty-control">
              <button class="qty-btn" title="Decrease stock by 1" onclick="changeQuantity(${p.id}, -1)">−</button>
              <span class="qty-number ${isZero ? 'empty-stock' : ''}">${p.quantity}</span>
              <button class="qty-btn" title="Increase stock by 1" onclick="changeQuantity(${p.id}, 1)">+</button>
            </div>
          </td>
          <td class="total-value-text">${formatCurrency(totalVal)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-edit" onclick="openEditModal(${p.id})">✏️ Edit</button>
            <button class="btn btn-sm btn-delete" onclick="openDeleteModal(${p.id}, '${escapeHtml(p.name)}')">🗑️ Remove</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

// -------------------------------------------------------------
// Change Product Quantity (Stock Increase / Decrease)
// -------------------------------------------------------------
window.changeQuantity = async function (id, change) {
  try {
    const res = await fetch(getApiUrl('quantity', id), {
      method: isPhpMode ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change }),
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message);
      return;
    }

    loadInventory();
  } catch (err) {
    showToast('Failed to update quantity');
  }
};

// -------------------------------------------------------------
// Add / Edit Product Modal
// -------------------------------------------------------------
function openAddModal() {
  el.productForm.reset();
  el.editProductId.value = '';
  el.modalHeading.textContent = 'Add New Product';
  el.productDialog.showModal();
}

window.openEditModal = function (id) {
  const item = products.find((p) => p.id === id);
  if (!item) return;

  el.editProductId.value = item.id;
  el.modalHeading.textContent = 'Edit Product';
  el.inputName.value = item.name;
  el.inputCategory.value = item.category;
  el.inputPrice.value = item.price;
  el.inputQuantity.value = item.quantity;

  el.productDialog.showModal();
};

el.productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = el.editProductId.value;
  const isEdit = Boolean(id);

  const payload = {
    name: el.inputName.value.trim(),
    category: el.inputCategory.value.trim(),
    price: parseFloat(el.inputPrice.value) || 0,
    quantity: parseInt(el.inputQuantity.value, 10) || 0,
  };

  try {
    const url = isEdit ? getApiUrl('edit', id) : getApiUrl('add');
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message);
      return;
    }

    showToast(data.message);
    el.productDialog.close();
    loadInventory();
  } catch (err) {
    showToast('Error saving product');
  }
});

// -------------------------------------------------------------
// Remove Product Modal
// -------------------------------------------------------------
window.openDeleteModal = function (id, name) {
  deleteId = id;
  el.deleteTargetName.textContent = `"${name}"`;
  el.deleteDialog.showModal();
};

el.btnConfirmDelete.addEventListener('click', async () => {
  if (!deleteId) return;

  try {
    const res = await fetch(getApiUrl('delete', deleteId), { method: 'DELETE' });
    const data = await res.json();

    if (!data.success) {
      showToast(data.message);
      return;
    }

    showToast('Product removed!');
    el.deleteDialog.close();
    deleteId = null;
    loadInventory();
  } catch (err) {
    showToast('Error removing product');
  }
});

// -------------------------------------------------------------
// Setup Dialogs & Backdrop Fallback
// -------------------------------------------------------------
function setupModals() {
  el.btnOpenAddModal.addEventListener('click', openAddModal);
  el.btnCloseModal.addEventListener('click', () => el.productDialog.close());
  el.btnCancelModal.addEventListener('click', () => el.productDialog.close());
  el.btnCancelDelete.addEventListener('click', () => el.deleteDialog.close());

  // Light-dismiss fallback for browsers without native <dialog closedby> support
  [el.productDialog, el.deleteDialog].forEach((dialog) => {
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
// Initialize App
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  setupModals();

  el.searchInput.addEventListener('input', () => {
    renderTable(products);
  });

  await checkStatus();
  await loadInventory();
});
