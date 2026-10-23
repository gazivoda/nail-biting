# Desktop app: code signing and notarization

**OWNER TODO.** An agent cannot do any of this: it needs your Apple and Microsoft accounts, a certificate in your
name and money. Until it is done the desktop app builds fine but is **unsigned**: macOS Gatekeeper and Windows
SmartScreen warn on the first open, and some features behave worse (see "What unsigned costs" below).

Nothing here changes how the website works. The desktop app is not advertised anywhere on the site, and it stays that
way until a signed build exists and the `desktop_app` flag is turned on (WS11b writes the marketing page).

## Where things stand

| Piece | State |
|---|---|
| macOS universal build (x64 + arm64 in one `.dmg` and `.zip`), hardened runtime, entitlements, camera usage text | Done, builds locally. Verified unsigned. |
| Windows installer (`nsis`) and portable build | Configured (unchanged); **not built or run** on Windows by the agent. |
| `.github/workflows/desktop.yml` (macOS + Windows, signed if secrets exist, unsigned otherwise) | Written, **never run**. |
| Apple Developer ID certificate, notarization | **You.** Steps below. |
| Windows code-signing | **You.** Options below. |

## The workflow, in one paragraph

`.github/workflows/desktop.yml` runs when you push a tag named `desktop-v<something>` (for example `desktop-v1.0.0`),
or when you press **Run workflow** on the "Desktop app" page in the Actions tab. It builds on `macos-latest` and
`windows-latest` and uploads the installers as **artifacts** (kept 14 days; open the finished run and download them at
the bottom). It publishes nothing. If the secrets named below exist, the build is signed (macOS: and notarized);
if they do not, it still builds, unsigned, and prints a warning. So you can run it today with no secrets to prove it
works.

## macOS: Developer ID signing and notarization

### 1. Apple Developer Program

Join at <https://developer.apple.com/programs/> (paid, yearly; the price is on that page). An organization account
needs a D-U-N-S number and takes longer to approve than an individual one.

### 2. Make the certificate

You need a **Developer ID Application** certificate (not "Apple Development", not "Mac App Store").

1. On a Mac that is signed in to the account: Xcode > Settings > Accounts > select the team > **Manage Certificates** >
   **+** > **Developer ID Application**. (Or create it at developer.apple.com > Certificates, IDs & Profiles.)
2. Open **Keychain Access** > My Certificates > right-click "Developer ID Application: Your Name (TEAMID)" >
   **Export** > save as `DeveloperID.p12` with a password you will remember.
3. Turn it into one line of text for GitHub: `base64 -i DeveloperID.p12 | pbcopy`.

### 3. Notarization credentials (pick ONE set)

**Set A: App Store Connect API key** (recommended by electron-builder; the workflow reads it).
App Store Connect > Users and Access > Integrations > App Store Connect API > Team Keys > **Generate API Key**
(access: Developer or higher). Download the `.p8` file (you can only download it once). Note the **Key ID** and the
**Issuer ID** shown on that page.

**Set B: Apple ID and app-specific password** (simpler, less secure). appleid.apple.com > Sign-In and Security >
App-Specific Passwords > generate one. The Team ID is on developer.apple.com > Membership details.

### 4. Add the secrets in GitHub

Repository > Settings > Secrets and variables > Actions > **New repository secret**. Names must match exactly:

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | the base64 text from step 2.3 |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| **Set A:** `APPLE_API_KEY_P8` | the whole text of the `.p8` file, including the BEGIN/END lines |
| **Set A:** `APPLE_API_KEY_ID` | the Key ID |
| **Set A:** `APPLE_API_ISSUER` | the Issuer ID |
| **Set B:** `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | as described above |

Use one set, not both. electron-builder notarizes by itself when it finds a complete set; the workflow needs no
change. To build signed but skip notarization, add `-c.mac.notarize=false` to the `electron-builder --mac` line.

### 5. Run it and read the result

Actions > Desktop app > Run workflow. In the macOS job log look for:

- `signing  file=release/mac-universal/Stop Biting.app ... identityName=Developer ID Application: <you> (<TEAMID>)`
  (an ad-hoc build says `identityName=-`).
- notarization progress, then success. Apple's service can take a few minutes, occasionally much longer.
- the "Report the signature" step: `Authority=Developer ID Application`, and `source=Notarized Developer ID` from
  `spctl`.

### 6. Test on a clean Mac

Download the `.dmg` from the artifact **through a browser** (so it carries the quarantine flag, like a real user's
download), drag the app to Applications, open it. There must be no "unidentified developer" or "cannot verify" prompt.
Then, on that Mac, check by hand (none of this could be tested by an agent):

- the camera explanation card appears, then macOS's own camera prompt after Continue, and detection starts;
- the menu bar icon appears and its menu works;
- closing the window keeps the app running; Quit really quits;
- "Launch at login" appears in System Settings > General > Login Items, and the app starts hidden at login;
- a native notification shows (System Settings > Notifications > Stop Biting).

### Local signed build (without GitHub)

```bash
export CSC_LINK="$(base64 -i DeveloperID.p12)"        # or a path to the .p12
export CSC_KEY_PASSWORD='...'
export APPLE_API_KEY=/path/to/AuthKey_XXXX.p8 APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER=xxxxxxxx-...   # or the Set B variables
npm run electron:dist:mac
```

Without those variables, `npm run electron:dist:mac` on a Mac that has a Developer ID in its keychain will pick it up
by itself. To force an unsigned build: `CSC_IDENTITY_AUTO_DISCOVERY=false`.

### The entitlements file

`build/entitlements.mac.plist` is already set for hardened runtime: camera, outbound network, and the two
memory exceptions Chromium's V8 needs to run JavaScript and the WebAssembly the hand and face models use
(`allow-jit`, `allow-unsigned-executable-memory`). `disable-library-validation` was in the file before WS7b and is
kept. It is probably removable (it weakens the runtime a little): after the first signed build works on a clean Mac,
try deleting it and building again; if the app still starts, leave it out.

## Windows: code signing

Unsigned Windows installers show **"Windows protected your PC"** (SmartScreen) and the publisher as "Unknown".
Signing removes the unknown publisher; SmartScreen's reputation for a new certificate still has to be earned by
downloads over time (check Microsoft's current rules; they have changed before).

Pick one. All three are configured through GitHub secrets; read the vendor's current page for price and eligibility,
because these services change.

### Option 1: a certificate file (`.pfx`)

Works with the workflow as written. Since 2023 certificate authorities must keep new code-signing keys on a hardware
token or in a cloud HSM, so a plain downloadable `.pfx` is rarer than it used to be; ask the CA whether yours can be
exported. If it can:

1. `base64 -i certificate.pfx` (Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))`).
2. Secrets: `WIN_CSC_LINK` (the base64 text) and `WIN_CSC_KEY_PASSWORD`.

### Option 2: Azure Trusted Signing (Microsoft's managed service)

No certificate file: Microsoft holds the key and you sign through your Azure account. Check Microsoft's page for the
service's current name, which countries and account types can use it, and the price.

1. In Azure: create a Trusted Signing account, complete identity validation, create a **certificate profile**.
2. Create an app registration (service principal) and give it the role that allows signing with that profile.
3. Secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
4. In `package.json`, under `build.win`, add (names verified against electron-builder 26's schema):

   ```json
   "azureSignOptions": {
     "publisherName": "CN=Your Verified Name",
     "endpoint": "https://<region>.codesigning.azure.net",
     "codeSigningAccountName": "<account>",
     "certificateProfileName": "<profile>"
   }
   ```
5. The workflow already passes the `AZURE_*` variables and signs when `AZURE_CLIENT_SECRET` exists. Add the
   `azureSignOptions` block in the same commit in which you add the secrets: a build that has the block but no
   secrets fails.

### Option 3: a cloud-HSM certificate (SSL.com eSigner, DigiCert KeyLocker and similar)

You buy an OV or EV certificate and sign through the vendor's tool. electron-builder calls a custom signing script
(`win.signtoolOptions.sign`); each vendor documents the command. This needs a small script in the repo and a
workflow step to install the vendor's tool, so ask for it as its own task once you have chosen a vendor.

## What unsigned costs (so you can decide how long to wait)

- macOS: the first open needs right-click > Open (and on recent macOS, System Settings > Privacy & Security >
  "Open Anyway"). Notifications and the login item may not work for an unsigned app. A re-built unsigned app is a
  new identity to macOS, so the camera permission is asked again.
- Windows: the SmartScreen warning above; everything else works.
- Both: do not put the installers on the site or tell anyone to install them until you have done the clean-machine
  checks above. Marketing for the desktop app is the `desktop_app` flag and WS11b.

## Also for the owner, not signing

- `COOLIFY_DEPLOY.md` says to set `ELECTRON_PROTOCOL` on the web server. Do not: it is a switch for the **desktop
  sign-in flow** that applies to the whole server, so on the website it breaks Google sign-in (it changes the redirect
  address and the final redirect to `stopbiting://`). Delete that line from the file when you next edit it; I did not
  touch it because it has your uncommitted changes.
- A `desktop-v*` tag does not move `main`, and the website deploys from `main`, so tagging a desktop build should not
  redeploy the site.
- **Signing is not the only thing between this build and a release.** Signing in from the desktop app does not
  complete against the hosted API today (the server's `ELECTRON_PROTOCOL` switch is global, and the packaged app has no
  sign-in button wired to the main process). Details and the fix needed are in `docs/agents/ws7b-notes.md`,
  "Known gaps before a public release".
