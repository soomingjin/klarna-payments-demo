let lastOrderId = null;

const DEFAULT_PAYLOAD = {
  purchase_country: 'US',
  purchase_currency: 'USD',
  locale: 'en-US',
  order_amount: 10000,
  order_lines: [{
    reference: '19-402',
    name: 'Battery Power Pack',
    quantity: 1,
    unit_price: 10000,
    total_amount: 10000
  }]
};

// Helper to display responses
function displayResponse(data) {
  document.getElementById('response').textContent = JSON.stringify(data, null, 2);
}

// Helper for API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  
  const resp = await fetch(endpoint, opts);
  const data = await resp.json();
  
  if (!resp.ok) throw new Error(data.error || 'API error');
  return data;
}

// Create session and initialize Klarna widget
async function createSessionFromInput() {
  try {
    const payload = JSON.parse(document.getElementById('json-input').value);
    const sessionData = await apiCall('/api/session', 'POST', payload);
    
    displayResponse(sessionData);
    
    // Extract and display Klarna badge from asset URLs
    if (sessionData.payment_method_categories && sessionData.payment_method_categories.length > 0) {
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
  } catch (err) {
    displayResponse({ error: err.message });
  }
}

// Display Klarna badge from asset URL
function displayKlarnaBadge(imageUrl) {
  const container = document.getElementById('klarna-container');
  const badge = document.createElement('img');
  badge.src = imageUrl;
  badge.alt = 'Klarna Payment Method';
  badge.style.width = '100px';
  badge.style.marginBottom = '16px';
  badge.style.display = 'block';
  container.insertBefore(badge, container.firstChild);
}

// Reset to default example
function resetExampleJSON() {
  document.getElementById('json-input').value = JSON.stringify(DEFAULT_PAYLOAD, null, 2);
}

// Authorize and create order
function handlePayButtonClick() {
  const payload = JSON.parse(document.getElementById('json-input').value);
  
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
      }
    } catch (err) {
      displayResponse({ error: err.message });
    }
  });
}

// Query order
async function queryOrder() {
  const orderId = document.getElementById('order-id-input').value.trim();
  if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
  
  try {
    const data = await apiCall(`/api/orders/${orderId}`);
    displayResponse(data);
  } catch (err) {
    displayResponse({ error: err.message });
  }
}

// Capture order
async function captureOrder() {
  const orderId = document.getElementById('order-id-input').value.trim();
  if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
  
  try {
    const data = await apiCall(`/api/orders/${orderId}/captures`, 'POST', {
      amount: 10000
    });
    displayResponse(data);
  } catch (err) {
    displayResponse({ error: err.message });
  }
}

// Cancel order
async function cancelOrder() {
  const orderId = document.getElementById('order-id-input').value.trim();
  if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
  
  try {
    const data = await apiCall(`/api/orders/${orderId}/cancel`, 'POST');
    displayResponse(data);
  } catch (err) {
    displayResponse({ error: err.message });
  }
}

// Refund order
async function refundOrder() {
  const orderId = document.getElementById('order-id-input').value.trim();
  if (!orderId) return displayResponse({ error: 'Please enter an Order ID' });
  
  try {
    const data = await apiCall(`/api/orders/${orderId}/refunds`, 'POST', {
      amount: 10000
    });
    displayResponse(data);
  } catch (err) {
    displayResponse({ error: err.message });
  }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-session').addEventListener('click', createSessionFromInput);
  document.getElementById('reset-example').addEventListener('click', resetExampleJSON);
  document.getElementById('pay-button').addEventListener('click', handlePayButtonClick);
  document.getElementById('query-order').addEventListener('click', queryOrder);
  document.getElementById('capture-order').addEventListener('click', captureOrder);
  document.getElementById('cancel-order').addEventListener('click', cancelOrder);
  document.getElementById('refund-order').addEventListener('click', refundOrder);
});
