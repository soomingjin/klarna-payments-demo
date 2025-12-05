require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const KLARNA_API_URL = process.env.KLARNA_API_URL || 'https://api-na.playground.klarna.com';
const KLARNA_USERNAME = process.env.KLARNA_API_USERNAME || '';
const KLARNA_PASSWORD = process.env.KLARNA_API_PASSWORD || '';

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Helpers
function getBasicAuthHeader() {
  const token = Buffer.from(`${KLARNA_USERNAME}:${KLARNA_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, ...opts });
  } finally {
    clearTimeout(timeoutId);
  }
}

function validateCredentials() {
  if (!KLARNA_USERNAME || !KLARNA_PASSWORD) {
    throw new Error('Klarna credentials not configured');
  }
}

async function makeKlarnaRequest(method, endpoint, payload = null) {
  validateCredentials();

  const url = `${KLARNA_API_URL}${endpoint}`;
  const response = await fetchWithTimeout(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getBasicAuthHeader()
    },
    body: payload ? JSON.stringify(payload) : undefined
  }, 8000);
  
  if (!response.ok) {
    let data = await response.json();
    throw new Error(data.error_message || JSON.stringify(data));
  }
  
  // Handle 201/204 responses for order management operations
  if (response.status === 201 || response.status === 204){
    if (endpoint.includes('/cancel')) {
      return { success: true, message: 'Order cancelled successfully', cancelId: response.headers.get('cancel-id') };
  } else if (endpoint.includes('/captures')) {
      return { success: true, message: 'Amount captured successfully', captureId: response.headers.get('capture-id') };
  } else if (endpoint.includes('/refunds')) {
    return { success: true, message: 'Operation completed successfully', refundId: response.headers.get('refund-id') };
  }
}
  
  let data = await response.json();

  return data;
}

// Routes
app.post('/api/session', async (req, res) => {
  try {
  const { purchase_country = 'US', purchase_currency = 'USD', locale = 'en-US', order_amount = 10000, order_lines } = req.body || {};
  
  const payload = {
    purchase_country,
    purchase_currency,
    locale,
    order_amount,
    order_tax_amount: 0,
    order_lines: order_lines || [{
      type: 'physical',
      reference: 'demo-1',
      name: 'Demo product',
      quantity: 1,
      unit_price: order_amount,
      tax_rate: 0,
      total_amount: order_amount,
      total_tax_amount: 0
    }]
  };

  const data = await makeKlarnaRequest('POST', '/payments/v1/sessions', payload);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create_order', async (req, res) => {
  try {
    const { authorization_token, payload } = req.body || {};
    
    if (!authorization_token) {
      return res.status(400).json({ error: 'authorization_token required' });
    }

    const data = await makeKlarnaRequest('POST', `/payments/v1/authorizations/${authorization_token}/order`, payload);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const data = await makeKlarnaRequest('GET', `/ordermanagement/v1/orders/${req.params.orderId}`);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/captures', async (req, res) => {
  try {
    const amount = 10000;
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/captures`, {
      captured_amount: amount
    });
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/cancel', async (req, res) => {
  try {
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/cancel`);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/refunds', async (req, res) => {
  try {
    const { amount = 10000 } = req.body || {};
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/refunds`, {
      refunded_amount: amount,
    });
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
