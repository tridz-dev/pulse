# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Export API for data export to various formats (Excel, CSV, PDF)."""

import base64
import csv
import io
import json
from datetime import datetime
from typing import Dict, List, Any, Optional

import frappe
from frappe import _
from frappe.utils import getdate, today


EXPORT_FORMATS = {
    "excel": {"label": "Excel (.xlsx)", "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "extension": "xlsx"},
    "csv": {"label": "CSV (.csv)", "mime": "text/csv", "extension": "csv"},
    "json": {"label": "JSON (.json)", "mime": "application/json", "extension": "json"},
    "pdf": {"label": "PDF (.pdf)", "mime": "application/pdf", "extension": "pdf"},
}

# DocTypes available for export
EXPORTABLE_DOCTYPES = [
    "Pulse Employee",
    "Pulse Branch",
    "Pulse Department",
    "SOP Template",
    "SOP Run",
    "SOP Assignment",
    "Corrective Action",
]


@frappe.whitelist()
def export_to_excel(doctype: str, filters: Dict = None, fields: List[str] = None, limit: int = 10000):
    """Export data to Excel format.
    
    Args:
        doctype: DocType to export
        filters: Filters to apply
        fields: Specific fields to export (None for all)
        limit: Maximum records to export
    
    Returns:
        Dict with base64 encoded file content and metadata
    """
    if not has_export_permission():
        frappe.throw(_("Not permitted to export data"), frappe.PermissionError)
    
    if doctype not in EXPORTABLE_DOCTYPES:
        frappe.throw(_("Export not supported for {0}").format(doctype))
    
    filters = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
    fields = frappe.parse_json(fields) if isinstance(fields, str) else fields
    
    # Get data
    data = _get_export_data(doctype, filters, fields, limit)
    
    if not data:
        return {"success": False, "message": _("No data found for export")}
    
    try:
        # Try to use frappe's Excel export utilities
        from frappe.utils.xlsxutils import make_xlsx
        
        headers = list(data[0].keys())
        rows = [list(row.values()) for row in data]
        
        xlsx_file = make_xlsx([headers] + rows, doctype)
        
        return {
            "success": True,
            "content": base64.b64encode(xlsx_file.read()).decode(),
            "filename": f"{doctype.replace(' ', '_')}_{today()}.xlsx",
            "mime_type": EXPORT_FORMATS["excel"]["mime"],
            "record_count": len(data),
            "headers": headers
        }
        
    except ImportError:
        # Fallback to CSV with note
        return export_to_csv(doctype, filters, fields, limit)


@frappe.whitelist()
def export_to_csv(doctype: str, filters: Dict = None, fields: List[str] = None, limit: int = 10000):
    """Export data to CSV format.
    
    Args:
        doctype: DocType to export
        filters: Filters to apply
        fields: Specific fields to export (None for all)
        limit: Maximum records to export
    
    Returns:
        Dict with base64 encoded file content and metadata
    """
    if not has_export_permission():
        frappe.throw(_("Not permitted to export data"), frappe.PermissionError)
    
    if doctype not in EXPORTABLE_DOCTYPES:
        frappe.throw(_("Export not supported for {0}").format(doctype))
    
    filters = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
    fields = frappe.parse_json(fields) if isinstance(fields, str) else fields
    
    # Get data
    data = _get_export_data(doctype, filters, fields, limit)
    
    if not data:
        return {"success": False, "message": _("No data found for export")}
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
    writer.writeheader()
    writer.writerows(data)
    
    return {
        "success": True,
        "content": base64.b64encode(output.getvalue().encode()).decode(),
        "filename": f"{doctype.replace(' ', '_')}_{today()}.csv",
        "mime_type": EXPORT_FORMATS["csv"]["mime"],
        "record_count": len(data),
        "headers": list(data[0].keys())
    }


@frappe.whitelist()
def generate_run_pdf(run_name: str, include_evidence: bool = False):
    """Generate PDF report for SOP run.
    
    Args:
        run_name: Name of the SOP Run document
        include_evidence: Whether to include photo evidence
    
    Returns:
        Dict with base64 encoded PDF content
    """
    if not has_export_permission():
        frappe.throw(_("Not permitted to generate reports"), frappe.PermissionError)
    
    if not frappe.db.exists("SOP Run", run_name):
        frappe.throw(_("SOP Run not found"))
    
    run = frappe.get_doc("SOP Run", run_name)
    
    # Get template details
    template = frappe.db.get_value(
        "SOP Template",
        run.template,
        ["title", "department"],
        as_dict=True
    ) if run.template else {}
    
    # Get employee details
    employee = frappe.db.get_value(
        "Pulse Employee",
        run.employee,
        ["employee_name", "pulse_role", "branch"],
        as_dict=True
    ) if run.employee else {}
    
    # Get checklist items with outcomes
    items = []
    for item in run.checklist_items or []:
        items.append({
            "sequence": item.sequence,
            "description": item.description,
            "status": item.status,
            "outcome": item.outcome,
            "notes": item.notes,
            "completed_at": str(item.completed_at) if item.completed_at else None,
            "has_evidence": bool(item.evidence_attachment)
        })
    
    # Build report data
    report_data = {
        "run_name": run.name,
        "template": template.get("title", run.template),
        "department": template.get("department"),
        "employee": employee.get("employee_name", run.employee),
        "role": employee.get("pulse_role"),
        "branch": employee.get("branch"),
        "period_date": str(run.period_date),
        "status": run.status,
        "score": run.score,
        "progress": run.progress,
        "items": items,
        "generated_at": frappe.utils.now()
    }
    
    # Generate PDF using frappe's print format
    try:
        html = _generate_run_report_html(report_data, include_evidence)
        pdf_content = frappe.utils.pdf.get_pdf(html)
        
        return {
            "success": True,
            "content": base64.b64encode(pdf_content).decode(),
            "filename": f"SOP_Run_{run_name}_{today()}.pdf",
            "mime_type": EXPORT_FORMATS["pdf"]["mime"],
            "report_data": report_data
        }
        
    except Exception as e:
        frappe.log_error("PDF Generation Error", str(e))
        return {
            "success": False,
            "message": _("Failed to generate PDF: {0}").format(str(e))
        }


@frappe.whitelist()
def get_export_formats():
    """List available export formats.
    
    Returns:
        List of available export formats with metadata
    """
    return {
        "formats": [
            {"id": k, **v} for k, v in EXPORT_FORMATS.items()
        ],
        "exportable_doctypes": EXPORTABLE_DOCTYPES,
        "default_format": "excel"
    }


@frappe.whitelist()
def get_exportable_fields(doctype: str):
    """Get list of exportable fields for a DocType.
    
    Args:
        doctype: DocType to get fields for
    
    Returns:
        List of field definitions
    """
    if doctype not in EXPORTABLE_DOCTYPES:
        return {"error": _("Export not supported")}
    
    # Get standard fields
    fields = [
        {"fieldname": "name", "label": "ID", "fieldtype": "Data"},
        {"fieldname": "creation", "label": "Created On", "fieldtype": "Datetime"},
        {"fieldname": "modified", "label": "Modified On", "fieldtype": "Datetime"},
        {"fieldname": "owner", "label": "Created By", "fieldtype": "Data"},
    ]
    
    # Get DocType fields
    meta = frappe.get_meta(doctype)
    for field in meta.fields:
        if field.fieldtype not in ("Section Break", "Column Break", "Tab Break"):
            fields.append({
                "fieldname": field.fieldname,
                "label": field.label,
                "fieldtype": field.fieldtype
            })
    
    return {
        "doctype": doctype,
        "fields": fields,
        "default_fields": [f["fieldname"] for f in fields[:10]]  # First 10 fields
    }


# Helper functions

def _get_export_data(doctype: str, filters: Dict, fields: List[str], limit: int) -> List[Dict]:
    """Fetch export data with field selection."""
    
    # Build field list
    if fields:
        field_list = fields
    else:
        # Get default fields from meta
        meta = frappe.get_meta(doctype)
        field_list = ["name", "creation", "modified", "owner"]
        field_list += [f.fieldname for f in meta.fields if f.fieldtype not in ("Table", "Section Break", "Column Break")]
    
    # Fetch records
    records = frappe.get_all(
        doctype,
        filters=filters,
        fields=field_list,
        limit=limit,
        order_by="creation desc"
    )
    
    # Enrich data for specific DocTypes
    if doctype == "SOP Run":
        for rec in records:
            if rec.get("template"):
                rec["template_title"] = frappe.db.get_value("SOP Template", rec["template"], "title")
            if rec.get("employee"):
                rec["employee_name"] = frappe.db.get_value("Pulse Employee", rec["employee"], "employee_name")
    
    elif doctype == "Pulse Employee":
        for rec in records:
            if rec.get("branch"):
                rec["branch_name"] = frappe.db.get_value("Pulse Branch", rec["branch"], "branch_name")
            if rec.get("department"):
                rec["department_name"] = frappe.db.get_value("Pulse Department", rec["department"], "department_name")
    
    elif doctype == "Corrective Action":
        for rec in records:
            if rec.get("assigned_to"):
                rec["assigned_to_name"] = frappe.db.get_value("Pulse Employee", rec["assigned_to"], "employee_name")
            if rec.get("raised_by"):
                rec["raised_by_name"] = frappe.db.get_value("Pulse Employee", rec["raised_by"], "employee_name")
    
    return records


def _generate_run_report_html(data: Dict, include_evidence: bool) -> str:
    """Generate HTML for SOP Run PDF report."""
    
    items_html = ""
    for item in data.get("items", []):
        status_color = {
            "Completed": "green",
            "Missed": "red",
            "Pending": "orange"
        }.get(item.get("status"), "gray")
        
        items_html += f"""
        <tr>
            <td>{item.get('sequence', '')}</td>
            <td>{item.get('description', '')}</td>
            <td><span style="color: {status_color}">{item.get('status', '')}</span></td>
            <td>{item.get('outcome', '-')}</td>
            <td>{item.get('completed_at', '-') or '-'}</td>
        </tr>
        """
    
    score_pct = (data.get('score', 0) * 100) if data.get('score') else 0
    score_color = "green" if score_pct >= 80 else "orange" if score_pct >= 60 else "red"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
            .title {{ font-size: 24px; font-weight: bold; margin-bottom: 10px; }}
            .subtitle {{ font-size: 14px; color: #666; }}
            .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }}
            .info-item {{ padding: 10px; background: #f5f5f5; border-radius: 4px; }}
            .label {{ font-weight: bold; color: #666; font-size: 12px; }}
            .value {{ font-size: 14px; margin-top: 4px; }}
            .score {{ font-size: 32px; color: {score_color}; font-weight: bold; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #333; color: white; padding: 12px; text-align: left; }}
            td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
            tr:nth-child(even) {{ background: #f9f9f9; }}
            .footer {{ margin-top: 40px; font-size: 12px; color: #999; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">SOP Run Report</div>
            <div class="subtitle">{data.get('template', 'Unknown Template')}</div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="label">Run ID</div>
                <div class="value">{data.get('run_name', '')}</div>
            </div>
            <div class="info-item">
                <div class="label">Period Date</div>
                <div class="value">{data.get('period_date', '')}</div>
            </div>
            <div class="info-item">
                <div class="label">Employee</div>
                <div class="value">{data.get('employee', '')}</div>
            </div>
            <div class="info-item">
                <div class="label">Role</div>
                <div class="value">{data.get('role', '-')}</div>
            </div>
            <div class="info-item">
                <div class="label">Branch</div>
                <div class="value">{data.get('branch', '-')}</div>
            </div>
            <div class="info-item">
                <div class="label">Status</div>
                <div class="value">{data.get('status', '')}</div>
            </div>
        </div>
        
        <div style="margin: 30px 0; text-align: center;">
            <div class="label">Overall Score</div>
            <div class="score">{score_pct:.1f}%</div>
            <div style="color: #666;">Progress: {data.get('progress', 0):.0f}%</div>
        </div>
        
        <h3>Checklist Items</h3>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Outcome</th>
                    <th>Completed At</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>
        
        <div class="footer">
            Generated on {data.get('generated_at', '')}
        </div>
    </body>
    </html>
    """
    
    return html


def has_export_permission() -> bool:
    """Check if user has permission to export data."""
    user = frappe.session.user
    if user == "Administrator":
        return True
    
    roles = frappe.get_roles(user)
    allowed = {"System Manager", "Pulse Admin", "Pulse Executive", "Pulse Leader", "Pulse Manager"}
    return bool(allowed & set(roles))
