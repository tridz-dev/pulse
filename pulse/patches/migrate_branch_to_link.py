# Copyright (c) 2025, Pulse and contributors
"""
Migration: Convert Pulse Employee branch text field to Link field

This script:
1. Finds all unique branch values from existing employees
2. Creates Pulse Branch records for each unique value
3. Updates employee records to use the new branch links
"""

import frappe


def execute():
    """Execute the migration."""
    frappe.log_error("Starting branch field migration", "Branch Migration")
    
    # Get all employees with branch values
    employees = frappe.db.sql("""
        SELECT name, branch, employee_name
        FROM `tabPulse Employee`
        WHERE branch IS NOT NULL AND branch != ''
    """, as_dict=True)
    
    if not employees:
        frappe.log_error("No employees with branch values found", "Branch Migration")
        return
    
    frappe.log_error(f"Found {len(employees)} employees with branch values", "Branch Migration")
    
    # Get unique branch values
    unique_branches = set()
    for emp in employees:
        branch_value = emp.branch.strip() if emp.branch else ""
        if branch_value:
            unique_branches.add(branch_value)
    
    frappe.log_error(f"Found {len(unique_branches)} unique branches: {unique_branches}", "Branch Migration")
    
    # Create branch records
    branch_mapping = {}  # text value -> branch name
    
    for branch_text in unique_branches:
        # Check if a branch with this name already exists
        existing = frappe.db.exists("Pulse Branch", {"branch_name": branch_text})
        
        if existing:
            branch_mapping[branch_text] = existing
            frappe.log_error(f"Branch already exists: {branch_text} -> {existing}", "Branch Migration")
        else:
            # Create new branch
            try:
                branch_doc = frappe.get_doc({
                    "doctype": "Pulse Branch",
                    "branch_name": branch_text,
                    "is_active": 1
                })
                branch_doc.insert(ignore_permissions=True)
                branch_mapping[branch_text] = branch_doc.name
                frappe.log_error(f"Created branch: {branch_text} -> {branch_doc.name}", "Branch Migration")
            except Exception as e:
                frappe.log_error(f"Failed to create branch '{branch_text}': {str(e)}", "Branch Migration")
    
    # Update employee records
    updated_count = 0
    failed_count = 0
    
    for emp in employees:
        branch_text = emp.branch.strip() if emp.branch else ""
        if not branch_text:
            continue
        
        branch_name = branch_mapping.get(branch_text)
        if not branch_name:
            frappe.log_error(f"No branch mapping found for '{branch_text}' (Employee: {emp.name})", "Branch Migration")
            failed_count += 1
            continue
        
        try:
            frappe.db.set_value("Pulse Employee", emp.name, "branch", branch_name)
            updated_count += 1
            frappe.log_error(f"Updated employee {emp.name}: branch '{branch_text}' -> '{branch_name}'", "Branch Migration")
        except Exception as e:
            frappe.log_error(f"Failed to update employee {emp.name}: {str(e)}", "Branch Migration")
            failed_count += 1
    
    frappe.db.commit()
    
    frappe.log_error(
        f"Migration complete. Updated: {updated_count}, Failed: {failed_count}", 
        "Branch Migration"
    )
    
    return {
        "branches_created": len(branch_mapping),
        "employees_updated": updated_count,
        "failed": failed_count
    }
