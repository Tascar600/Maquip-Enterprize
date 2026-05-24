function getCustomerSession() {
  const id = sessionStorage.getItem('maquip_customer_session');
  if (!id) return null;
  try { return JSON.parse(sessionStorage.getItem('maquip_customer_data')); } catch { return null; }
}
function isCustomerLoggedIn() { return !!sessionStorage.getItem('maquip_customer_session'); }

function initTheme() {
  const toggle = $('#themeToggle');
  const stored = localStorage.getItem('maquip_theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  if (toggle) {
    toggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    toggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      toggle.textContent = next === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('maquip_theme', next);
    });
  }
}

function initNavbar() {
  const navbar = $('#navbar');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 50), { passive: true });
}

function initMobileMenu() {
  const toggle = $('#menuToggle'), menu = $('#mobileMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
  }
}

function initSearchOverlay() {
  const toggle = $('#searchToggle'), overlay = $('#searchOverlay'), close = $('#searchClose');
  const input = $('#globalSearch'), results = $('#searchResults');
  if (toggle && overlay) {
    toggle.addEventListener('click', () => { overlay.classList.add('active'); setTimeout(() => input?.focus(), 100); });
    if (close) close.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    if (input && results) {
      input.addEventListener('input', async () => {
        const q = input.value.trim();
        if (q.length < 1) { results.innerHTML = ''; return; }
        try {
          const matches = await DataStore.searchProducts(q);
          if (matches.length === 0) { results.innerHTML = '<p style="color:var(--text-light);font-size:14px;padding:12px;">No products found</p>'; return; }
          results.innerHTML = matches.slice(0, 8).map(p => `
            <a href="product.html?id=${p.id}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;color:var(--text);text-decoration:none;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
              <span style="font-size:24px;">${getCategoryIcon(p.category)}</span>
              <div style="flex:1;"><div style="font-weight:600;font-size:14px;">${p.name}</div><div style="font-size:12px;color:var(--text-light);">${getCategoryName(p.category)} — ${formatPrice(p.price)}</div></div>
            </a>`).join('');
        } catch { results.innerHTML = '<p style="color:var(--text-light);font-size:14px;padding:12px;">Search error</p>'; }
      });
    }
  }
}

function initParticles() {
  const container = $('#particles'); if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
    p.style.animationDuration = (10 + Math.random() * 20) + 's';
    p.style.animationDelay = (Math.random() * 20) + 's';
    container.appendChild(p);
  }
}

async function renderCategories() {
  const grid = $('#categoriesGrid'); if (!grid) return;
  try {
    const allProducts = await DataStore.getProducts();
    grid.innerHTML = CATEGORIES.map(c => {
      const count = allProducts.filter(p => p.category === c.id).length;
      return '<div class="category-card" onclick="window.location=\'products.html?category=' + c.id + '\'">' +
        '<span class="cat-icon">' + c.icon + '</span><div class="cat-name">' + c.name + '</div>' +
        '<div class="cat-count">' + count + ' product' + (count !== 1 ? 's' : '') + '</div></div>';
    }).join('');
  } catch { grid.innerHTML = ''; }
}

function openAuthModal() { const modal = $('#authModal'); if (modal) modal.classList.add('active'); }

function switchAuthTab(tab) {
  $$('.auth-tab').forEach(t => t.classList.remove('active'));
  $$('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector('.auth-tab[data-auth="' + tab + '"]')?.classList.add('active');
  document.querySelector('#' + tab + 'Form')?.classList.add('active');
}

function initAuthModal() {
  const modal = $('#authModal'), close = $('#authModalClose');
  if (close) close.addEventListener('click', () => modal?.classList.remove('active'));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  $$('.auth-tab').forEach(tab => { tab.addEventListener('click', () => switchAuthTab(tab.dataset.auth)); });

  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim(), password = $('#loginPassword').value.trim();
    const err = $('#loginError');
    if (!email || !password) { if (err) { err.textContent = 'Please enter email and password.'; err.style.display = 'block'; } return; }
    try {
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        sessionStorage.setItem('maquip_session', 'authenticated');
        sessionStorage.setItem('maquip_admin', JSON.stringify({ email: ADMIN_EMAIL, company: 'Maquip Enterprise' }));
        modal?.classList.remove('active');
        showToast('Welcome Admin!', 'success');
        window.location.href = 'admin.html';
        return;
      }
      const customer = await DataStore.authenticateCustomer(email, password);
      if (!customer) throw new Error('Invalid email or password');
      sessionStorage.setItem('maquip_customer_session', customer.id);
      sessionStorage.setItem('maquip_customer_data', JSON.stringify(customer));
      modal?.classList.remove('active'); $('#loginForm').reset();
      if (err) err.style.display = 'none';
      await updateCustomerBar(); await updateCartBadge();
      showToast('Welcome back, ' + customer.name + '!', 'success');
    } catch (e) { if (err) { err.textContent = e.message || 'Login failed.'; err.style.display = 'block'; } }
  });

  $('#registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#regName').value.trim(), email = $('#regEmail').value.trim(), password = $('#regPassword').value.trim();
    const phone = $('#regPhone').value.trim(), address = $('#regAddress').value.trim();
    const err = $('#regError');
    if (!name || !email || !password) { if (err) { err.textContent = 'Please fill in all required fields.'; err.style.display = 'block'; } return; }
    try {
      if (email === ADMIN_EMAIL) throw new Error('This email cannot be registered');
      const result = await DataStore.registerCustomer({ name, email, password, phone, address });
      const customer = result.customer || result;
      sessionStorage.setItem('maquip_customer_session', customer.id);
      sessionStorage.setItem('maquip_customer_data', JSON.stringify(customer));
      modal?.classList.remove('active'); $('#registerForm').reset();
      if (err) err.style.display = 'none';
      await updateCustomerBar(); await updateCartBadge();
      showToast('Account created! Welcome, ' + customer.name + '!', 'success');
    } catch (e) { if (err) { err.textContent = e.message || 'Registration failed.'; err.style.display = 'block'; } }
  });
}

function customerLogout() {
  sessionStorage.removeItem('maquip_customer_session');
  sessionStorage.removeItem('maquip_customer_data');
  updateCustomerBar(); updateCartBadge();
  showToast('Logged out successfully', 'info');
  const p = window.location.pathname;
  if (p.includes('cart') || p.includes('checkout') || p.includes('orders')) location.reload();
}

async function updateCustomerBar() {
  const bar = $('#customerBar'); if (!bar) return;
  const customer = getCustomerSession();
  if (customer) {
    bar.innerHTML = '<div class="customer-name">👋 ' + customer.name.split(' ')[0] +
      ' <a href="orders.html" style="font-size:12px;color:var(--text-light);text-decoration:none;" title="My Orders">📦</a>' +
      ' <button onclick="customerLogout()" title="Sign out">✕</button></div>';
  } else {
    bar.innerHTML = '<button class="btn btn-sm btn-primary" onclick="openAuthModal()" style="padding:6px 14px;font-size:12px;">👤 Sign In</button>';
  }
}

async function updateCartBadge() {
  const badge = $('#cartBadge'); if (!badge) return;
  const customer = getCustomerSession();
  if (customer) {
    try { const count = await DataStore.getCartCount(customer.id); badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    catch { badge.style.display = 'none'; }
  } else { badge.textContent = '0'; badge.style.display = 'none'; }
}

async function addToCart(productId, quantity=1) {
  if (!isCustomerLoggedIn()) { openAuthModal(); showToast('Please sign in to add items to your cart', 'info'); return; }
  const customer = getCustomerSession();
  const product = await DataStore.getProduct(productId);
  if (!product) { showToast('Product not found', 'error'); return; }
  if (product.stock < quantity) { showToast('Insufficient stock available', 'error'); return; }
  await DataStore.addToCart(customer.id, product, quantity);
  await updateCartBadge();
  showToast(product.name + ' added to cart!', 'success');
}

function createProductCard(product, showAddCart=true) {
  const imgSrc = product.images && product.images.length > 0 ? product.images[0] : null;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  let badges = '';
  if (product.featured) badges += '<span class="product-card-badge badge-featured">Featured</span>';
  if (isNew) badges += '<span class="product-card-badge badge-new">New</span>';
  if (product.stock > 0 && product.stock < 5) badges += '<span class="product-card-badge badge-low-stock">Low Stock</span>';
  return '<div class="product-card">' +
    '<div onclick="window.location=\'product.html?id=' + product.id + '\'" style="cursor:pointer;">' +
    '<div class="product-card-image">' +
    (imgSrc ? '<img src="' + imgSrc + '" alt="' + product.name + '" loading="lazy">' : '<div class="no-image">' + getCategoryIcon(product.category) + '</div>') +
    badges + '</div>' +
    '<div class="product-card-body">' +
    '<div class="product-card-category">' + getCategoryName(product.category) + '</div>' +
    '<div class="product-card-title">' + product.name + '</div>' +
    '<div class="product-card-desc">' + truncate(product.description, 100) + '</div></div></div>' +
    '<div class="product-card-footer"><span class="product-card-price">' + formatPrice(product.price) + '</span>' +
    (product.stock > 0 ? '<button class="add-cart-btn" onclick="event.stopPropagation();addToCart(\'' + product.id + '\')">🛒 Add</button>' : '<span class="product-card-stock out-of-stock">Out of Stock</span>') +
    '</div></div>';
}

function renderProducts(products, gridId='productsGrid') {
  const grid = $('#' + gridId); if (!grid) return;
  if (products.length === 0) { grid.innerHTML = ''; const e = $('#emptyState'); if (e) e.style.display = 'block'; return; }
  const e = $('#emptyState'); if (e) e.style.display = 'none';
  grid.innerHTML = products.map(p => createProductCard(p)).join('');
}

async function renderHeroStats() {
  try {
    const stats = await DataStore.getStats();
    const prodEl = $('#statProducts'), catEl = $('#statCategories'), stockEl = $('#statStock');
    if (prodEl) animateCounter(prodEl, stats.totalProducts);
    if (catEl) animateCounter(catEl, stats.totalCategories || CATEGORIES.length);
    if (stockEl) animateCounter(stockEl, stats.totalStock);
  } catch {}
}

function animateCounter(el, target) {
  let current = 0; const step = Math.max(1, Math.floor(target / 40));
  const interval = setInterval(() => { current += step; if (current >= target) { current = target; clearInterval(interval); } el.textContent = current + (target > current ? '+' : ''); }, 30);
}

async function initProductsPage() {
  const grid = $('#productsGrid'); if (!grid) return;
  const params = new URLSearchParams(window.location.search);
  const categoryParam = params.get('category');
  const catFilter = $('#categoryFilter');
  if (catFilter) {
    CATEGORIES.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; catFilter.appendChild(opt); });
    if (categoryParam) catFilter.value = categoryParam;
  }
  const footerCats = $('#footerCategories');
  if (footerCats) {
    CATEGORIES.slice(0, 6).forEach(c => { const a = document.createElement('a'); a.href = 'products.html?category=' + c.id; a.textContent = c.name; footerCats.appendChild(a); });
  }
  const badge = $('#categoryBadge'), title = $('#categoryTitle');
  if (categoryParam && badge && title) {
    const cat = CATEGORIES.find(c => c.id === categoryParam);
    if (cat) { badge.textContent = cat.name; title.textContent = cat.icon + ' ' + cat.name; }
  }
  let allProducts = [];
  try { allProducts = await DataStore.getProducts(); } catch {}

  async function filterAndRender() {
    const search = ($('#productSearch')?.value || '').toLowerCase();
    const category = catFilter?.value || 'all';
    const sort = ($('#sortFilter')?.value || 'newest');
    const stock = ($('#stockFilter')?.value || 'all');
    let products = allProducts;
    if (category !== 'all') products = products.filter(p => p.category === category);
    if (search) products = products.filter(p => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
    if (stock === 'in-stock') products = products.filter(p => p.stock > 0);
    if (stock === 'low-stock') products = products.filter(p => p.stock > 0 && p.stock < 10);
    switch (sort) {
      case 'price-asc': products.sort((a,b) => a.price - b.price); break;
      case 'price-desc': products.sort((a,b) => b.price - a.price); break;
      case 'name-asc': products.sort((a,b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': products.sort((a,b) => b.name.localeCompare(a.name)); break;
      default: products.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    renderProducts(products);
  }

  await filterAndRender();
  $('#productSearch')?.addEventListener('input', filterAndRender);
  $('#categoryFilter')?.addEventListener('change', filterAndRender);
  $('#sortFilter')?.addEventListener('change', filterAndRender);
  $('#stockFilter')?.addEventListener('change', filterAndRender);
}

function resetFilters() {
  const cf = $('#categoryFilter'); if (cf) cf.value = 'all';
  const s = $('#productSearch'); if (s) s.value = '';
  const sf = $('#sortFilter'); if (sf) sf.value = 'newest';
  const st = $('#stockFilter'); if (st) st.value = 'all';
  initProductsPage();
}

async function initProductDetail() {
  const container = $('#productDetailContent'); if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><h3>Product Not Found</h3><p>No product ID specified.</p></div>'; return; }
  let product;
  try { product = await DataStore.getProduct(id); } catch {}
  if (!product) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">😕</span><h3>Product Not Found</h3><p>The product doesn\'t exist.</p><a href="products.html" class="btn btn-primary mt-2">Browse Products</a></div>'; return; }
  $('#breadcrumbProduct').textContent = product.name;
  const images = product.images && product.images.length > 0 ? product.images : [];
  const mainImg = images[0] || null;
  let galleryHtml = '<div class="product-gallery"><div class="product-gallery-main" id="galleryMain">' +
    (mainImg ? '<img src="' + mainImg + '" alt="' + product.name + '" id="galleryMainImg">' : '<div class="no-image">' + getCategoryIcon(product.category) + '</div>') + '</div>';
  if (images.length > 1) {
    galleryHtml += '<div class="product-gallery-thumbs">';
    images.forEach((img,i) => { galleryHtml += '<div class="product-gallery-thumb ' + (i===0?'active':'') + '" data-index="' + i + '"><img src="' + img + '" alt=""></div>'; });
    galleryHtml += '</div>';
  }
  galleryHtml += '</div>';
  let specsHtml = '';
  if (product.specs && typeof product.specs === 'object' && Object.keys(product.specs).length > 0) {
    specsHtml = '<table class="specs-table">' + Object.entries(product.specs).map(([k,v]) => '<tr><td>' + k + '</td><td>' + v + '</td></tr>').join('') + '</table>';
  }
  const stockText = product.stock <= 0 ? 'Out of Stock' : product.stock < 10 ? 'Only ' + product.stock + ' left — Order soon!' : '✓ ' + product.stock + ' in stock';
  const isLogged = isCustomerLoggedIn();
  container.innerHTML = galleryHtml +
    '<div class="product-info"><div class="product-meta"><span>📁 ' + getCategoryName(product.category) + '</span>' +
    (product.featured ? '<span style="background:rgba(242,153,74,0.1);color:#F2994A;padding:4px 10px;border-radius:50px;font-size:12px;font-weight:700;">★ Featured</span>' : '') +
    '<span>🔔 ' + product.id + '</span></div><h1>' + product.name + '</h1>' +
    '<div class="product-price">' + formatPrice(product.price) + '</div>' +
    '<div class="product-description">' + product.description + '</div>' + specsHtml +
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;"><span style="font-weight:600;font-size:14px;">Stock: <span style="color:var(--' + (product.stock<=0?'danger':product.stock<10?'accent':'secondary') + ');">' + stockText + '</span></span></div>' +
    (product.stock > 0 ?
    '<div style="display:flex;align-items:center;gap:16px;margin-top:20px;flex-wrap:wrap;"><div class="qty-controls"><button onclick="changeQty(-1)">−</button><span id="detailQty">1</span><button onclick="changeQty(1)">+</button></div>' +
    '<button class="btn btn-primary btn-lg" onclick="addToCart(\'' + product.id + '\', parseInt($(\'#detailQty\').textContent))">' +
    (isLogged ? '🛒 Add to Cart' : '🔒 Sign In to Buy') + '</button>' +
    '<a href="cart.html" class="btn btn-outline btn-lg">View Cart</a></div>' :
    '<div style="margin-top:20px;padding:12px 20px;background:rgba(231,76,60,0.1);color:#e74c3c;border-radius:var(--radius-sm);font-weight:600;">This product is currently out of stock</div>') + '</div>';

  window.changeQty = (delta) => {
    const el = $('#detailQty'); let val = parseInt(el.textContent) + delta;
    if (val < 1) val = 1; if (val > (product.stock || 1)) val = product.stock; el.textContent = val;
  };

  if (images.length > 0) {
    const thumbs = $$('.product-gallery-thumb'), mainImgEl = $('#galleryMainImg'), mainContainer = $('#galleryMain');
    thumbs.forEach(t => {
      t.addEventListener('click', () => { thumbs.forEach(th => th.classList.remove('active')); t.classList.add('active'); if (mainImgEl) mainImgEl.src = images[parseInt(t.dataset.index)]; });
    });
    let currentImageIndex = 0;
    const lightbox = $('#lightbox'), lightboxImg = $('#lightboxImg');
    if (mainContainer && lightbox) {
      mainContainer.style.cursor = 'pointer';
      mainContainer.addEventListener('click', () => {
        currentImageIndex = parseInt(($$('.product-gallery-thumb.active')[0]?.dataset?.index) || '0');
        lightbox.classList.add('active'); if (lightboxImg) lightboxImg.src = images[currentImageIndex];
      });
    }
    const lbClose = $('#lightboxClose');
    if (lbClose) lbClose.addEventListener('click', () => lightbox?.classList.remove('active'));
    const lbPrev = $('#lightboxPrev'), lbNext = $('#lightboxNext');
    if (lbPrev) lbPrev.addEventListener('click', () => { currentImageIndex = (currentImageIndex - 1 + images.length) % images.length; if (lightboxImg) lightboxImg.src = images[currentImageIndex]; });
    if (lbNext) lbNext.addEventListener('click', () => { currentImageIndex = (currentImageIndex + 1) % images.length; if (lightboxImg) lightboxImg.src = images[currentImageIndex]; });
    document.addEventListener('keydown', (e) => {
      if (!lightbox?.classList.contains('active')) return;
      if (e.key === 'Escape') lightbox.classList.remove('active');
      if (e.key === 'ArrowLeft') lbPrev?.click();
      if (e.key === 'ArrowRight') lbNext?.click();
    });
  }

  const related = $('#relatedGrid');
  if (related) {
    try {
      const relatedProds = await DataStore.getProductsByCategory(product.category);
      renderProducts(relatedProds.filter(p => p.id !== product.id).slice(0, 4), 'relatedGrid');
    } catch {}
  }
}

async function initCartPage() {
  const empty = $('#cartEmpty'), full = $('#cartFull'), items = $('#cartItems'), summary = $('#cartSummary');
  if (!items) return;
  const customer = getCustomerSession();
  if (!customer) {
    if (empty) { empty.style.display = 'block'; empty.innerHTML = '<span class="empty-icon">🔒</span><h3>Sign In Required</h3><p>Please sign in to view your cart</p><button class="btn btn-primary" onclick="openAuthModal()">Sign In / Register</button>'; }
    if (full) full.style.display = 'none'; return;
  }
  let cart = [];
  try { cart = await DataStore.getCart(customer.id); } catch {}
  if (cart.length === 0) { if (empty) empty.style.display = 'block'; if (full) full.style.display = 'none'; return; }
  if (empty) empty.style.display = 'none'; if (full) full.style.display = 'block';
  const gretting = $('#cartGreeting');
  if (gretting) gretting.textContent = customer.name + ', you have ' + cart.reduce((s,i) => s + i.quantity, 0) + ' item(s) in your cart';
  items.innerHTML = cart.map(item => '<div class="cart-item" data-product-id="' + item.productId + '">' +
    (item.image ? '<img src="' + item.image + '" class="cart-item-img">' : '<div class="cart-item-img-placeholder">📦</div>') +
    '<div class="cart-item-info"><h4>' + item.name + '</h4><div class="cart-item-price">' + formatPrice(item.price) + '</div>' +
    '<div class="cart-item-actions"><div class="qty-controls"><button onclick="updateCartItemQty(\'' + item.productId + '\',' + (item.quantity-1) + ')">−</button>' +
    '<span>' + item.quantity + '</span><button onclick="updateCartItemQty(\'' + item.productId + '\',' + (item.quantity+1) + ')">+</button></div>' +
    '<button class="cart-item-remove" onclick="removeCartItem(\'' + item.productId + '\')">Remove</button></div></div></div>').join('');
  let subtotal = 0;
  try { subtotal = await DataStore.getCartTotal(customer.id); } catch {}
  const deliveryFee = subtotal >= 50000 ? 0 : 500;
  const total = subtotal + deliveryFee;
  summary.innerHTML = '<h3>Order Summary</h3>' +
    '<div class="cart-summary-row"><span>Items (' + cart.reduce((s,i) => s + i.quantity, 0) + ')</span><span>' + formatPrice(subtotal) + '</span></div>' +
    '<div class="cart-summary-row"><span>Delivery</span><span>' + (deliveryFee === 0 ? '<span class="free-badge">FREE</span>' : formatPrice(deliveryFee)) + '</span></div>' +
    '<div class="cart-summary-row"><span>Collection</span><span>Free</span></div>' +
    '<div class="cart-summary-row total"><span>Total</span><span>' + formatPrice(total) + '</span></div>' +
    '<div style="font-size:12px;color:var(--text-light);padding:8px 0;">' + (deliveryFee === 0 ? '✅ You qualify for free delivery!' : '💡 Free delivery on orders over KES 50,000') + '</div>' +
    '<a href="checkout.html" class="btn btn-primary btn-lg">Proceed to Checkout →</a>' +
    '<a href="products.html" class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px;">Continue Shopping</a>';
}

window.updateCartItemQty = async function(productId, qty) {
  const customer = getCustomerSession(); if (!customer) return;
  try {
    if (qty <= 0) { await DataStore.removeFromCart(customer.id, productId); showToast('Item removed from cart', 'info'); }
    else { await DataStore.updateCartQuantity(customer.id, productId, qty); }
  } catch { showToast('Failed to update cart', 'error'); }
  await updateCartBadge(); initCartPage();
};

window.removeCartItem = async function(productId) {
  const customer = getCustomerSession(); if (!customer) return;
  try { await DataStore.removeFromCart(customer.id, productId); showToast('Item removed from cart', 'info'); } catch {}
  await updateCartBadge(); initCartPage();
};

async function initCheckoutPage() {
  const customer = getCustomerSession();
  const empty = $('#checkoutEmpty'), full = $('#checkoutFull');
  if (!full) return;
  if (!customer) {
    if (empty) { empty.style.display = 'block'; empty.innerHTML = '<span class="empty-icon">🔒</span><h3>Sign In Required</h3><p>Please sign in to checkout</p><button class="btn btn-primary" onclick="openAuthModal()">Sign In</button>'; }
    if (full) full.style.display = 'none'; return;
  }
  let cart = [];
  try { cart = await DataStore.getCart(customer.id); } catch {}
  if (cart.length === 0) { if (empty) empty.style.display = 'block'; if (full) full.style.display = 'none'; return; }
  if (empty) empty.style.display = 'none'; if (full) full.style.display = 'block';
  $('#checkoutName').value = customer.name || '';
  $('#checkoutPhone').value = customer.phone || '';
  $('#checkoutEmail').value = customer.email || '';
  $('#checkoutAddress').value = customer.address || '';

  let selectedDelivery = 'collection';
  const deliveryRadios = $$('input[name="delivery"]');

  async function updateCheckoutSummary() {
    let subtotal = 0;
    try { subtotal = await DataStore.getCartTotal(customer.id); } catch {}
    const deliveryFee = DataStore.getDeliveryFee(subtotal, selectedDelivery);
    const total = subtotal + deliveryFee;
    const itemsContainer = $('#checkoutItems');
    if (itemsContainer) {
      itemsContainer.innerHTML = cart.map(item => '<div class="checkout-summary-item">' +
        (item.image ? '<img src="' + item.image + '">' : '<div style="width:48px;height:48px;border-radius:var(--radius-sm);background:#f0f0f5;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>') +
        '<div class="cs-info"><h4>' + item.name + '</h4><p>Qty: ' + item.quantity + '</p></div>' +
        '<div class="cs-price">' + formatPrice(item.price * item.quantity) + '</div></div>').join('');
    }
    $('#checkoutSubtotal').textContent = formatPrice(subtotal);
    $('#checkoutDeliveryFee').textContent = deliveryFee === 0 ? '✅ Free' : formatPrice(deliveryFee);
    $('#checkoutTotal').textContent = formatPrice(total);
    const costLabel = $('#deliveryCostLabel');
    if (costLabel) {
      if (subtotal >= 50000) costLabel.textContent = 'Free (Order over KES 50,000)';
      else costLabel.textContent = 'KES 500';
    }
    full.dataset.subtotal = subtotal; full.dataset.deliveryFee = deliveryFee; full.dataset.total = total; full.dataset.deliveryMethod = selectedDelivery;
  }

  deliveryRadios.forEach(r => {
    r.addEventListener('change', () => {
      selectedDelivery = r.value;
      $$('.delivery-option').forEach(o => o.classList.remove('selected'));
      r.closest('.delivery-option')?.classList.add('selected');
      $('#deliveryAddressGroup').style.display = selectedDelivery === 'delivery' ? 'block' : 'none';
      updateCheckoutSummary();
    });
  });
  await updateCheckoutSummary();

  $('#placeOrderBtn').addEventListener('click', async () => {
    const name = $('#checkoutName').value.trim(), phone = $('#checkoutPhone').value.trim(), email = $('#checkoutEmail').value.trim();
    const address = $('#checkoutAddress').value.trim(), notes = $('#checkoutNotes').value.trim();
    if (!name || !phone || !email) { showToast('Please fill in your name, phone and email', 'error'); return; }
    if (selectedDelivery === 'delivery' && !address) { showToast('Please provide a delivery address', 'error'); return; }
    const subtotal = parseFloat(full.dataset.subtotal), deliveryFee = parseFloat(full.dataset.deliveryFee), total = parseFloat(full.dataset.total);
    try {
      await DataStore.createOrder({
        customer_id: customer.id, customer_name: name, customer_email: email, customer_phone: phone,
        items: cart.map(i => ({ product_id: i.productId, name: i.name, price: i.price, quantity: i.quantity, image: i.image || '' })),
        subtotal, delivery_method: selectedDelivery, delivery_fee: deliveryFee, total,
        delivery_address: selectedDelivery === 'delivery' ? address : '', notes
      });
      await updateCartBadge();
      showToast('Order placed successfully!', 'success');
      setTimeout(() => { window.location = 'orders.html'; }, 1500);
    } catch (e) { showToast('Order failed: ' + (e.message || 'Unknown error'), 'error'); }
  });
}

async function initOrdersPage() {
  const guest = $('#ordersGuest'), empty = $('#ordersEmpty'), list = $('#ordersList');
  if (!list) return;
  const customer = getCustomerSession();
  if (!customer) { if (guest) guest.style.display = 'block'; if (empty) empty.style.display = 'none'; if (list) list.style.display = 'none'; return; }
  if (guest) guest.style.display = 'none';
  let orders = [];
  try { orders = await DataStore.getCustomerOrders(customer.id); } catch {}
  if (orders.length === 0) { if (empty) empty.style.display = 'block'; if (list) list.style.display = 'none'; return; }
  if (empty) empty.style.display = 'none'; if (list) list.style.display = 'block';
  list.innerHTML = orders.map(o => {
    const statusFlow = ['pending','confirmed','processing','shipped','out-for-delivery','delivered'];
    const currentIdx = statusFlow.indexOf(o.status);
    const isCancelled = o.status === 'cancelled';
    const items = o.items || [];
    const orderDate = new Date(o.createdAt);
    const deliveryEstimate = o.delivery_method === 'collection' ? 'Ready for pickup today' : (() => {
      const est = new Date(orderDate);
      est.setDate(est.getDate() + 3);
      return 'Estimated by ' + est.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    })();
    return '<div class="order-card"><div class="order-card-header"><div>' +
      '<div class="order-id">' + o.id + '</div><div class="order-date">' + orderDate.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '</div></div>' +
      '<span class="order-status status-' + o.status + '">' + formatStatus(o.status) + '</span></div>' +
      (isCancelled ? '' : '<div class="order-timeline">' + statusFlow.map((s,i) => '<div class="tl-step ' + (i <= currentIdx ? 'done' : '') + '"><div class="tl-dot"></div><span>' + formatStatus(s) + '</span></div>').join('') + '</div>') +
      (o.status === 'delivered' ? '<div style="padding:10px 24px;background:rgba(46,204,113,0.1);color:#27ae60;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);">✅ Delivered on ' + new Date(o.updatedAt || o.createdAt).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + '</div>' : '') +
      (isCancelled ? '<div style="padding:10px 24px;background:rgba(231,76,60,0.1);color:#e74c3c;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);">❌ Order Cancelled</div>' : '') +
      (isCancelled ? '' : '<div style="padding:8px 24px;font-size:12px;color:var(--accent);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;">🚚 ' + deliveryEstimate + '</div>') +
      '<div class="order-card-body">' + items.map(item => '<div class="order-item">' +
      (item.image ? '<img src="' + item.image + '">' : '<div style="width:48px;height:48px;border-radius:var(--radius-sm);background:#f0f0f5;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>') +
      '<span class="oi-name">' + item.name + '</span><span class="oi-qty">×' + item.quantity + '</span><span class="oi-price">' + formatPrice(item.price * item.quantity) + '</span></div>').join('') + '</div>' +
      '<div class="order-card-footer"><span class="order-delivery">' + (o.delivery_method === 'collection' ? '🏪 Store Collection' : '🚚 Home Delivery') + ' ' + ((o.delivery_fee === 0 || o.delivery_fee == 0) ? '(Free)' : '(' + formatPrice(o.delivery_fee) + ')') + '</span>' +
      '<span class="order-total">Total: ' + formatPrice(o.total) + '</span></div></div>';
  }).join('');
}

function initNewsletter() {
  const form = $('#newsletterForm');
  form?.addEventListener('submit', (e) => { e.preventDefault(); const i = form.querySelector('input'); if (i?.value) { showToast('Subscribed successfully!', 'success'); i.value = ''; } });
}

function initContactForm() {
  const form = $('#contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#contactName')?.value?.trim() || '';
      const email = $('#contactEmail')?.value?.trim() || '';
      const message = $('#contactMessage')?.value?.trim() || '';
      if (!name || !email || !message) { showToast('Please fill in all fields', 'error'); return; }
      try { await DataStore.addQuery({ name, email, message }); showToast('Your message has been sent! We will get back to you soon.', 'success'); form.reset(); }
      catch { showToast('Failed to send message', 'error'); }
    });
  }
}

async function initHomePage() {
  try {
    if ($('#featuredGrid')) { const f = await DataStore.getFeaturedProducts(); renderProducts(f, 'featuredGrid'); }
    if ($('#recentGrid')) { const r = await DataStore.getRecentProducts(8); renderProducts(r, 'recentGrid'); }
  } catch {}
}

async function initGlobal() { await updateCustomerBar(); await updateCartBadge(); }

document.addEventListener('DOMContentLoaded', async () => {
  initTheme(); initNavbar(); initMobileMenu(); initSearchOverlay(); initParticles(); initAuthModal();
  initContactForm();
  await renderCategories(); await renderHeroStats(); await initHomePage(); await initProductsPage();
  await initProductDetail(); await initCartPage(); await initCheckoutPage(); await initOrdersPage();
  initNewsletter(); await initGlobal();
});
