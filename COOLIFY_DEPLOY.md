# Coolify Deployment — Stop Biting

## 1. Create the service

- New resource → **Nixpacks** → connect your Git repo, branch `main`

## 2. Add a persistent volume

The SQLite database lives here. Without this, user accounts are wiped on every redeploy.

| Field | Value |
|-------|-------|
| Source name | `stop-biting-data` (or any name) |
| Destination path | `/app/data` |

## 3. Environment variables

Set all of these in the Coolify service settings:

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ELECTRON_PROTOCOL=stopbiting
APP_URL=https://stopbiting.today
PORT=3000
DATA_DIR=/app/data
```

## 4. Register the redirect URI in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Open the OAuth 2.0 Client ID for this app
3. Under **Authorized redirect URIs**, add:
   ```
   https://stopbiting.today/api/auth/callback
   ```
4. Save

## 5. Build args (baked into frontend at build time)

```
VITE_PAYPAL_CLIENT_ID=<PayPal client ID>
VITE_PAYPAL_PLAN_ID_MONTHLY=<PayPal monthly plan ID>
VITE_PAYPAL_PLAN_ID_YEARLY=<PayPal yearly plan ID>
```

## Notes

- The SQLite database file is at `/app/data/users.db` inside the container
- `DATA_DIR` env var controls the data directory path
- `APP_URL` must match exactly what is registered in Google Cloud Console (including `https://`)
- PayPal env vars can be added later when enabling payments
