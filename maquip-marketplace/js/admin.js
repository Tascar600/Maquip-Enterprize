let currentAdmin = null;
let uploadedImages = [];
let editingProductId = null;
let deleteTargetId = null;

function showLogin() { $('#loginPage').style.display = 'flex'; $('#adminPanel').style.display = 'none'; }
function showPanel() { $('#loginPage').style.display = 'none'; $('#adminPanel').style.display = 'block'; }

function checkAuth() {
  const session = sessionStorage.getItem('maquip_session');
  if (session !== 'authenticated') { showLogin(); return; }
  const stored = sessionStorage.getItem('maquip_admin');
  currentAdmin = stored ? JSON.parse(stored) : { email: ADMIN_EMAIL, company: 'Maquip Enterprise' };
  showPanel(); initAdminPanel();
}

function initLogin() {
  const btn = $('#loginBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const username = $('#loginUsername').value.trim();
      const password = $('#loginPassword').value.trim();
      const err = $('#loginError');
      if (!username || !password) { if (err) { err.textContent = 'Please enter email and password.'; err.style.display = 'block'; } return; }
      if (username === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        sessionStorage.setItem('maquip_session', 'authenticated');
        sessionStorage.setItem('maquip_admin', JSON.stringify({ email: ADMIN_EMAIL, company: 'Maquip Enterprise' }));
        currentAdmin = { email: ADMIN_EMAIL, company: 'Maquip Enterprise' };
        showPanel(); initAdminPanel();
        if (err) err.style.display = 'none';
        showToast('Welcome back!', 'success');
      } else {
        if (err) { err.textContent = 'Invalid credentials.'; err.style.display = 'block'; }
      }
    });
  }
  $('#loginPassword')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn?.click(); });
  $('#loginUsername')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn?.click(); });
}

function initLogout() {
  $('#logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('maquip_session');
    sessionStorage.removeItem('maquip_admin');
    currentAdmin = null;
    window.location.href = 'index.html';
  });
}

function initTabs() {
  $$('.admin-sidebar a[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.admin-sidebar a[data-tab]').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      $$('.tab-content').forEach(t => t.classList.remove('active'));
      const tab = $('#tab-' + link.dataset.tab);
      if (tab) tab.classList.add('active');
      switch (link.dataset.tab) {
        case 'dashboard': renderDashboard(); break;
        case 'products': renderProductsTable(); break;
        case 'orders': renderOrdersTable(); renderOrderStats(); break;
        case 'queries': renderQueriesTable(); break;
      }
    });
  });
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'add-product') {
    const link = document.querySelector('[data-tab="add-product"]');
    if (link) link.click();
  }
}

async function renderDashboard() {
  let stats;
  try { stats = await DataStore.getStats(); } catch { return; }
  const grid = $('#statsGrid');
  if (!grid) return;
  $('#dashboardDate').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const statCards = [
    { icon:'📦', label:'Total Products', value:stats.totalProducts, color:'#11998E' },
    { icon:'📁', label:'Categories', value:stats.totalCategories, color:'#2D1B69' },
    { icon:'⭐', label:'Featured', value:stats.featuredCount, color:'#F2994A' },
    { icon:'📋', label:'Total Orders', value:stats.totalOrders, color:'#3498db' },
    { icon:'👥', label:'Customers', value:stats.totalCustomers, color:'#e74c3c' },
    { icon:'💰', label:'Revenue', value:formatPrice(stats.totalRevenue), color:'#27ae60' },
    { icon:'💬', label:'Queries', value:stats.totalQueries, color:'#9b59b6' },
    { icon:'📮', label:'Unread Queries', value:stats.unreadQueries, color:'#f39c12' },
  ];
  grid.innerHTML = statCards.map(s => '<div class="stat-card"><div class="stat-icon" style="background:' + s.color + '15;color:' + s.color + ';">' + s.icon + '</div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div>').join('');

  const tbody = $('#recentProductsTable');
  if (tbody) {
    let recent;
    try { recent = await DataStore.getRecentProducts(8); } catch { return; }
    tbody.innerHTML = recent.map(p => '<tr><td><div style="display:flex;align-items:center;gap:10px;">' +
      (p.images && p.images[0] ? '<img src="' + p.images[0] + '" class="product-thumb">' : '<div class="product-thumb-placeholder">' + getCategoryIcon(p.category) + '</div>') +
      '<span style="font-weight:600;">' + (p.name.length > 30 ? p.name.substring(0,30)+'...' : p.name) + '</span></div></td>' +
      '<td>' + getCategoryName(p.category) + '</td><td>' + formatPrice(p.price) + '</td><td>' + p.stock + '</td><td>' + (p.featured ? '⭐' : '—') + '</td></tr>').join('');
  }
}

async function renderProductsTable() {
  const tbody = $('#productsTableBody');
  if (!tbody) return;
  const search = ($('#adminProductSearch')?.value || '').toLowerCase();
  let products;
  try { products = await DataStore.getProducts(); } catch { return; }
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search) || getCategoryName(p.category).toLowerCase().includes(search));
  if (products.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light);">No products found</td></tr>'; return; }
  tbody.innerHTML = products.map(p => '<tr><td>' +
    (p.images && p.images[0] ? '<img src="' + p.images[0] + '" class="product-thumb">' : '<div class="product-thumb-placeholder">' + getCategoryIcon(p.category) + '</div>') +
    '</td><td><span style="font-weight:600;">' + p.name + '</span></td><td>' + getCategoryName(p.category) + '</td><td>' + formatPrice(p.price) + '</td><td>' + p.stock + '</td><td>' + (p.featured ? '✅' : '—') + '</td>' +
    '<td><div class="actions"><button class="btn-view" onclick="viewProduct(\'' + p.id + '\')">View</button>' +
    '<button class="btn-edit" onclick="editProduct(\'' + p.id + '\')">Edit</button>' +
    '<button class="btn-delete" onclick="confirmDelete(\'' + p.id + '\')">Delete</button></div></td></tr>').join('');
}

function viewProduct(id) { window.open('product.html?id=' + id, '_blank'); }

async function confirmDelete(id) {
  deleteTargetId = id;
  let product;
  try { product = await DataStore.getProduct(id); } catch {}
  $('#confirmTitle').textContent = 'Delete Product?';
  $('#confirmMessage').textContent = 'Are you sure you want to delete "' + (product?.name || 'this product') + '"? This action cannot be undone.';
  $('#confirmDeleteBtn').onclick = async () => {
    if (deleteTargetId) {
      try { await DataStore.deleteProduct(deleteTargetId); showToast('Product deleted successfully', 'success'); } catch { showToast('Failed to delete', 'error'); }
      deleteTargetId = null; closeConfirm();
      await renderProductsTable(); await renderDashboard();
    }
  };
  $('#confirmModal').classList.add('active');
}

function closeConfirm() { $('#confirmModal').classList.remove('active'); deleteTargetId = null; }

function initImageUpload() {
  const area = $('#imageUploadArea'), input = $('#imageInput');
  if (!area || !input) return;
  area.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => { handleFiles(e.target.files); });
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => { e.preventDefault(); area.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
}

function handleFiles(files) {
  const maxSize = 5 * 1024 * 1024;
  for (const file of files) {
    if (file.size > maxSize) { showToast(file.name + ' is too large (max 5MB)', 'error'); continue; }
    if (!file.type.startsWith('image/')) { showToast(file.name + ' is not a valid image', 'error'); continue; }
    const reader = new FileReader();
    reader.onload = (e) => { uploadedImages.push(e.target.result); renderImagePreviews(); };
    reader.readAsDataURL(file);
  }
}

function renderImagePreviews() {
  const container = $('#imagePreviewContainer'); if (!container) return;
  container.innerHTML = uploadedImages.map((img,i) => '<div class="image-preview-item"><img src="' + img + '" alt="Preview ' + (i+1) + '"><button class="remove-image" onclick="removeImage(' + i + ')">✕</button></div>').join('');
}

function removeImage(index) { uploadedImages.splice(index, 1); renderImagePreviews(); }

function addSpecRow() {
  const container = $('#specsContainer');
  const div = document.createElement('div'); div.className = 'spec-entry';
  div.innerHTML = '<input type="text" class="spec-key" placeholder="Specification name"><input type="text" class="spec-value" placeholder="Value"><button type="button" class="remove-spec" onclick="this.parentElement.remove()">✕</button>';
  container.appendChild(div);
}

function initProductForm() {
  const form = $('#productForm'); if (!form) return;
  const catSelect = $('#prodCategory');
  if (catSelect) CATEGORIES.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.icon + ' ' + c.name; catSelect.appendChild(opt); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#prodName').value.trim(), category = $('#prodCategory').value, description = $('#prodDescription').value.trim();
    const price = parseFloat($('#prodPrice').value), stock = parseInt($('#prodStock').value), featured = $('#prodFeatured').checked;
    if (!name || !category || !description || isNaN(price) || isNaN(stock)) { showToast('Please fill in all required fields', 'error'); return; }
    const specs = {};
    $$('.spec-entry').forEach(entry => { const k = entry.querySelector('.spec-key')?.value?.trim(); const v = entry.querySelector('.spec-value')?.value?.trim(); if (k && v) specs[k] = v; });
    const productData = { name, category, description, price, stock, featured: featured ? 1 : 0, specs: Object.keys(specs).length > 0 ? specs : {}, images: uploadedImages };
    try {
      if (editingProductId) {
        await DataStore.updateProduct(editingProductId, productData);
        showToast('Product updated successfully!', 'success');
        editingProductId = null; $('#submitProductBtn').textContent = 'Add Product →';
        const ei = $('#editProductId'); if (ei) ei.style.display = 'none';
      } else {
        await DataStore.addProduct(productData);
        showToast('Product added successfully!', 'success');
      }
    } catch (err) { showToast('Failed to save product: ' + (err.message || 'Unknown error'), 'error'); return; }
    resetProductForm(); await renderProductsTable(); await renderDashboard();
  });
}

function resetProductForm() {
  $('#productForm')?.reset();
  uploadedImages = []; renderImagePreviews();
  editingProductId = null; $('#submitProductBtn').textContent = 'Add Product →';
  const ei = $('#editProductId'); if (ei) ei.style.display = 'none';
  const specContainer = $('#specsContainer');
  if (specContainer) {
    specContainer.innerHTML = '<div class="spec-entry"><input type="text" class="spec-key" placeholder="e.g. Processor"><input type="text" class="spec-value" placeholder="e.g. Intel Core i5"></div><div class="spec-entry"><input type="text" class="spec-key" placeholder="e.g. RAM"><input type="text" class="spec-value" placeholder="e.g. 16GB"></div>';
  }
}

async function editProduct(id) {
  let product;
  try { product = await DataStore.getProduct(id); } catch { showToast('Product not found', 'error'); return; }
  if (!product) return;
  editingProductId = id;
  $('#prodName').value = product.name; $('#prodCategory').value = product.category;
  $('#prodDescription').value = product.description; $('#prodPrice').value = product.price;
  $('#prodStock').value = product.stock; $('#prodFeatured').checked = product.featured;
  $('#submitProductBtn').textContent = 'Update Product →';
  const ei = $('#editProductId'); if (ei) { ei.style.display = 'inline'; ei.textContent = 'Editing: ' + product.name; }
  const specContainer = $('#specsContainer');
  if (specContainer && product.specs && typeof product.specs === 'object') {
    const entries = Object.entries(product.specs);
    if (entries.length > 0) specContainer.innerHTML = entries.map(([k,v]) => '<div class="spec-entry"><input type="text" class="spec-key" value="' + k.replace(/"/g,'&quot;') + '" placeholder="Specification name"><input type="text" class="spec-value" value="' + v.replace(/"/g,'&quot;') + '" placeholder="Value"><button type="button" class="remove-spec" onclick="this.parentElement.remove()">✕</button></div>').join('');
  }
  uploadedImages = product.images ? [...product.images] : []; renderImagePreviews();
  document.querySelector('[data-tab="add-product"]')?.classList.add('active');
  $$('.admin-sidebar a[data-tab]').forEach(l => l.classList.remove('active'));
  $$('.tab-content').forEach(t => t.classList.remove('active'));
  const tab = $('#tab-add-product'); if (tab) tab.classList.add('active');
  showToast('Editing product — make your changes and save', 'info');
}

function initSettings() {
  const form = $('#settingsForm');
  if (form) {
    (async () => {
      try {
        const s = await DataStore.getSettings();
        $('#setCompany').value = s.company || '';
        $('#setEmail').value = s.email || '';
        $('#setPhone').value = s.phone || '';
        $('#setAbout').value = s.about || '';
      } catch {}
    })();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { company:$('#setCompany').value.trim(), email:$('#setEmail').value.trim(), phone:$('#setPhone').value.trim(), about:$('#setAbout').value.trim() };
      try { await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); showToast('Settings saved successfully!', 'success'); }
      catch { showToast('Failed to save settings', 'error'); }
    });
  }
  const pwForm = $('#passwordForm');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showToast('Admin credentials updated', 'info');
      $('#setPassword').value = '';
    });
  }
}

function initAdminSearch() { $('#adminProductSearch')?.addEventListener('input', renderProductsTable); }

async function renderOrdersTable() {
  const tbody = $('#ordersTableBody'); if (!tbody) return;
  const filter = ($('#orderStatusFilter')?.value || 'all');
  let orders;
  try { orders = await DataStore.getOrders(); } catch { return; }
  if (filter !== 'all') orders = orders.filter(o => o.status === filter);
  orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (orders.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light);">No orders found</td></tr>'; return; }
  tbody.innerHTML = orders.map(o => {
    const items = o.items || [];
    return '<tr><td><span style="font-weight:700;font-size:12px;">' + o.id + '</span></td>' +
      '<td><div style="font-weight:600;font-size:13px;">' + (o.customer_name || '') + '</div><div style="font-size:11px;color:var(--text-light);">' + (o.customer_email || '') + '</div><div style="font-size:11px;color:var(--text-light);">' + (o.customer_phone || '') + '</div></td>' +
      '<td>' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '</td>' +
      '<td>' + formatPrice(o.total) + '</td>' +
      '<td style="font-size:12px;"><div>' + (o.delivery_method === 'collection' ? '🏪 Collection' : '🚚 Delivery') + '</div>' + ((o.delivery_fee === 0 || o.delivery_fee == 0) ? '<span style="color:#27ae60;">Free</span>' : formatPrice(o.delivery_fee)) + '</td>' +
      '<td><span class="order-status status-' + o.status + '">' + formatStatus(o.status) + '</span></td>' +
      '<td style="font-size:11px;color:var(--text-light);">' + new Date(o.createdAt).toLocaleDateString() + '</td>' +
      '<td><select onchange="updateOrderStatus(\'' + o.id + '\',this.value)" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:11px;background:var(--bg-card);color:var(--text);font-family:var(--font);">' +
      ORDER_STATUSES.map(s => '<option value="' + s + '" ' + (s===o.status?'selected':'') + '>' + formatStatus(s) + '</option>').join('') + '</select></td></tr>';
  }).join('');
}

async function updateOrderStatus(orderId, status) {
  try { await DataStore.updateOrderStatus(orderId, status); showToast('Order ' + orderId + ' updated to ' + formatStatus(status), 'success'); } catch { showToast('Failed to update order', 'error'); }
  await renderOrdersTable(); await renderOrderStats(); await renderDashboard();
}

async function renderOrderStats() {
  const grid = $('#orderStatsGrid'); if (!grid) return;
  let orders;
  try { orders = await DataStore.getOrders(); } catch { return; }
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + (parseFloat(o.total)||0), 0);
  grid.innerHTML = [
    { icon:'📋', label:'Total Orders', value:orders.length, color:'#11998E' },
    { icon:'⏳', label:'Pending', value:orders.filter(o=>o.status==='pending').length, color:'#f39c12' },
    { icon:'✅', label:'Delivered', value:orders.filter(o=>o.status==='delivered').length, color:'#27ae60' },
    { icon:'💰', label:'Total Revenue', value:formatPrice(totalRevenue), color:'#2D1B69' }
  ].map(s => '<div class="stat-card"><div class="stat-icon" style="background:' + s.color + '15;color:' + s.color + ';">' + s.icon + '</div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div>').join('');
}

function initOrderFilters() { $('#orderStatusFilter')?.addEventListener('change', () => { renderOrdersTable(); renderOrderStats(); }); }

function initAdminTheme() {
  const toggle = $('#adminThemeToggle');
  document.documentElement.setAttribute('data-theme', 'dark');
  if (toggle) {
    toggle.textContent = '☀️';
    toggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      toggle.textContent = next === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('maquip_theme', next);
    });
  }
}

async function renderQueriesTable() {
  const tbody = $('#queriesTableBody'); if (!tbody) return;
  const filter = ($('#queryStatusFilter')?.value || 'all');
  let queries;
  try { queries = await DataStore.getQueries(); } catch { return; }
  queries.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (filter !== 'all') queries = queries.filter(q => q.status === filter);
  if (queries.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-light);">No queries found</td></tr>'; return; }
  tbody.innerHTML = queries.map((q,i) => {
    const num = i + 1;
    return '<tr class="' + (q.status === 'unread' ? 'query-unread' : '') + '">' +
      '<td><span style="font-weight:700;">#' + num + '</span></td>' +
      '<td><div style="font-weight:600;">' + q.name + '</div><div style="font-size:11px;color:var(--text-light);">' + (q.email || '') + '</div></td>' +
      '<td style="max-width:300px;"><div style="' + (q.status === 'unread' ? 'font-weight:600;' : '') + 'font-size:13px;word-break:break-word;">' + (q.message || '').substring(0, 120) + (q.message && q.message.length > 120 ? '...' : '') + '</div></td>' +
      '<td style="font-size:11px;color:var(--text-light);">' + new Date(q.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '</td>' +
      '<td><div class="actions">' +
      (q.status === 'unread' ? '<button class="btn-view" onclick="markQueryRead(\'' + q.id + '\')" title="Mark as read">✓</button>' : '') +
      '<button class="btn-delete" onclick="deleteQuery(\'' + q.id + '\')" title="Delete">✕</button></div></td></tr>';
  }).join('');
}

async function markQueryRead(id) {
  try { await DataStore.markQueryRead(id); } catch {}
  renderQueriesTable(); renderDashboard();
}

async function deleteQuery(id) {
  try { await DataStore.deleteQuery(id); showToast('Query deleted', 'info'); } catch {}
  renderQueriesTable(); renderDashboard();
}

function initQueryFilters() { $('#queryStatusFilter')?.addEventListener('change', renderQueriesTable); }

async function initAdminPanel() {
  await renderDashboard(); await renderProductsTable(); await renderQueriesTable();
  initTabs(); initImageUpload(); initProductForm(); initSettings();
  initAdminSearch(); initOrderFilters(); initQueryFilters();
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  initLogout();
  initLogin();
  checkAuth();
});
