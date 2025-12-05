# Klarna Payments Demo

A minimal full-stack JavaScript project demonstrating Klarna Payments integration.

## Installation

Ensure [Yarn](https://yarnpkg.com/getting-started/install) is installed globally.

```bash
yarn install
```

## Running the Server

```bash
yarn start
```

The server will start on `http://localhost:3000`.

# Klarna Payments Demo

A minimal full-stack JavaScript project demonstrating Klarna Payments integration.

## Installation

Ensure [Node.js](https://nodejs.org/) and `yarn` are installed.

```bash
yarn install
```

## Running the Server

Development (auto-restarts with changes):

```bash
yarn dev
```

Production:

```bash
yarn start
```

The server will start on `http://localhost:3000` by default.

## Configuration

The `/client_token` endpoint will return the value of the `KLARNA_CLIENT_TOKEN` environment variable if set; otherwise it returns a placeholder string.

Set a token for testing:

```bash
export KLARNA_CLIENT_TOKEN="your_client_token_here"
```

To run the server on a different port:

```bash
export PORT=8080
yarn dev
```

Obtain your client token from the [Klarna Merchant Portal](https://merchantportal.klarna.com/).

You can also create a `.env` file in the project root to store those environment variables locally. An example file `.env.example` is included.

Example `.env` contents:

```text
KLARNA_CLIENT_TOKEN=your_client_token_here
PORT=3000
```

For the end-to-end Klarna Payments integration (creating sessions and orders) the server needs merchant credentials. Set the following environment variables in your `.env` (or in your CI environment):

```text
KLARNA_API_URL=https://api.playground.klarna.com
KLARNA_API_USERNAME=your_klarna_username_or_merchant_id
KLARNA_API_PASSWORD=your_klarna_password_or_shared_secret
PORT=3000
```

Notes:
- Use the Klarna Playground (`https://api.playground.klarna.com`) for testing. Change to the production API when ready.
- The demo `POST /api/session` endpoint creates a payments session and returns the `client_token`. The client uses this token to initialize the Klarna JS SDK.
- The demo `POST /api/create_order` accepts an `authorization_token` from the client and returns success. R

## Project Structure

- `server.js` - Express server with `/client_token` endpoint
- `public/index.html` - Frontend with Klarna Payments widget
- `public/styles.css` - Stylesheet
- `public/script.js` - Script js file
- `package.json` - npm dependencies and scripts