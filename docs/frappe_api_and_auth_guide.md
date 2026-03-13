# Huf API & Authentication Guide

This document provides a comprehensive overview of how authentication, API connections, and data operations work in the Huf application (built on the Frappe Framework).

## 1. Core Architecture

The application uses a **Frontend-Backend** architecture where:
-   **Backend**: Frappe Framework (Python) provides a RESTful API and whitelisted methods.
-   **Frontend**: Vite + React (TypeScript) uses `frappe-js-sdk` to interact with the backend.

### Key Libraries
-   [frappe-js-sdk](https://github.com/frappe/frappe-js-sdk): The primary library for interacting with Frappe APIs.
-   `socket.io-client`: Used for real-time streaming (e.g., in `StreamChatApi`).

---

## 2. Authentication & Credentials

Huf relies on Frappe's built-in authentication system.

### How it Works
1.  **Session-Based**: By default, Frappe uses session cookies. When the frontend is hosted on the same domain (or correctly configured CORS), the browser automatically sends cookies with every request.
2.  **Initialization**: The SDK is initialized in `@/lib/frappe-sdk.ts`.

```typescript
// frontend/src/lib/frappe-sdk.ts
import { FrappeApp } from 'frappe-js-sdk';

const frappeUrl = import.meta.env.VITE_FRAPPE_URL || window.location.origin;

export const frappe = new FrappeApp(frappeUrl);
export const auth = frappe.auth(); // Handles login/logout/session
export const db = frappe.db();     // Handles DocType CRUD
export const call = frappe.call(); // Handles custom whitelisted methods
```

### Passing Credentials
The `frappe-js-sdk` handles credential passing (cookies or Bearer tokens) automatically once authenticated. You don't usually need to manually set headers for standard Huf-to-Frappe calls.

---

## 3. Reading Data (DocTypes)

All data in Frappe is stored in **DocTypes**.

### Fetching a Single Document
Use `db.getDoc(doctype, name)`.

```typescript
const agent = await db.getDoc('Agent', 'my-agent-name');
```

### Fetching Lists (with Filters & Ordering)
Use `db.getDocList(doctype, options)`.

```typescript
const agents = await db.getDocList('Agent', {
  fields: ['name', 'agent_name', 'disabled'],
  filters: [['disabled', '=', 0]],
  orderBy: { field: 'modified', order: 'desc' },
  limit: 20
});
```

---

## 4. Pagination & Counting

Frappe supports pagination via `limit_page_length` (aliased as `limit`) and `limit_start` (aliased as `start`).

### Pagination Pattern
```typescript
/**
 * Example paginated fetch
 */
export async function getAgents(page = 1, limit = 20) {
  const start = (page - 1) * limit;

  const items = await db.getDocList('Agent', {
    fields: ['*'],
    limit: limit,
    limit_start: start,
  });

  return items;
}
```

### Getting Total Count
Frappe doesn't return the total count in the list response. You must call `frappe.client.get_count`.

```typescript
// frontend/src/services/utilsApi.ts
export async function fetchDocCount(targetDoctype, filters = []) {
  const response = await call.get('frappe.client.get_count', {
    doctype: targetDoctype,
    filters: JSON.stringify(filters)
  });
  return response.message; // Returns the number
}
```

---

## 5. Custom Endpoints (Whitelisted Methods)

When standard DocType CRUD isn't enough, we use Python functions whitelisted with `@frappe.whitelist()`.

### Backend (Python)
```python
# huf/ai/agent_integration.py
@frappe.whitelist()
def run_agent_sync(agent_name, prompt, ...):
    # logic here
    return {"status": "success", "response": "..."}
```

### Frontend (TypeScript)
Use `call.get` or `call.post` with the dotted path to the function.

```typescript
const result = await call.post('huf.ai.agent_integration.run_agent_sync', {
  agent_name: 'MyAgent',
  prompt: 'Hello AI'
});
console.log(result.message.response);
```

---

## 6. CRUD Operations

| Operation | SDK Method |
| :--- | :--- |
| **Create** | `db.createDoc('DocType', data)` |
| **Update** | `db.updateDoc('DocType', name, data)` |
| **Delete** | `db.deleteDoc('DocType', name)` |

Example Update:
```typescript
await db.updateDoc('Agent', 'Agent-001', { disabled: 1 });
```

---

## 7. Error Handling

Huf uses a central utility `handleFrappeError` to process API errors.

```typescript
// frontend/src/lib/frappe-error.ts
import { showToast } from '@/components/ui/toast';

export function handleFrappeError(error: any, message: string) {
  console.error(message, error);
  // Implementation details for showing UI alerts
}
```

Usage in services:
```typescript
try {
  return await db.getDoc('Agent', name);
} catch (error) {
  handleFrappeError(error, `Failed to load agent ${name}`);
}
```

---

## 8. Summary Checklist for API Calling
1.  **Check DocType**: Ensure the DocType exists in [frontend/src/data/doctypes.ts](file:///Users/safwan/Code/HUF/huf/frontend/src/data/doctypes.ts).
2.  **Define Types**: Create or update TypeScript interfaces in `frontend/src/types/`.
3.  **Implement Service**: Create the API function in `frontend/src/services/`.
4.  **Handle Pagination**: Use `limit` and `limit_start` if the list is long.
5.  **Whitelist**: If adding a new backend method, ensure it has `@frappe.whitelist()`.
