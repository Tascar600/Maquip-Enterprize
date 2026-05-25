const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;
const WEB_ROOT = path.join(__dirname, 'maquip-marketplace');
const DATA_DIR = path.join(__dirname, 'server-data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function db(name) {
  const file = path.join(DATA_DIR, name + '.json');
  return {
    read() {
      try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
    },
    write(data) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    },
  };
}

function genId(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

const ADMIN_EMAIL = 'alienelizabeth2004@gmail.com';
const ADMIN_PASSWORD = '12345678';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(WEB_ROOT, url.replace(/^\//, ''));
  if (!filePath.startsWith(WEB_ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.sql': 'text/plain',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); }
      else { res.writeHead(500); res.end('Server error'); }
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
}

const handlers = {
  // === PRODUCTS ===
  'GET /api/products': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const featured = url.searchParams.get('featured');
    const sort = url.searchParams.get('sort') || 'newest';
    let products = db('products').read();
    if (id) {
      const p = products.find(p => p.id === id);
      return send(res, p ? 200 : 404, p ? { product: p } : { error: 'Not found' });
    }
    if (category) products = products.filter(p => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (featured === 'true' || featured === '1') products = products.filter(p => p.featured);
    switch (sort) {
      case 'price_asc': case 'price-asc': products.sort((a, b) => a.price - b.price); break;
      case 'price_desc': case 'price-desc': products.sort((a, b) => b.price - a.price); break;
      case 'name': case 'name-asc': products.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': products.sort((a, b) => b.name.localeCompare(a.name)); break;
      default: products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    send(res, 200, { products });
  },
  'POST /api/products': async (req, res) => {
    const input = await parseBody(req);
    const products = db('products').read();
    const id = input.id || genId('prod_');
    const product = {
      id, name: input.name || '', description: input.description || '',
      price: input.price || 0, category: input.category || '', stock: input.stock || 0,
      featured: input.featured ? 1 : 0, specs: input.specs || {},
      images: input.images || [], createdAt: input.createdAt || new Date().toISOString(),
    };
    products.push(product);
    db('products').write(products);
    send(res, 201, { success: true, id });
  },
  'PUT /api/products': async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) return send(res, 400, { error: 'Product ID required' });
    const input = await parseBody(req);
    let products = db('products').read();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return send(res, 404, { error: 'Not found' });
    Object.assign(products[idx], input, { id });
    if (input.specs) products[idx].specs = input.specs;
    if (input.images) products[idx].images = input.images;
    db('products').write(products);
    send(res, 200, { success: true });
  },
  'DELETE /api/products': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) return send(res, 400, { error: 'Product ID required' });
    let products = db('products').read();
    db('products').write(products.filter(p => p.id !== id));
    send(res, 200, { success: true });
  },

  // === CUSTOMERS ===
  'GET /api/customers': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    let customers = db('customers').read();
    if (id) {
      const c = customers.find(c => c.id === id);
      return send(res, c ? 200 : 404, c ? { customer: c } : { error: 'Not found' });
    }
    send(res, 200, { customers });
  },
  'POST /api/customers': async (req, res) => {
    const input = await parseBody(req);
    if (!input.name || !input.email || !input.password) return send(res, 400, { error: 'Name, email, password required' });
    let customers = db('customers').read();
    if (customers.find(c => c.email === input.email)) return send(res, 409, { error: 'Email already registered' });
    const customer = { id: genId('cust_'), name: input.name, email: input.email, phone: input.phone || '', password: input.password, address: input.address || '', createdAt: new Date().toISOString() };
    customers.push(customer);
    db('customers').write(customers);
    send(res, 201, { success: true, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
  },

  // === AUTH ===
  'POST /api/auth': async (req, res) => {
    const input = await parseBody(req);
    const { email, password, type, name, phone, address } = input;
    if (!email || !password) return send(res, 400, { error: 'Email and password required' });
    if (email === ADMIN_EMAIL && type !== 'register') {
      if (password === ADMIN_PASSWORD) return send(res, 200, { success: true, role: 'admin', user: { id: 1, name: 'Maquip Enterprise', email: ADMIN_EMAIL } });
      return send(res, 401, { error: 'Invalid admin credentials' });
    }
    if (email === ADMIN_EMAIL && type === 'register') return send(res, 400, { error: 'Cannot register admin email' });
    let customers = db('customers').read();
    if (type === 'register') {
      if (!name) return send(res, 400, { error: 'Name required' });
      if (customers.find(c => c.email === email)) return send(res, 409, { error: 'Email already registered' });
      const customer = { id: genId('cust_'), name, email, phone: phone || '', password, address: address || '', createdAt: new Date().toISOString() };
      customers.push(customer);
      db('customers').write(customers);
      return send(res, 201, { success: true, role: 'customer', user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
    }
    const customer = customers.find(c => c.email === email && c.password === password);
    if (!customer) return send(res, 401, { error: 'Invalid email or password' });
    send(res, 200, { success: true, role: 'customer', user: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
  },

  // === CART ===
  'GET /api/cart': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const customerId = url.searchParams.get('customer_id');
    if (!customerId) return send(res, 400, { error: 'Customer ID required' });
    let cart = db('cart_' + customerId).read();
    const products = db('products').read();
    cart = cart.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return { ...item, name: item.name || (prod ? prod.name : ''), price: item.price || (prod ? prod.price : 0), image: item.image || (prod && prod.images ? prod.images[0] : ''), stock: prod ? prod.stock : 0 };
    });
    send(res, 200, { items: cart });
  },
  'POST /api/cart': async (req, res) => {
    const input = await parseBody(req);
    if (!input.customer_id || !input.product_id) return send(res, 400, { error: 'Customer ID and Product ID required' });
    let cart = db('cart_' + input.customer_id).read();
    const existing = cart.find(i => i.productId === input.product_id);
    if (existing) existing.quantity += (input.quantity || 1);
    else cart.push({ productId: input.product_id, name: input.name || '', price: input.price || 0, image: input.image || '', stock: input.stock || 0, quantity: input.quantity || 1 });
    db('cart_' + input.customer_id).write(cart);
    send(res, 200, { success: true });
  },
  'PUT /api/cart': async (req, res) => {
    const input = await parseBody(req);
    if (!input.customer_id || !input.product_id) return send(res, 400, { error: 'Customer ID and Product ID required' });
    let cart = db('cart_' + input.customer_id).read();
    if (input.quantity <= 0) {
      cart = cart.filter(i => i.productId !== input.product_id);
    } else {
      const item = cart.find(i => i.productId === input.product_id);
      if (item) item.quantity = input.quantity;
    }
    db('cart_' + input.customer_id).write(cart);
    send(res, 200, { success: true });
  },
  'DELETE /api/cart': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const customerId = url.searchParams.get('customer_id');
    const productId = url.searchParams.get('product_id');
    if (!customerId || !productId) return send(res, 400, { error: 'Customer ID and Product ID required' });
    let cart = db('cart_' + customerId).read();
    db('cart_' + customerId).write(cart.filter(i => i.productId !== productId));
    send(res, 200, { success: true });
  },

  // === ORDERS ===
  'GET /api/orders': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    const customerId = url.searchParams.get('customer_id');
    let orders = db('orders').read();
    if (id) {
      const o = orders.find(o => o.id === id);
      return send(res, o ? 200 : 404, o ? { order: o } : { error: 'Not found' });
    }
    if (customerId) orders = orders.filter(o => o.customer_id === customerId);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    send(res, 200, { orders });
  },
  'POST /api/orders': async (req, res) => {
    const input = await parseBody(req);
    if (!input.customer_id || !input.items || !input.items.length) return send(res, 400, { error: 'Customer ID and items required' });
    const subtotal = input.subtotal || input.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    const deliveryFee = input.delivery_method === 'delivery' && subtotal < 50000 ? 500 : 0;
    const order = {
      id: genId('ORD-'), customer_id: input.customer_id, customer_name: input.customer_name || '',
      customer_email: input.customer_email || '', customer_phone: input.customer_phone || '',
      items: input.items.map(i => ({ product_id: i.product_id, name: i.name, price: i.price, quantity: i.quantity, image: i.image || '' })),
      subtotal, delivery_method: input.delivery_method || 'collection', delivery_fee: deliveryFee,
      total: subtotal + deliveryFee, delivery_address: input.delivery_address || '',
      notes: input.notes || '', status: 'pending', createdAt: new Date().toISOString(),
    };
    let orders = db('orders').read();
    orders.push(order);
    db('orders').write(orders);
    // Clear cart
    db('cart_' + input.customer_id).write([]);
    send(res, 201, { success: true, order_id: order.id });
  },
  'PUT /api/orders': async (req, res) => {
    const input = await parseBody(req);
    if (!input.id || !input.status) return send(res, 400, { error: 'Order ID and status required' });
    let orders = db('orders').read();
    const idx = orders.findIndex(o => o.id === input.id);
    if (idx === -1) return send(res, 404, { error: 'Not found' });
    orders[idx].status = input.status;
    orders[idx].updatedAt = new Date().toISOString();
    db('orders').write(orders);
    send(res, 200, { success: true });
  },

  // === QUERIES ===
  'GET /api/queries': (req, res) => {
    let queries = db('queries').read();
    queries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    send(res, 200, { queries });
  },
  'POST /api/queries': async (req, res) => {
    const input = await parseBody(req);
    if (!input.name || !input.email || !input.message) return send(res, 400, { error: 'Name, email, message required' });
    const queries = db('queries').read();
    const q = { id: genId('QRY-'), name: input.name, email: input.email, message: input.message, status: 'unread', createdAt: new Date().toISOString() };
    queries.push(q);
    db('queries').write(queries);
    send(res, 201, { success: true });
  },
  'PUT /api/queries': async (req, res) => {
    const input = await parseBody(req);
    if (!input.id) return send(res, 400, { error: 'Query ID required' });
    let queries = db('queries').read();
    const q = queries.find(q => q.id === input.id);
    if (q) { q.status = 'read'; db('queries').write(queries); }
    send(res, 200, { success: true });
  },
  'DELETE /api/queries': (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) return send(res, 400, { error: 'Query ID required' });
    let queries = db('queries').read();
    db('queries').write(queries.filter(q => q.id !== id));
    send(res, 200, { success: true });
  },

  // === SETTINGS ===
  'GET /api/settings': (req, res) => {
    let settings = { theme: 'light', currency: 'KES', company: 'Maquip Enterprise', email: 'admin@maquip.com', phone: '+263 775 699 885', about: 'Your trusted partner for IT equipment and accessories.' };
    try { const s = db('settings').read(); if (s && s.company) settings = s; } catch {}
    send(res, 200, { settings });
  },
  'POST /api/settings': async (req, res) => {
    const input = await parseBody(req);
    db('settings').write(input);
    send(res, 200, { success: true });
  },

  // === STATS ===
  'GET /api/stats': (req, res) => {
    const products = db('products').read();
    const orders = db('orders').read();
    const customers = db('customers').read();
    const queries = db('queries').read();
    const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    send(res, 200, {
      totalProducts: products.length,
      totalCategories: new Set(products.map(p => p.category)).size,
      featuredCount: products.filter(p => p.featured).length,
      totalStock: products.reduce((s, p) => s + p.stock, 0),
      totalOrders: orders.length,
      totalCustomers: customers.length,
      totalRevenue,
      unreadQueries: queries.filter(q => q.status === 'unread').length,
      totalQueries: queries.length,
    });
  },
};

function route(req, res) {
  const method = req.method;
  const url = req.url.split('?')[0];
  const key = method + ' ' + url;
  if (handlers[key]) return handlers[key](req, res);
  // Handle DELETE with query params
  if (url.startsWith('/api/')) {
    const base = url;
    for (const [k, h] of Object.entries(handlers)) {
      const [m, u] = k.split(' ');
      if (m === method && u === base) return h(req, res);
    }
  }
  serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  route(req, res);
});

// Seed initial data if empty
function seedData() {
  const products = db('products').read();
  if (products.length === 0) {
    const SEED_PRODUCTS = [
      { id: 'prod_001', name: 'HP LaserJet Pro M404dn', description: 'High-performance monochrome laser printer with automatic duplex printing.', price: 45000, category: 'printers', stock: 12, featured: 1, createdAt: '2024-06-01T10:00:00Z', specs: { 'Print Speed': '38 ppm', Duplex: 'Automatic', 'Paper Capacity': '350 sheets', Connectivity: 'USB, Ethernet' }, images: [] },
      { id: 'prod_002', name: 'Dell Latitude 5430', description: 'Business laptop with 12th Gen Intel Core i5, 16GB RAM, 512GB SSD.', price: 120000, category: 'laptops', stock: 8, featured: 1, createdAt: '2024-06-05T10:00:00Z', specs: { Processor: 'Intel Core i5-1235U', RAM: '16GB DDR4', Storage: '512GB SSD', Display: '14 inch FHD', Battery: 'Up to 10 hours' }, images: [] },
      { id: 'prod_003', name: 'Logitech MX Master 3S', description: 'Advanced wireless mouse with 8000 DPI optical sensor and ergonomic design.', price: 8500, category: 'accessories', stock: 25, featured: 1, createdAt: '2024-06-10T10:00:00Z', specs: { DPI: '8000', Connectivity: 'Bluetooth, USB-C', 'Battery Life': '70 days', Buttons: '7' }, images: [] },
      { id: 'prod_004', name: 'Epson Perfection V600', description: 'Photo scanner with 6400 dpi optical resolution.', price: 35000, category: 'scanners', stock: 6, featured: 0, createdAt: '2024-06-15T10:00:00Z', specs: { Resolution: '6400 dpi', 'Scan Type': 'Flatbed', Interface: 'USB 2.0' }, images: [] },
      { id: 'prod_005', name: 'Samsung 870 EVO 1TB SSD', description: 'SATA III internal SSD with read speeds up to 560 MB/s.', price: 12500, category: 'storage', stock: 30, featured: 1, createdAt: '2024-06-20T10:00:00Z', specs: { Capacity: '1TB', Interface: 'SATA III', 'Read Speed': '560 MB/s', 'Write Speed': '530 MB/s' }, images: [] },
      { id: 'prod_006', name: 'TP-Link Archer AX73', description: 'AX5400 dual-band WiFi 6 router. Covers up to 3000 sq ft.', price: 15000, category: 'networking', stock: 15, featured: 0, createdAt: '2024-07-01T10:00:00Z', specs: { Standard: 'WiFi 6', Speed: 'AX5400', Bands: 'Dual-band', Ports: '5 Gigabit' }, images: [] },
      { id: 'prod_007', name: 'Lenovo ThinkPad X1 Carbon Gen 10', description: 'Ultralight business ultrabook at just 1.12kg. 14 inch 2.8K OLED display.', price: 185000, category: 'laptops', stock: 5, featured: 1, createdAt: '2024-07-05T10:00:00Z', specs: { Processor: 'Intel Core i7-1260P', RAM: '16GB LPDDR5', Storage: '512GB SSD', Display: '14 inch 2.8K OLED', Weight: '1.12 kg' }, images: [] },
      { id: 'prod_008', name: 'Dell 27 inch 4K Monitor S2722QC', description: '27-inch 4K UHD monitor with USB-C hub. 99% sRGB.', price: 65000, category: 'monitors', stock: 10, featured: 0, createdAt: '2024-07-10T10:00:00Z', specs: { Size: '27 inch', Resolution: '3840x2160 (4K)', Panel: 'IPS', Ports: 'USB-C, HDMI, DP' }, images: [] },
      { id: 'prod_009', name: 'HP USB-C Universal Dock G5', description: 'Universal docking station supporting dual 4K displays.', price: 22000, category: 'accessories', stock: 18, featured: 0, createdAt: '2024-07-15T10:00:00Z', specs: { Ports: 'USB-C, 3x USB-A, HDMI, DP, Ethernet', 'Power Delivery': '100W' }, images: [] },
      { id: 'prod_010', name: 'Samsung Galaxy Book3 Pro', description: '16-inch AMOLED display, Intel Core i7-1360P, 16GB RAM, 1TB SSD.', price: 165000, category: 'laptops', stock: 7, featured: 1, createdAt: '2024-07-20T10:00:00Z', specs: { Processor: 'Intel Core i7-1360P', RAM: '16GB LPDDR5', Storage: '1TB SSD', Display: '16 inch AMOLED 3K' }, images: [] },
      { id: 'prod_011', name: 'Canon PIXMA G3260', description: 'MegaTank all-in-one inkjet printer with high-yield ink bottles.', price: 28000, category: 'printers', stock: 14, featured: 0, createdAt: '2024-08-01T10:00:00Z', specs: { Type: 'Inkjet All-in-One', 'Print Speed': '10.8 ipm', 'Ink System': 'MegaTank', Connectivity: 'Wi-Fi, USB' }, images: [] },
      { id: 'prod_012', name: 'Anker PowerCore 26800mAh', description: 'High-capacity portable charger with dual USB-A and USB-C.', price: 5500, category: 'accessories', stock: 40, featured: 0, createdAt: '2024-08-05T10:00:00Z', specs: { Capacity: '26800mAh', Ports: '2x USB-A, 1x USB-C', Output: '60W total' }, images: [] },
    ];
    db('products').write(SEED_PRODUCTS);
    console.log('  ✓ Seed products loaded');
  }
  if (db('customers').read().length === 0) {
    db('customers').write([]);
  }
  if (db('orders').read().length === 0) {
    db('orders').write([]);
  }
  if (db('queries').read().length === 0) {
    db('queries').write([]);
  }
}

seedData();

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ⚡ Maquip Enterprise Marketplace');
  console.log('  ────────────────────────────────');
  console.log('  Server:   http://localhost:' + PORT);
  console.log('  Network:  http://0.0.0.0:' + PORT + ' (accessible from other devices)');
  console.log('  Admin:    ' + ADMIN_EMAIL + ' / ' + ADMIN_PASSWORD);
  console.log('  Data:     server-data/ directory (shared across all devices)');
  console.log('');
});
