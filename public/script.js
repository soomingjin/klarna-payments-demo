let lastOrderId = null;

const COUNTRY_PRESETS = {
  US: { currency: 'USD', locale: 'en-US', symbol: '$', minor: 100 },
  SE: { currency: 'SEK', locale: 'sv-SE', symbol: 'kr', minor: 100 },
  DE: { currency: 'EUR', locale: 'de-DE', symbol: '\u20AC', minor: 100 },
  GB: { currency: 'GBP', locale: 'en-GB', symbol: '\u00A3', minor: 100 },
  AU: { currency: 'AUD', locale: 'en-AU', symbol: 'A$', minor: 100 },
  AT: { currency: 'EUR', locale: 'de-AT', symbol: '\u20AC', minor: 100 },
  NL: { currency: 'EUR', locale: 'nl-NL', symbol: '\u20AC', minor: 100 },
  NO: { currency: 'NOK', locale: 'nb-NO', symbol: 'kr', minor: 100 },
  DK: { currency: 'DKK', locale: 'da-DK', symbol: 'kr', minor: 100 },
  FI: { currency: 'EUR', locale: 'fi-FI', symbol: '\u20AC', minor: 100 }
};

function buildPayload(country, amountMajor) {
  const preset = COUNTRY_PRESETS[country];
  const minorAmount = Math.round(amountMajor * preset.minor);
  return {
    purchase_country: country,
    purchase_currency: preset.currency,
    locale: preset.locale,
    order_amount: minorAmount,
    order_lines: [{
      reference: '19-402',
      name: 'Battery Power Pack',
      quantity: 1,
      unit_price: minorAmount,
      total_amount: minorAmount
    }]
  };
}

function displayResponse(data) {
  const el = document.getElementById('response');
  el.textContent = JSON.stringify(data, null, 2);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Loading state management
function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="spinner"></span> ' + button.dataset.originalText;
    button.classList.add('loading');
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    button.classList.remove('loading');
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(endpoint, opts);
  const data = await resp.json();

  if (!resp.ok) throw new Error(data.error || 'API error');
  return data;
}

// Step indicator management
function setActiveStep(step) {
  document.querySelectorAll('.step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === step);
    el.classList.toggle('completed', s < step);
  });
}

function showSection(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('section-hidden');
}

// Sync preset picker -> JSON textarea
function syncPresetToJSON() {
  const country = document.getElementById('country-preset').value;
  const amount = parseFloat(document.getElementById('amount-input').value) || 100;
  const payload = buildPayload(country, amount);
  document.getElementById('json-input').value = JSON.stringify(payload, null, 2);

  const preset = COUNTRY_PRESETS[country];
  document.getElementById('currency-symbol').textContent = preset.symbol;
}

// Create session and initialize Klarna widget
async function createSessionFromInput() {
  const btn = document.getElementById('create-session');
  setLoading(btn, true);
  try {
    const payload = JSON.parse(document.getElementById('json-input').value);
    const sessionData = await apiCall('/api/session', 'POST', payload);

    displayResponse(sessionData);

    if (sessionData.payment_method_categories?.length > 0) {
      const firstMethod = sessionData.payment_method_categories[0];
      if (firstMethod.asset_urls?.standard) {
        displayKlarnaBadge(firstMethod.asset_urls.standard);
      }
    }

    Klarna.Payments.init({ client_token: sessionData.client_token });
    Klarna.Payments.load({
      container: '#klarna-container',
      instanceId: 'payment-widget'
    }, (response) => {
      console.log('Widget loaded:', response.show_form ? 'Success' : 'Warning');
    });

    showSection('checkout-section');
    setActiveStep(2);
  } catch (err) {
    displayResponse({ error: err.message });
  } finally {
    setLoading(btn, false);
  }
}

function displayKlarnaBadge(imageUrl) {
  const container = document.getElementById('klarna-container');
  const existing = container.querySelector('.klarna-badge');
  if (existing) existing.remove();

  const badge = document.createElement('img');
  badge.src = imageUrl;
  badge.alt = 'Klarna Payment Method';
  badge.className = 'klarna-badge';
  container.insertBefore(badge, container.firstChild);
}

function resetExampleJSON() {
  document.getElementById('country-preset').value = 'US';
  document.getElementById('amount-input').value = '100.00';
  document.getElementById('currency-symbol').textContent = '$';
  syncPresetToJSON();
}

function handlePayButtonClick() {
  let payload;
  try {
    payload = JSON.parse(document.getElementById('json-input').value);
  } catch (err) {
    displayResponse({ error: 'Invalid JSON in session payload' });
    return;
  }

  Klarna.Payments.authorize({
    instanceId: 'payment-widget'
  }, async (response) => {
    try {
      displayResponse(response);

      if (!response?.authorization_token) {
        throw new Error('No authorization token received');
      }

      const orderData = await apiCall('/api/create_order', 'POST', { ...response, payload });
      displayResponse(orderData);

      if (orderData.order_id) {
        lastOrderId = orderData.order_id;
        document.getElementById('order-id-input').value = orderData.order_id;
        showSection('order-section');
        setActiveStep(3);
      }
    } catch (err) {
      displayResponse({ error: err.message });
    }
  });
}

async function withLoading(buttonId, fn) {
  const btn = document.getElementById(buttonId);
  setLoading(btn, true);
  try {
    await fn();
  } finally {
    setLoading(btn, false);
  }
}

async function queryOrder() {
  await withLoading('query-order', async () => {
    const orderId = document.getElementById('order-id-input').value.trim();
    if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
    const data = await apiCall(`/api/orders/${orderId}`);
    displayResponse(data);
  });
}

async function captureOrder() {
  await withLoading('capture-order', async () => {
    const orderId = document.getElementById('order-id-input').value.trim();
    if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
    const data = await apiCall(`/api/orders/${orderId}/captures`, 'POST', { amount: 10000 });
    displayResponse(data);
  });
}

async function cancelOrder() {
  await withLoading('cancel-order', async () => {
    const orderId = document.getElementById('order-id-input').value.trim();
    if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
    const data = await apiCall(`/api/orders/${orderId}/cancel`, 'POST');
    displayResponse(data);
  });
}

async function refundOrder() {
  await withLoading('refund-order', async () => {
    const orderId = document.getElementById('order-id-input').value.trim();
    if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
    const data = await apiCall(`/api/orders/${orderId}/refunds`, 'POST', { amount: 10000 });
    displayResponse(data);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-session').addEventListener('click', createSessionFromInput);
  document.getElementById('reset-example').addEventListener('click', resetExampleJSON);
  document.getElementById('pay-button').addEventListener('click', handlePayButtonClick);
  document.getElementById('query-order').addEventListener('click', queryOrder);
  document.getElementById('capture-order').addEventListener('click', captureOrder);
  document.getElementById('cancel-order').addEventListener('click', cancelOrder);
  document.getElementById('refund-order').addEventListener('click', refundOrder);

  document.getElementById('country-preset').addEventListener('change', syncPresetToJSON);
  document.getElementById('amount-input').addEventListener('input', syncPresetToJSON);
});
