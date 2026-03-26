---
name: browserless-testing
description: Automated browser testing using browserless (Chromium) in Docker environments. Use when Playwright local browser launch fails due to sandbox restrictions, when taking screenshots of web apps for verification, or when testing authenticated pages programmatically. Covers REST API endpoints for screenshots, content extraction, and custom automation scripts.
---

# Browserless Testing Skill

Automated browser testing via browserless REST API when local browser launch fails.

## When to Use This Skill

- Local Chrome/Chromium sandbox restrictions ("Operation not permitted" errors)
- Docker/container environments without privileged browser access
- Automated screenshot capture for UI verification
- Testing authenticated/logged-in pages
- CI/CD pipeline browser automation

## Connection Details

| Property | Value |
|----------|-------|
| Host IP (from container) | `192.168.97.1` |
| Port | `3000` |
| Token | `123` (if configured) |
| Health Check | `http://192.168.97.1:3000/pressure?token=123` |

> ⚠️ **Note:** Hostname `browserless` is NOT resolvable from within containers due to Docker DNS limitations. Always use the host IP `192.168.97.1`.

## API Endpoints

### 1. Screenshot API

Capture page screenshots with optional authentication.

**Basic Screenshot:**
```bash
curl -X POST "http://192.168.97.1:3000/screenshot?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "waitFor": 3000,
    "viewport": {"width": 1400, "height": 900}
  }' \
  --output screenshot.png
```

**Authenticated Screenshot:**
```bash
# First get session cookie via API login
curl -X POST "http://192.168.97.5:8001/api/method/login" \
  -c cookies.txt \
  -d '{"usr": "user@example.com", "pwd": "password"}'

# Extract sid cookie value
SID=$(grep sid cookies.txt | awk '{print $7}')

# Use cookie in screenshot
curl -X POST "http://192.168.97.1:3000/screenshot?token=123" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"http://192.168.97.5:8001/pulse/admin/branches\",
    \"cookies\": [
      {\"name\": \"sid\", \"value\": \"$SID\", \"domain\": \"192.168.97.5\", \"path\": \"/\"},
      {\"name\": \"system_user\", \"value\": \"yes\", \"domain\": \"192.168.97.5\", \"path\": \"/\"}
    ],
    \"waitFor\": 4000,
    \"viewport\": {\"width\": 1400, \"height\": 900}
  }" \
  --output logged_in_screenshot.png
```

### 2. Content API

Extract page HTML content.

```bash
curl -X POST "http://192.168.97.1:3000/content?token=123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://192.168.97.5:8001/pulse",
    "viewport": {"width": 1280, "height": 720}
  }'
```

### 3. Function API

Execute custom Playwright scripts.

```bash
curl -X POST "http://192.168.97.1:3000/function?token=123" \
  -H "Content-Type: application/javascript" \
  -d 'module.exports = async ({ page }) => {
    // Navigate and login
    await page.goto("http://192.168.97.5:8001/pulse");
    await page.fill("#login_email", "user@example.com");
    await page.fill("#login_password", "password");
    await page.click(".btn-login");
    await page.waitForTimeout(3000);
    
    // Take screenshot
    const screenshot = await page.screenshot({ encoding: "base64" });
    
    return { 
      url: page.url(), 
      title: await page.title(),
      screenshotSize: screenshot.length 
    };
  };'
```

## Common Patterns

### Pattern 1: Login → Screenshot Flow

```bash
#!/bin/bash
# login_and_screenshot.sh

SITE="http://192.168.97.5:8001"
BROWSERLESS="http://192.168.97.1:3000"
TOKEN="123"
EMAIL="chairman@pm.local"
PASSWORD="Demo@123"

# Step 1: Login and get session
curl -s -X POST "$SITE/api/method/login" \
  -c /tmp/cookies.txt \
  -d "{\"usr\": \"$EMAIL\", \"pwd\": \"$PASSWORD\"}"

# Step 2: Extract sid
SID=$(grep sid /tmp/cookies.txt | tail -1 | awk '{print $7}')

# Step 3: Screenshot with auth
curl -s -X POST "$BROWSERLESS/screenshot?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$SITE/pulse\",
    \"cookies\": [
      {\"name\": \"sid\", \"value\": \"$SID\", \"domain\": \"192.168.97.5\", \"path\": \"/\"},
      {\"name\": \"system_user\", \"value\": \"yes\", \"domain\": \"192.168.97.5\", \"path\": \"/\"}
    ],
    \"waitFor\": 4000,
    \"viewport\": {\"width\": 1400, \"height\": 900}
  }" \
  --output dashboard.png

echo "Screenshot saved: dashboard.png"
```

### Pattern 2: Multiple Page Screenshots

```bash
# Capture multiple admin pages after login
PAGES=(
  "/pulse"
  "/pulse/admin/branches"
  "/pulse/admin/employees"
  "/pulse/admin/departments"
)

for page in "${PAGES[@]}"; do
  filename=$(echo "$page" | sed 's/\//_/g').png
  curl -X POST "$BROWSERLESS/screenshot?token=$TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"$SITE$page\",
      \"cookies\": [{\"name\": \"sid\", \"value\": \"$SID\", \"domain\": \"192.168.97.5\", \"path\": \"/\"}],
      \"waitFor\": 4000,
      \"viewport\": {\"width\": 1400, \"height\": 900}
    }" \
    --output "$filename"
  echo "Saved: $filename"
done
```

## Troubleshooting

### Cannot Resolve Host
```
curl: (6) Could not resolve host: browserless
```
**Fix:** Use IP `192.168.97.1` instead of hostname `browserless`.

### Connection Refused
```
curl: (7) Failed to connect
```
**Fix:** Check browserless container is running:
```bash
curl "http://192.168.97.1:3000/pressure?token=123"
```

### Screenshot is HTML Error
Check response Content-Type. If HTML, the API endpoint is wrong. Use POST with proper JSON body.

### Page Not Loading
Increase `waitFor` timeout for JavaScript-heavy apps:
```json
{"waitFor": 10000}
```

## Docker Compose Configuration

```yaml
browserless:
  image: ghcr.io/browserless/chromium:latest
  ports:
    - 3000:3000
  environment:
    - CONNECTION_TIMEOUT=60000
    - MAX_CONCURRENT_SESSIONS=10
    - TOKEN=123  # Optional authentication
```

## Environment-Specific IPs

| Environment | Host IP |
|-------------|---------|
| Docker Desktop (Linux) | `192.168.97.1` |
| Docker Mac/Windows | `host.docker.internal` |
| Custom bridge | Check `ip route` default gateway |

To find your host IP from container:
```bash
ip route | grep default | awk '{print $3}'
```

## Related Skills

- `pulse-admin` - For testing Pulse app admin features
- `frappe-pulse-dev` - For full Pulse development workflow
