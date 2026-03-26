# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""OCR (Optical Character Recognition) API for document processing.

This module provides endpoints for processing scanned documents,
extracting structured data, and matching to SOP templates.
"""

import base64
import io
import re
from datetime import datetime
from typing import Dict, List, Optional, Any

import frappe
from frappe import _

# Try to import PIL for image processing
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


@frappe.whitelist()
def process_document(image_data: str, template_id: Optional[str] = None) -> Dict[str, Any]:
    """Process a document image and extract structured data.
    
    Args:
        image_data: Base64-encoded image data or image URL
        template_id: Optional OCR template ID for structured extraction
        
    Returns:
        Dict with extracted text, fields, and processing metadata
    """
    try:
        # Decode and validate image
        image_bytes = _decode_image(image_data)
        if not image_bytes:
            return {
                "success": False,
                "error": "Invalid image data"
            }
        
        # In production, this would use pytesseract or cloud OCR service
        # For now, simulate OCR processing
        extracted_text = _simulate_ocr(image_bytes)
        
        # Extract structured fields
        extracted_fields = []
        
        if template_id:
            # Use template for structured extraction
            template = get_ocr_template(template_id)
            if template:
                extracted_fields = _extract_with_template(extracted_text, template)
        else:
            # Generic extraction
            extracted_fields = _extract_generic_fields(extracted_text)
        
        # Extract checklist items if present
        checklist_items = extract_checklist_items(extracted_text)
        
        return {
            "success": True,
            "extracted_text": extracted_text,
            "extracted_fields": extracted_fields,
            "checklist_items": checklist_items,
            "confidence": 85,  # Simulated confidence
            "processing_time": 1.2,
            "template_matched": template_id is not None
        }
        
    except Exception as e:
        frappe.log_error("OCR Processing Error", str(e))
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to process document"
        }


@frappe.whitelist()
def extract_checklist_items(text: str) -> List[Dict[str, Any]]:
    """Extract checklist items from OCR text.
    
    Identifies checkboxes and their associated text in the document.
    
    Args:
        text: Raw OCR text
        
    Returns:
        List of checklist items with text and checked status
    """
    items = []
    
    # Pattern for common checkbox formats
    checkbox_patterns = [
        # [x], [X], [✓], [✔], [✗]
        (r'\[\s*([xX✓✔✗])\s*\]\s*(.+?)(?=\n|\[|$)', True),
        # [ ], [  ], empty checkbox
        (r'\[\s*\]\s*(.+?)(?=\n|\[|$)', False),
        # (x), (X) - parenthesis format
        (r'\(\s*([xX✓✔✗])\s*\)\s*(.+?)(?=\n|\(|$)', True),
        # ( ) - empty parenthesis
        (r'\(\s*\)\s*(.+?)(?=\n|\(|$)', False),
        # Unicode ballot box characters
        (r'(☑|☒)\s*(.+?)(?=\n|$)', True),
        (r'☐\s*(.+?)(?=\n|$)', False),
    ]
    
    for pattern, checked_if_match in checkbox_patterns:
        matches = re.finditer(pattern, text, re.MULTILINE | re.DOTALL)
        for match in matches:
            if checked_if_match:
                # Group 2 is the text for checked patterns
                item_text = match.group(2).strip() if len(match.groups()) > 1 else match.group(1).strip()
                checked = match.group(1) in ['x', 'X', '✓', '✔', '☑', '☒']
            else:
                # Group 1 is the text for unchecked patterns
                item_text = match.group(1).strip()
                checked = False
            
            # Clean up the text
            item_text = re.sub(r'\s+', ' ', item_text).strip()
            
            if item_text and len(item_text) > 2:  # Filter out very short items
                items.append({
                    "text": item_text,
                    "checked": checked,
                    "confidence": 90
                })
    
    # Remove duplicates while preserving order
    seen = set()
    unique_items = []
    for item in items:
        key = item["text"].lower()
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
    
    return unique_items


@frappe.whitelist()
def match_template(extracted_data: Dict, template_id: str) -> Dict[str, Any]:
    """Match extracted data to an SOP template.
    
    Args:
        extracted_data: Data extracted from document
        template_id: SOP template ID to match against
        
    Returns:
        Dict with match results and field mappings
    """
    try:
        if not frappe.db.exists("SOP Template", template_id):
            return {
                "success": False,
                "error": "Template not found"
            }
        
        template = frappe.get_doc("SOP Template", template_id)
        checklist_items = template.checklist_items or []
        
        # Match extracted checklist items to template items
        matched_items = []
        unmatched_items = []
        
        extracted_items = extracted_data.get("checklist_items", [])
        
        for extracted in extracted_items:
            best_match = None
            best_score = 0
            
            for template_item in checklist_items:
                score = _calculate_text_similarity(
                    extracted["text"],
                    template_item.description
                )
                if score > best_score and score > 0.6:  # 60% similarity threshold
                    best_score = score
                    best_match = template_item
            
            if best_match:
                matched_items.append({
                    "extracted_text": extracted["text"],
                    "template_item": best_match.name,
                    "template_description": best_match.description,
                    "similarity": best_score,
                    "checked": extracted.get("checked", False)
                })
            else:
                unmatched_items.append(extracted)
        
        match_rate = len(matched_items) / len(extracted_items) if extracted_items else 0
        
        return {
            "success": True,
            "template_id": template_id,
            "template_title": template.title,
            "match_rate": match_rate,
            "matched_items": matched_items,
            "unmatched_items": unmatched_items,
            "suggested_action": "create_run" if match_rate > 0.7 else "manual_review"
        }
        
    except Exception as e:
        frappe.log_error("Template Matching Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_ocr_templates() -> List[Dict[str, Any]]:
    """Get list of available OCR templates.
    
    Returns:
        List of OCR template configurations
    """
    templates = []
    
    # Get from OCR Template DocType if it exists
    if frappe.db.exists("DocType", "OCR Template"):
        template_docs = frappe.get_all(
            "OCR Template",
            filters={"is_active": 1},
            fields=["name", "template_name", "description", "doc_type"]
        )
        templates = template_docs
    
    # Add default templates
    default_templates = [
        {
            "name": "daily_cleaning",
            "template_name": "Daily Cleaning Checklist",
            "description": "Standard daily cleaning verification form",
            "doc_type": "SOP Run",
            "is_default": True
        },
        {
            "name": "opening_checklist",
            "template_name": "Opening Checklist",
            "description": "Pre-opening procedures and checks",
            "doc_type": "SOP Run",
            "is_default": True
        },
        {
            "name": "closing_checklist",
            "template_name": "Closing Checklist",
            "description": "End-of-day closing procedures",
            "doc_type": "SOP Run",
            "is_default": True
        },
        {
            "name": "equipment_inspection",
            "template_name": "Equipment Inspection",
            "description": "Equipment safety and functionality check",
            "doc_type": "SOP Run",
            "is_default": True
        }
    ]
    
    # Merge with existing templates
    existing_names = {t["name"] for t in templates}
    for default in default_templates:
        if default["name"] not in existing_names:
            templates.append(default)
    
    return templates


@frappe.whitelist()
def get_ocr_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific OCR template configuration.
    
    Args:
        template_id: Template identifier
        
    Returns:
        Template configuration dict or None
    """
    # Check if it's a default template
    default_templates = {
        "daily_cleaning": {
            "name": "daily_cleaning",
            "template_name": "Daily Cleaning Checklist",
            "fields": [
                {"name": "date", "type": "date", "patterns": ["Date:", "Date", "Date:"], "required": True},
                {"name": "employee_name", "type": "text", "patterns": ["Employee:", "Name:", "Staff:", "By:"], "required": True},
                {"name": "location", "type": "text", "patterns": ["Location:", "Branch:", "Site:", "Store:"]},
                {"name": "shift", "type": "text", "patterns": ["Shift:", "Time:"]},
                {"name": "completed_items", "type": "array", "patterns": ["[x]", "[✓]", "[✔]", "☑"]},
                {"name": "notes", "type": "text", "patterns": ["Notes:", "Comments:", "Remarks:"]}
            ]
        },
        "opening_checklist": {
            "name": "opening_checklist",
            "template_name": "Opening Checklist",
            "fields": [
                {"name": "date", "type": "date", "patterns": ["Date:"], "required": True},
                {"name": "opened_by", "type": "text", "patterns": ["Opened by:", "Name:", "Employee:"], "required": True},
                {"name": "open_time", "type": "text", "patterns": ["Time:", "Opening Time:"]},
                {"name": "temperature_checks", "type": "array", "patterns": ["Temp:", "Temperature:"]},
                {"name": "equipment_status", "type": "array", "patterns": ["[x]", "[✓]", "[✔]"]},
            ]
        },
        "closing_checklist": {
            "name": "closing_checklist",
            "template_name": "Closing Checklist",
            "fields": [
                {"name": "date", "type": "date", "patterns": ["Date:"], "required": True},
                {"name": "closed_by", "type": "text", "patterns": ["Closed by:", "Name:"], "required": True},
                {"name": "close_time", "type": "text", "patterns": ["Time:", "Closing Time:"]},
                {"name": "sales_total", "type": "text", "patterns": ["Sales:", "Total:", "Amount:"]},
                {"name": "completed_tasks", "type": "array", "patterns": ["[x]", "[✓]", "[✔]"]},
            ]
        },
        "equipment_inspection": {
            "name": "equipment_inspection",
            "template_name": "Equipment Inspection",
            "fields": [
                {"name": "inspection_date", "type": "date", "patterns": ["Date:", "Inspection Date:"], "required": True},
                {"name": "inspector", "type": "text", "patterns": ["Inspector:", "Name:", "By:"], "required": True},
                {"name": "equipment_id", "type": "text", "patterns": ["Equipment:", "ID:", "Serial:"]},
                {"name": "condition", "type": "text", "patterns": ["Condition:", "Status:"]},
                {"name": "checks_passed", "type": "array", "patterns": ["Pass", "[✓]", "[✔]", "OK"]},
            ]
        }
    }
    
    if template_id in default_templates:
        return default_templates[template_id]
    
    # Try to get from DocType
    if frappe.db.exists("DocType", "OCR Template") and frappe.db.exists("OCR Template", template_id):
        doc = frappe.get_doc("OCR Template", template_id)
        return {
            "name": doc.name,
            "template_name": doc.template_name,
            "fields": doc.fields or []
        }
    
    return None


@frappe.whitelist()
def create_sop_run_from_ocr(extracted_data: Dict, template_id: str) -> Dict[str, Any]:
    """Create an SOP Run from OCR extracted data.
    
    Args:
        extracted_data: Data extracted from document
        template_id: SOP template to use
        
    Returns:
        Dict with created run information
    """
    try:
        if not frappe.db.exists("SOP Template", template_id):
            return {
                "success": False,
                "error": "Template not found"
            }
        
        # Get current user's employee
        employee = _get_employee_for_user()
        
        # Create SOP Run
        fields = extracted_data.get("extracted_fields", [])
        field_dict = {f["name"]: f["value"] for f in fields}
        
        # Determine run date
        run_date = field_dict.get("date") or field_dict.get("inspection_date") or datetime.now().strftime("%Y-%m-%d")
        
        run_doc = frappe.get_doc({
            "doctype": "SOP Run",
            "template": template_id,
            "run_date": run_date,
            "employee": employee,
            "status": "In Progress",
            "source": "OCR Import",
            "ocr_metadata": frappe.as_json(extracted_data)
        })
        
        run_doc.insert()
        
        # Pre-fill checklist outcomes based on extracted items
        checklist_items = extracted_data.get("checklist_items", [])
        template = frappe.get_doc("SOP Template", template_id)
        
        for item in checklist_items:
            # Find matching template item
            for template_item in template.checklist_items:
                similarity = _calculate_text_similarity(item["text"], template_item.description)
                if similarity > 0.7:
                    # Add outcome
                    run_doc.append("outcomes", {
                        "checklist_item": template_item.name,
                        "outcome": "Pass" if item.get("checked") else "Pending",
                        "notes": f"Auto-filled from OCR: {item['text']}"
                    })
                    break
        
        run_doc.save()
        
        return {
            "success": True,
            "run_id": run_doc.name,
            "message": "SOP Run created successfully from document"
        }
        
    except Exception as e:
        frappe.log_error("OCR SOP Run Creation Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


# =============================================================================
# Helper Functions
# =============================================================================

def _decode_image(image_data: str) -> Optional[bytes]:
    """Decode base64 image data to bytes."""
    try:
        # Remove data URI prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        return base64.b64decode(image_data)
    except Exception:
        return None


def _simulate_ocr(image_bytes: bytes) -> str:
    """Simulate OCR processing for demo purposes.
    
    In production, this would use:
    - pytesseract for local OCR
    - Google Cloud Vision API
    - AWS Textract
    - Azure Computer Vision
    """
    # This is a simulation - returns sample text
    sample_text = """
Daily Cleaning Checklist
Date: 2026-03-26
Employee: John Smith
Location: Main Branch

[x] Floors swept and mopped
[x] Tables cleaned and sanitized
[ ] Windows cleaned
[x] Trash removed
[x] Restrooms cleaned

Notes: All standard tasks completed
    """
    return sample_text


def _extract_with_template(text: str, template: Dict) -> List[Dict[str, Any]]:
    """Extract fields using a template configuration."""
    fields = []
    
    for field in template.get("fields", []):
        for pattern in field.get("patterns", []):
            # Build regex for field extraction
            regex = rf'{re.escape(pattern)}\s*[:=]?\s*([^\n]+)'
            match = re.search(regex, text, re.IGNORECASE)
            
            if match:
                value = match.group(1).strip()
                
                # Parse based on field type
                field_type = field.get("type", "text")
                parsed_value = value
                
                if field_type == "date":
                    # Try to parse various date formats
                    parsed_value = _parse_date(value)
                elif field_type == "boolean":
                    parsed_value = value.lower() in ['true', 'yes', 'y', '1', 'x', '✓', '✔']
                elif field_type == "array":
                    # For array types, we'll handle specially
                    continue
                
                fields.append({
                    "name": field["name"],
                    "value": parsed_value,
                    "type": field_type,
                    "confidence": 85,
                    "required": field.get("required", False)
                })
                break
    
    return fields


def _extract_generic_fields(text: str) -> List[Dict[str, Any]]:
    """Extract common fields without a template."""
    fields = []
    
    # Common field patterns
    patterns = [
        ("date", r'(?:date|Date|DATE)[\s:]*([\d\/\-\.]+)', "date"),
        ("name", r'(?:name|Name|employee|Employee)[\s:]*([^\n]+)', "text"),
        ("location", r'(?:location|branch|site|store)[\s:]*([^\n]+)', "text"),
        ("time", r'(?:time|Time)[\s:]*([\d\:]+)', "text"),
    ]
    
    for name, pattern, field_type in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            if field_type == "date":
                value = _parse_date(value) or value
            
            fields.append({
                "name": name,
                "value": value,
                "type": field_type,
                "confidence": 80
            })
    
    return fields


def _parse_date(date_str: str) -> Optional[str]:
    """Parse various date formats to ISO format."""
    formats = [
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%m-%d-%Y",
        "%d-%m-%Y",
        "%m/%d/%y",
        "%d/%m/%y",
    ]
    
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str.strip(), fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return None


def _calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate similarity between two texts (0-1)."""
    # Simple Jaccard similarity
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union)


def _get_employee_for_user() -> Optional[str]:
    """Get employee ID for current user."""
    user = frappe.session.user
    if user == "Administrator":
        return None
    
    employee = frappe.db.get_value("Pulse Employee", {"user": user}, "name")
    return employee
