# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Import API for bulk data import with validation and preview."""

import base64
import csv
import io
import json
from typing import List, Dict, Any

import frappe
from frappe import _


# Map of importable DocTypes to their field schemas
IMPORT_SCHEMA = {
    "Pulse Employee": {
        "fields": [
            {"name": "employee_name", "required": True, "type": "str"},
            {"name": "pulse_role", "required": True, "type": "link", "options": "Pulse Role"},
            {"name": "branch", "required": True, "type": "link", "options": "Pulse Branch"},
            {"name": "department", "required": False, "type": "link", "options": "Pulse Department"},
            {"name": "reports_to", "required": False, "type": "link", "options": "Pulse Employee"},
            {"name": "is_active", "required": False, "type": "bool", "default": 1},
        ],
        "unique_key": None,
    },
    "Pulse Branch": {
        "fields": [
            {"name": "branch_name", "required": True, "type": "str"},
            {"name": "branch_code", "required": False, "type": "str"},
            {"name": "parent_branch", "required": False, "type": "link", "options": "Pulse Branch"},
            {"name": "is_active", "required": False, "type": "bool", "default": 1},
        ],
        "unique_key": "branch_name",
    },
    "Pulse Department": {
        "fields": [
            {"name": "department_name", "required": True, "type": "str"},
            {"name": "department_code", "required": False, "type": "str"},
            {"name": "is_active", "required": False, "type": "bool", "default": 1},
        ],
        "unique_key": "department_name",
    },
    "SOP Template": {
        "fields": [
            {"name": "title", "required": True, "type": "str"},
            {"name": "department", "required": False, "type": "str"},
            {"name": "frequency_type", "required": True, "type": "select", "options": ["Daily", "Weekly", "Monthly", "Custom"]},
            {"name": "owner_role", "required": False, "type": "link", "options": "Pulse Role"},
            {"name": "is_active", "required": False, "type": "bool", "default": 1},
        ],
        "unique_key": "title",
    },
}


@frappe.whitelist()
def upload_import_template(file_data: str, doctype: str, filename: str = None):
    """Upload and validate import template file.
    
    Args:
        file_data: Base64 encoded file content
        doctype: Target DocType for import
        filename: Original filename for format detection
    
    Returns:
        Dict with validation results and parsed data preview
    """
    if not has_import_permission():
        frappe.throw(_("Not permitted to import data"), frappe.PermissionError)
    
    if doctype not in IMPORT_SCHEMA:
        frappe.throw(_("Import not supported for {0}").format(doctype))
    
    try:
        # Decode file content
        decoded = base64.b64decode(file_data)
        
        # Detect format from filename or content
        fmt = _detect_format(filename or "data.csv")
        
        # Parse based on format
        if fmt == "csv":
            data = _parse_csv(decoded)
        elif fmt == "json":
            data = _parse_json(decoded)
        else:
            frappe.throw(_("Unsupported file format"))
        
        if not data:
            return {
                "valid": False,
                "message": _("No data found in file"),
                "errors": [{"row": 0, "message": "Empty file"}]
            }
        
        # Validate data against schema
        validation = _validate_import_data(data, doctype)
        
        return {
            "valid": validation["valid"],
            "message": validation["message"],
            "total_rows": len(data),
            "valid_rows": validation["valid_count"],
            "error_rows": validation["error_count"],
            "errors": validation["errors"],
            "preview": data[:5] if len(data) > 5 else data,
            "headers": list(data[0].keys()) if data else []
        }
        
    except Exception as e:
        frappe.log_error("Import Upload Error", str(e))
        return {
            "valid": False,
            "message": str(e),
            "errors": [{"row": 0, "message": str(e)}]
        }


@frappe.whitelist()
def get_import_templates(doctype: str = None):
    """List available import templates.
    
    Args:
        doctype: Filter by specific DocType (optional)
    
    Returns:
        List of available templates with metadata
    """
    templates = []
    
    for dt, schema in IMPORT_SCHEMA.items():
        if doctype and dt != doctype:
            continue
        
        templates.append({
            "doctype": dt,
            "label": dt.replace("Pulse ", ""),
            "fields": [f["name"] for f in schema["fields"]],
            "required_fields": [f["name"] for f in schema["fields"] if f.get("required")],
            "description": _("Import {0} records").format(dt)
        })
    
    return templates


@frappe.whitelist()
def download_import_template(doctype: str, format: str = "csv"):
    """Download empty import template with headers.
    
    Args:
        doctype: Target DocType
        format: Output format (csv or json)
    
    Returns:
        Dict with file content (base64 encoded) and metadata
    """
    if doctype not in IMPORT_SCHEMA:
        frappe.throw(_("Template not available for {0}").format(doctype))
    
    schema = IMPORT_SCHEMA[doctype]
    headers = [f["name"] for f in schema["fields"]]
    
    # Add example row with sample data
    example_row = {}
    for field in schema["fields"]:
        if field["type"] == "bool":
            example_row[field["name"]] = 1
        elif field["type"] == "link":
            example_row[field["name"]] = _("Example {0}").format(field["options"])
        elif field["type"] == "select":
            example_row[field["name"]] = field["options"][0] if field["options"] else ""
        else:
            example_row[field["name"]] = _("Sample ") + field["name"].replace("_", " ").title()
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerow(example_row)
        content = output.getvalue()
        mime = "text/csv"
        filename = f"{doctype.replace(' ', '_')}_template.csv"
    else:
        content = json.dumps([example_row], indent=2)
        mime = "application/json"
        filename = f"{doctype.replace(' ', '_')}_template.json"
    
    return {
        "content": base64.b64encode(content.encode()).decode(),
        "filename": filename,
        "mime_type": mime,
        "headers": headers,
        "required": [f["name"] for f in schema["fields"] if f.get("required")]
    }


@frappe.whitelist()
def preview_import_data(data: List[Dict], doctype: str):
    """Preview data before executing import.
    
    Args:
        data: List of row dictionaries to preview
        doctype: Target DocType
    
    Returns:
        Dict with preview analysis and validation results
    """
    if not has_import_permission():
        frappe.throw(_("Not permitted to import data"), frappe.PermissionError)
    
    if isinstance(data, str):
        data = json.loads(data)
    
    validation = _validate_import_data(data, doctype)
    
    # Generate detailed preview
    preview_rows = []
    for idx, row in enumerate(data[:10]):
        row_errors = [e for e in validation["errors"] if e.get("row") == idx + 1]
        preview_rows.append({
            "row": idx + 1,
            "data": row,
            "valid": len(row_errors) == 0,
            "errors": row_errors
        })
    
    # Calculate statistics
    stats = {
        "total": len(data),
        "valid": validation["valid_count"],
        "errors": validation["error_count"],
        "create": 0,
        "update": 0
    }
    
    schema = IMPORT_SCHEMA.get(doctype, {})
    unique_key = schema.get("unique_key")
    
    if unique_key:
        for row in data:
            if row.get(unique_key) and frappe.db.exists(doctype, {unique_key: row.get(unique_key)}):
                stats["update"] += 1
            else:
                stats["create"] += 1
    else:
        stats["create"] = stats["valid"]
    
    return {
        "preview_rows": preview_rows,
        "statistics": stats,
        "validation": validation,
        "can_import": validation["valid_count"] > 0
    }


@frappe.whitelist()
def execute_import(data: List[Dict], doctype: str, options: Dict = None):
    """Execute the import after validation.
    
    Args:
        data: List of row dictionaries to import
        doctype: Target DocType
        options: Import options (skip_errors, update_existing, etc.)
    
    Returns:
        Dict with import results summary
    """
    if not has_import_permission():
        frappe.throw(_("Not permitted to import data"), frappe.PermissionError)
    
    if isinstance(data, str):
        data = json.loads(data)
    if isinstance(options, str):
        options = json.loads(options)
    
    options = options or {}
    skip_errors = options.get("skip_errors", True)
    update_existing = options.get("update_existing", False)
    
    validation = _validate_import_data(data, doctype)
    
    if not validation["valid"] and not skip_errors:
        return {
            "success": False,
            "message": _("Validation failed. Fix errors or enable skip_errors"),
            "errors": validation["errors"]
        }
    
    # Execute import
    created = []
    updated = []
    failed = []
    
    schema = IMPORT_SCHEMA.get(doctype, {})
    unique_key = schema.get("unique_key")
    
    for idx, row in enumerate(data):
        try:
            # Check for existing record if update mode enabled
            existing_name = None
            if unique_key and row.get(unique_key):
                existing = frappe.db.exists(doctype, {unique_key: row.get(unique_key)})
                if existing:
                    existing_name = existing
            
            if existing_name and update_existing:
                # Update existing
                doc = frappe.get_doc(doctype, existing_name)
                for field, value in row.items():
                    if field != "name" and hasattr(doc, field):
                        setattr(doc, field, value)
                doc.save()
                updated.append(doc.name)
            elif not existing_name:
                # Create new
                doc_dict = {"doctype": doctype}
                doc_dict.update(row)
                doc = frappe.get_doc(doc_dict)
                doc.insert()
                created.append(doc.name)
            else:
                skipped_reason = _("Record exists (update_existing disabled)")
                failed.append({"row": idx + 1, "reason": skipped_reason})
                
        except Exception as e:
            failed.append({"row": idx + 1, "reason": str(e)})
            if not skip_errors:
                frappe.db.rollback()
                raise
    
    frappe.db.commit()
    
    return {
        "success": len(created) > 0 or len(updated) > 0,
        "message": _("Import complete: {0} created, {1} updated, {2} failed").format(
            len(created), len(updated), len(failed)
        ),
        "created": created,
        "updated": updated,
        "failed": failed,
        "counts": {
            "total": len(data),
            "created": len(created),
            "updated": len(updated),
            "failed": len(failed)
        }
    }


# Helper functions

def _detect_format(filename: str) -> str:
    """Detect file format from filename."""
    if filename.lower().endswith(".csv"):
        return "csv"
    elif filename.lower().endswith(".json"):
        return "json"
    return "csv"  # Default


def _parse_csv(content: bytes) -> List[Dict]:
    """Parse CSV content to list of dicts."""
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def _parse_json(content: bytes) -> List[Dict]:
    """Parse JSON content to list of dicts."""
    text = content.decode("utf-8")
    data = json.loads(text)
    if isinstance(data, dict):
        # Single record wrapped as list
        return [data]
    return data


def _validate_import_data(data: List[Dict], doctype: str) -> Dict:
    """Validate import data against schema."""
    if doctype not in IMPORT_SCHEMA:
        return {"valid": False, "message": _("Unknown DocType"), "errors": []}
    
    schema = IMPORT_SCHEMA[doctype]
    fields = schema["fields"]
    required_fields = [f["name"] for f in fields if f.get("required")]
    
    errors = []
    valid_count = 0
    
    for idx, row in enumerate(data):
        row_num = idx + 1
        row_errors = []
        
        # Check required fields
        for field in required_fields:
            if not row.get(field):
                row_errors.append(_("Missing required field: {0}").format(field))
        
        # Validate field types
        for field_def in fields:
            field_name = field_def["name"]
            value = row.get(field_name)
            
            if value and field_def["type"] == "bool":
                if str(value).lower() not in ("1", "0", "true", "false", "yes", "no"):
                    row_errors.append(_("Invalid boolean value for {0}").format(field_name))
            
            if value and field_def["type"] == "link":
                # Validate link field exists (optional, can be slow)
                pass
        
        if row_errors:
            errors.append({"row": row_num, "errors": row_errors})
        else:
            valid_count += 1
    
    return {
        "valid": len(errors) == 0,
        "message": _("Valid") if len(errors) == 0 else _("Found {0} errors").format(len(errors)),
        "valid_count": valid_count,
        "error_count": len(errors),
        "errors": errors
    }


def has_import_permission() -> bool:
    """Check if user has permission to import data."""
    user = frappe.session.user
    if user == "Administrator":
        return True
    
    roles = frappe.get_roles(user)
    allowed = {"System Manager", "Pulse Admin", "Pulse Executive"}
    return bool(allowed & set(roles))
