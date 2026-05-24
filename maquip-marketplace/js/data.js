const API = '/api';
const CATEGORIES = [
  { id:'accessories', name:'Accessories', icon:'🎧' }, { id:'printers', name:'Printers', icon:'🖨️' },
  { id:'scanners', name:'Scanners', icon:'📄' }, { id:'laptops', name:'Laptops', icon:'💻' },
  { id:'laptop-parts', name:'Laptop Parts', icon:'🔧' }, { id:'monitors', name:'Monitors', icon:'🖥️' },
  { id:'networking', name:'Networking', icon:'🌐' }, { id:'software', name:'Software', icon:'💿' },
  { id:'storage', name:'Storage', icon:'💾' }, { id:'keyboards', name:'Keyboards & Mice', icon:'⌨️' },
  { id:'cables', name:'Cables & Adapters', icon:'🔌' }, { id:'audio', name:'Headphones & Audio', icon:'🎵' }
];
const ORDER_STATUSES = ['pending','confirmed','processing','shipped','out-for-delivery','delivered','cancelled'];
const DELIVERY_CONFIG = { standardFee:500, freeDeliveryThreshold:50000, collectionFee:0 };
const ADMIN_EMAIL = 'alienelizabeth2004@gmail.com';
const ADMIN_PASSWORD = '12345678';

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function formatPrice(price) { return 'KES ' + Number(price).toLocaleString(); }
function formatStatus(status) {
  return status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function getCategoryName(id) { const c = CATEGORIES.find(c => c.id === id); return c ? c.name : id; }
function getCategoryIcon(id) { const c = CATEGORIES.find(c => c.id === id); return c ? c.icon : '📦'; }
function truncate(text, len=100) { return text.length > len ? text.substring(0, len) + '...' : text; }
function genId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2,4); }

function showToast(message, type='success') {
  const c = $('#toastContainer');
  if (!c) return;
  const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = '<span>' + (icons[type]||'') + '</span> ' + message;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const DataStore = {
  // === PRODUCTS ===
  async getProducts() {
    const data = await api('GET', '/products');
    return data.products || [];
  },
  async getProduct(id) {
    const data = await api('GET', '/products?id=' + encodeURIComponent(id));
    return data.product || null;
  },
  async addProduct(product) {
    const data = await api('POST', '/products', product);
    return data;
  },
  async updateProduct(id, updates) {
    return await api('PUT', '/products?id=' + encodeURIComponent(id), updates);
  },
  async deleteProduct(id) {
    return await api('DELETE', '/products?id=' + encodeURIComponent(id));
  },
  async getFeaturedProducts() {
    const all = await this.getProducts();
    return all.filter(p => p.featured);
  },
  async getRecentProducts(limit) {
    const all = await this.getProducts();
    return all.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0, limit || 8);
  },
  async getProductsByCategory(catId) {
    const all = await this.getProducts();
    return all.filter(p => p.category === catId);
  },
  async searchProducts(query) {
    const data = await api('GET', '/products?search=' + encodeURIComponent(query));
    return data.products || [];
  },

  // === CUSTOMERS ===
  async getCustomers() {
    const data = await api('GET', '/customers');
    return data.customers || [];
  },
  async registerCustomer(data) {
    return await api('POST', '/customers', data);
  },
  async authenticateCustomer(email, password) {
    const data = await api('POST', '/auth', { email, password, type: 'login' });
    return data.user || null;
  },
  async getCustomer(id) {
    const data = await api('GET', '/customers?id=' + encodeURIComponent(id));
    return data.customer || null;
  },
  async updateCustomer(id, data) {
    return await api('PUT', '/customers?id=' + encodeURIComponent(id), data);
  },

  // === CART ===
  async getCart(customerId) {
    const data = await api('GET', '/cart?customer_id=' + encodeURIComponent(customerId));
    return data.items || [];
  },
  async addToCart(customerId, product, quantity) {
    return await api('POST', '/cart', {
      customer_id: customerId, product_id: product.id, name: product.name,
      price: product.price, image: (product.images && product.images[0]) || '',
      stock: product.stock, quantity: quantity || 1
    });
  },
  async updateCartQuantity(customerId, productId, quantity) {
    return await api('PUT', '/cart', { customer_id: customerId, product_id: productId, quantity });
  },
  async removeFromCart(customerId, productId) {
    return await api('DELETE', '/cart?customer_id=' + encodeURIComponent(customerId) + '&product_id=' + encodeURIComponent(productId));
  },
  async clearCart(customerId) {
    const cart = await this.getCart(customerId);
    for (const item of cart) {
      await api('DELETE', '/cart?customer_id=' + encodeURIComponent(customerId) + '&product_id=' + encodeURIComponent(item.productId));
    }
  },
  async getCartTotal(customerId) {
    const cart = await this.getCart(customerId);
    return cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
  },
  async getCartCount(customerId) {
    const cart = await this.getCart(customerId);
    return cart.reduce((s, i) => s + (i.quantity || 0), 0);
  },

  getDeliveryFee(subtotal, method) {
    if (method === 'collection') return 0;
    return subtotal >= DELIVERY_CONFIG.freeDeliveryThreshold ? 0 : DELIVERY_CONFIG.standardFee;
  },

  // === ORDERS ===
  async getOrders() {
    const data = await api('GET', '/orders');
    return data.orders || [];
  },
  async getCustomerOrders(customerId) {
    const data = await api('GET', '/orders?customer_id=' + encodeURIComponent(customerId));
    return data.orders || [];
  },
  async getOrder(id) {
    const data = await api('GET', '/orders?id=' + encodeURIComponent(id));
    return data.order || null;
  },
  async createOrder(data) {
    return await api('POST', '/orders', data);
  },
  async updateOrderStatus(id, status) {
    return await api('PUT', '/orders', { id, status });
  },

  // === QUERIES ===
  async getQueries() {
    const data = await api('GET', '/queries');
    return data.queries || [];
  },
  async addQuery(data) {
    return await api('POST', '/queries', data);
  },
  async markQueryRead(id) {
    return await api('PUT', '/queries', { id });
  },
  async deleteQuery(id) {
    return await api('DELETE', '/queries?id=' + encodeURIComponent(id));
  },

  // === SETTINGS ===
  async getSettings() {
    const data = await api('GET', '/settings');
    return data.settings || {};
  },

  // === STATS ===
  async getStats() {
    return await api('GET', '/stats');
  },
};
