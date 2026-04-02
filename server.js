require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const KLARNA_API_URL = process.env.KLARNA_API_URL || 'https://api-na.playground.klarna.com';
const KLARNA_USERNAME = process.env.KLARNA_API_USERNAME || '';
const KLARNA_PASSWORD = process.env.KLARNA_API_PASSWORD || '';

app.use(express.json());

// Request logging with response status and timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

// Rate limiting: 30 requests per minute per IP for API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// --- Helpers ---

function getBasicAuthHeader() {
  const token = Buffer.from(`${KLARNA_USERNAME}:${KLARNA_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 120000) {
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
    throw new Error('Klarna credentials not configured — set KLARNA_API_USERNAME and KLARNA_API_PASSWORD in .env');
  }
}

async function safeParseJSON(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw_response: text };
  }
}

async function makeKlarnaRequest(method, endpoint, payload = null, retries = 2) {
  validateCredentials();
  const url = `${KLARNA_API_URL}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: getBasicAuthHeader()
        },
        body: payload ? JSON.stringify(payload) : undefined
      });

      if (!response.ok) {
        const data = await safeParseJSON(response);
        throw new Error(data.error_message || data.raw_response || JSON.stringify(data));
      }

      if (response.status === 204 || (response.status === 201 && !response.headers.get('content-type')?.includes('json'))) {
        if (endpoint.includes('/cancel')) {
          return { success: true, message: 'Order cancelled successfully' };
        }
        if (endpoint.includes('/captures')) {
          return { success: true, message: 'Amount captured successfully', captureId: response.headers.get('capture-id') };
        }
        if (endpoint.includes('/refunds')) {
          return { success: true, message: 'Refund processed successfully', refundId: response.headers.get('refund-id') };
        }
        return { success: true, message: 'Operation completed successfully' };
      }

      return await safeParseJSON(response);
    } catch (err) {
      const isRetryable = err.name === 'AbortError' || err.message === 'fetch failed';
      if (isRetryable && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Klarna request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (err.cause) {
        console.error('Klarna request error:', err.message, '| cause:', err.cause.message || err.cause);
      }
      throw err;
    }
  }
}

// --- Validation ---

const ALLOWED_COUNTRIES = ['US', 'SE', 'DE', 'GB', 'AU', 'AT', 'BE', 'DK', 'FI', 'NL', 'NO'];
const ALLOWED_CURRENCIES = ['USD', 'SEK', 'EUR', 'GBP', 'AUD', 'DKK', 'NOK'];

function validateSessionPayload(body) {
  const errors = [];
  if (!body) return ['Request body is required'];

  const { purchase_country, purchase_currency, order_amount, order_lines } = body;

  if (purchase_country && !ALLOWED_COUNTRIES.includes(purchase_country)) {
    errors.push(`Invalid purchase_country: ${purchase_country}. Allowed: ${ALLOWED_COUNTRIES.join(', ')}`);
  }
  if (purchase_currency && !ALLOWED_CURRENCIES.includes(purchase_currency)) {
    errors.push(`Invalid purchase_currency: ${purchase_currency}. Allowed: ${ALLOWED_CURRENCIES.join(', ')}`);
  }
  if (order_amount !== undefined && (!Number.isInteger(order_amount) || order_amount <= 0)) {
    errors.push('order_amount must be a positive integer (in minor units, e.g. 10000 = $100.00)');
  }
  if (order_lines !== undefined && !Array.isArray(order_lines)) {
    errors.push('order_lines must be an array');
  }
  return errors;
}

function validateOrderId(orderId) {
  return /^[a-f0-9-]{36}$/i.test(orderId);
}

// --- Routes ---

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    klarna_api: KLARNA_API_URL,
    credentials_configured: !!(KLARNA_USERNAME && KLARNA_PASSWORD)
  });
});

app.post('/api/session', async (req, res) => {
  try {
    const errors = validateSessionPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const {
      purchase_country = 'US',
      purchase_currency = 'USD',
      locale = 'en-US',
      order_amount = 10000,
      order_lines
    } = req.body || {};

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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create_order', async (req, res) => {
  try {
    const { authorization_token, payload } = req.body || {};

    if (!authorization_token) {
      return res.status(400).json({ error: 'authorization_token is required' });
    }
    if (typeof authorization_token !== 'string' || authorization_token.length < 10) {
      return res.status(400).json({ error: 'Invalid authorization_token format' });
    }

    const data = await makeKlarnaRequest(
      'POST',
      `/payments/v1/authorizations/${encodeURIComponent(authorization_token)}/order`,
      payload
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    if (!validateOrderId(req.params.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    const data = await makeKlarnaRequest('GET', `/ordermanagement/v1/orders/${req.params.orderId}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/captures', async (req, res) => {
  try {
    if (!validateOrderId(req.params.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    const { amount = 10000 } = req.body || {};
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/captures`, {
      captured_amount: amount
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/cancel', async (req, res) => {
  try {
    if (!validateOrderId(req.params.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/cancel`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/refunds', async (req, res) => {
  try {
    if (!validateOrderId(req.params.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    const { amount = 10000 } = req.body || {};
    const data = await makeKlarnaRequest('POST', `/ordermanagement/v1/orders/${req.params.orderId}/refunds`, {
      refunded_amount: amount
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook receiver for Klarna push notifications
app.post('/api/webhooks/klarna', (req, res) => {
  console.log('[Webhook] Klarna notification received:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;
