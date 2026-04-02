# Klarna Payments Demo

A minimal full-stack JavaScript project demonstrating Klarna Payments integration with session creation, payment authorization, and order management.

## Installation

Ensure [Node.js](https://nodejs.org/) (v18+) and [Yarn](https://yarnpkg.com/getting-started/install) are installed.

```bash
yarn install
```

## Configuration

Copy the example environment file and fill in your Klarna Playground credentials:

```bash
cp .env.example .env
```

Required variables in `.env`:

```text
KLARNA_API_URL=https://api-na.playground.klarna.com
KLARNA_API_USERNAME=your_klarna_username_or_merchant_id
KLARNA_API_PASSWORD=your_klarna_password_or_shared_secret
PORT=3000
```

Obtain credentials from the [Klarna Merchant Portal](https://merchantportal.klarna.com/). Use the Playground URL for testing; switch to the production API URL when ready.

## Running the Server

Development (auto-restarts on file changes):

```bash
yarn dev
```

Production:

```bash
yarn start
```

The server starts at `http://localhost:3000` by default.

## Usage

1. **Create Session** — Select a country/currency preset and amount, then click "Create Session". The server calls Klarna's Payments API and returns a `client_token`.
2. **Authorize Payment** — The Klarna widget loads automatically. Click "Continue with Klarna" to authorize. On success you receive an `authorization_token`.
3. **Manage Order** — After placing an order, use the Order Management section to query, capture, cancel, or refund.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check with uptime and config status |
| `/api/session` | POST | Create a Klarna payment session |
| `/api/create_order` | POST | Place an order with an authorization token |
| `/api/orders/:id` | GET | Query order details |
| `/api/orders/:id/captures` | POST | Capture authorized amount |
| `/api/orders/:id/cancel` | POST | Cancel an order |
| `/api/orders/:id/refunds` | POST | Refund a captured order |
| `/api/webhooks/klarna` | POST | Receive Klarna push notifications |

## Features

- **Country/currency presets** — Quick-select from US, SE, DE, GB, AU, and more
- **Human-readable amount input** — Enter amounts in major units (e.g. $100.00); auto-converts to minor units
- **Step-by-step flow** — Progressive disclosure guides you through session -> authorization -> order management
- **Loading states** — Spinners and disabled buttons during API calls
- **Input validation** — Server-side validation of countries, currencies, amounts, and order IDs
- **Rate limiting** — 30 requests/minute per IP on API endpoints
- **Retry logic** — Automatic retries with exponential backoff for transient Klarna API failures
- **Request logging** — Logs method, path, status code, and response time for every request
- **Health check** — `GET /health` for monitoring

## Project Structure

```
klarna-payments-demo/
├── server.js              Express server with API routes and Klarna integration
├── public/
│   ├── index.html         Frontend with payment widget and order management UI
│   ├── script.js          Client-side logic, presets, loading states
│   └── styles.css         Stylesheet with responsive design
├── tests/
│   └── server.test.js     API route tests (Jest + Supertest)
├── package.json           Dependencies and scripts
├── .env.example           Example environment variables
├── .eslintrc.json         ESLint configuration
└── .prettierrc            Prettier configuration
```

## Development

Lint and format:

```bash
yarn lint
yarn format
```

Run tests:

```bash
yarn test
```
