import { FrappeApp } from 'frappe-js-sdk';

const frappeUrl = import.meta.env.VITE_FRAPPE_URL || '';

export const frappe = new FrappeApp(frappeUrl);
export const auth = frappe.auth();
export const db = frappe.db();
export const call = frappe.call();
export const file = frappe.file();
