# Coolify Deployment — Nail Habit Backend

## 1. Create the service

- New resource → **Docker** → connect your Git repo, branch `main`
- Dockerfile path: `Dockerfile` (root of repo)

## 2. Add a persistent volume

The SQLite database lives here. Without this, user accounts are wiped on every redeploy.

| Field | Value |
|-------|-------|
| Source name | `nail-habit-data` (or any name) |
| Destination path | `/app/data` |

## 3. Environment variables

Set all of these in the Coolify service settings:

```
GOOGLE_CLIENT_ID=123258382265-u1qnmtqe5rtp94vroa1t1d0t3e945ght.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
JWT_SECRET=71938c773fb72a7c34dab129ad87c63608fad24b120917d76ef65df1c76028ed
ELECTRON_PROTOCOL=nailhabit
SERVER_URL=https://your-coolify-domain.com
PORT=3000
```

Replace `your-coolify-domain.com` with the actual domain Coolify assigns.

## 4. Register the redirect URI in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Open the OAuth 2.0 Client ID for this app
3. Under **Authorized redirect URIs**, add:
   ```
   https://your-coolify-domain.com/api/auth/callback
   ```
4. Save

## 5. Update the Electron app

Once the service is live and you have the URL, add it to your local `.env`:

```
API_BASE_URL=https://your-coolify-domain.com
```

Then rebuild the DMG:

```bash
npm run electron:dist:mac
```

## Notes

- The SQLite database file is at `/app/data/users.db` inside the container
- `DATA_DIR` env var can override the data directory path if needed
- `SERVER_URL` must match exactly what is registered in Google Cloud Console (including `https://`)
- PayPal env vars (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`) can be added later when enabling payments
