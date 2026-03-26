# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import now, getdate, add_days


@frappe.whitelist()
def get_corrective_actions(status: str = None, priority: str = None, assigned_to: str = None, 
                           limit: int = 100, start: int = 0) -> list:
    """List corrective actions with filters and employee details."""
    filters = {}
    
    if status:
        filters['status'] = status
    if priority:
        filters['priority'] = priority
    if assigned_to:
        filters['assigned_to'] = assigned_to
    
    cas = frappe.get_all(
        'Corrective Action',
        filters=filters,
        fields=['name', 'run', 'run_item_ref', 'description', 'status', 'assigned_to', 
                'raised_by', 'priority', 'resolution', 'resolved_at', 'creation', 'modified'],
        order_by='modified desc',
        limit_start=start,
        limit_page_length=limit
    )
    
    # Enrich with employee and run details
    for ca in cas:
        # Get assigned employee details
        if ca['assigned_to']:
            assigned = frappe.db.get_value(
                'Pulse Employee',
                ca['assigned_to'],
                ['employee_name', 'pulse_role'],
                as_dict=True
            )
            if assigned:
                ca['assigned_to_name'] = assigned['employee_name']
                ca['assigned_to_role'] = assigned['pulse_role']
        
        # Get raised by employee details
        if ca['raised_by']:
            raised = frappe.db.get_value(
                'Pulse Employee',
                ca['raised_by'],
                ['employee_name'],
                as_dict=True
            )
            if raised:
                ca['raised_by_name'] = raised['employee_name']
        
        # Get run details
        if ca['run']:
            run = frappe.db.get_value(
                'SOP Run',
                ca['run'],
                ['template', 'employee', 'period_date'],
                as_dict=True
            )
            if run:
                ca['run_template'] = run['template']
                ca['run_employee'] = run['employee']
                ca['run_date'] = str(run['period_date'])
                
                # Get template title
                template_title = frappe.db.get_value('SOP Template', run['template'], 'title')
                ca['template_title'] = template_title
                
                # Get employee name
                emp_name = frappe.db.get_value('Pulse Employee', run['employee'], 'employee_name')
                ca['run_employee_name'] = emp_name
    
    return cas


@frappe.whitelist()
def get_corrective_action_detail(ca_name: str) -> dict:
    """Get detailed information about a specific corrective action."""
    if not frappe.db.exists('Corrective Action', ca_name):
        frappe.throw(_('Corrective Action not found'))
    
    doc = frappe.get_doc('Corrective Action', ca_name)
    
    # Get run details
    run_details = None
    if doc.run:
        run = frappe.db.get_value(
            'SOP Run',
            doc.run,
            ['name', 'template', 'employee', 'period_date', 'status'],
            as_dict=True
        )
        if run:
            template = frappe.db.get_value(
                'SOP Template',
                run['template'],
                ['title', 'department'],
                as_dict=True
            )
            employee = frappe.db.get_value(
                'Pulse Employee',
                run['employee'],
                ['employee_name', 'branch'],
                as_dict=True
            )
            run_details = {
                'name': run['name'],
                'template_title': template['title'] if template else run['template'],
                'department': template['department'] if template else None,
                'employee_name': employee['employee_name'] if employee else run['employee'],
                'branch': employee['branch'] if employee else None,
                'period_date': str(run['period_date']),
                'status': run['status']
            }
    
    # Get run item details if available
    run_item_details = None
    if doc.run_item_ref:
        run_item = frappe.db.get_value(
            'SOP Run Item',
            doc.run_item_ref,
            ['checklist_item', 'status', 'completed_at', 'remarks'],
            as_dict=True
        )
        if run_item:
            run_item_details = {
                'description': run_item['checklist_item'],
                'status': run_item['status'],
                'completed_at': str(run_item['completed_at']) if run_item['completed_at'] else None,
                'remarks': run_item['remarks']
            }
    
    # Get assigned employee
    assigned_to_details = None
    if doc.assigned_to:
        assigned = frappe.db.get_value(
            'Pulse Employee',
            doc.assigned_to,
            ['employee_name', 'pulse_role', 'branch'],
            as_dict=True
        )
        if assigned:
            assigned_to_details = assigned
    
    # Get raised by employee
    raised_by_details = None
    if doc.raised_by:
        raised = frappe.db.get_value(
            'Pulse Employee',
            doc.raised_by,
            ['employee_name', 'pulse_role'],
            as_dict=True
        )
        if raised:
            raised_by_details = raised
    
    return {
        'name': doc.name,
        'description': doc.description,
        'status': doc.status,
        'priority': doc.priority,
        'resolution': doc.resolution,
        'resolved_at': str(doc.resolved_at) if doc.resolved_at else None,
        'evidence': doc.evidence,
        'creation': str(doc.creation),
        'modified': str(doc.modified),
        'run_details': run_details,
        'run_item_details': run_item_details,
        'assigned_to_details': assigned_to_details,
        'raised_by_details': raised_by_details
    }


@frappe.whitelist()
def create_corrective_action(run: str, description: str, priority: str = 'Medium', 
                             assigned_to: str = None, run_item_ref: str = None) -> dict:
    """Create a new corrective action from a failed run item."""
    current_user = frappe.session.user
    
    # Validate run exists
    if not frappe.db.exists('SOP Run', run):
        frappe.throw(_('Run not found'))
    
    run_doc = frappe.get_doc('SOP Run', run)
    
    # If no assignee provided, assign to run's employee's manager
    if not assigned_to:
        run_employee = run_doc.employee
        assigned_to = frappe.db.get_value('Pulse Employee', run_employee, 'reports_to')
        if not assigned_to:
            # Fallback to the employee themselves
            assigned_to = run_employee
    
    # Get current employee (raiser)
    raised_by = None
    current_employee = frappe.db.get_value('Pulse Employee', {'user': current_user}, 'name')
    if current_employee:
        raised_by = current_employee
    
    try:
        doc = frappe.get_doc({
            'doctype': 'Corrective Action',
            'run': run,
            'run_item_ref': run_item_ref,
            'description': description,
            'status': 'Open',
            'priority': priority,
            'assigned_to': assigned_to,
            'raised_by': raised_by
        })
        doc.insert()
        
        return {
            'success': True,
            'name': doc.name,
            'message': _('Corrective Action created successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to create Corrective Action: {0}').format(str(e)))


@frappe.whitelist()
def update_corrective_action(ca_name: str, values: dict) -> dict:
    """Update a corrective action (status, resolution, etc.)."""
    if not frappe.db.exists('Corrective Action', ca_name):
        frappe.throw(_('Corrective Action not found'))
    
    doc = frappe.get_doc('Corrective Action', ca_name)
    
    # Track changes for audit
    if 'status' in values:
        old_status = doc.status
        new_status = values['status']
        doc.status = new_status
        
        # If marking as resolved, set resolved_at
        if new_status == 'Resolved' and old_status != 'Resolved':
            doc.resolved_at = now()
    
    if 'resolution' in values:
        doc.resolution = values['resolution']
    
    if 'priority' in values:
        doc.priority = values['priority']
    
    if 'assigned_to' in values:
        doc.assigned_to = values['assigned_to']
    
    if 'evidence' in values:
        doc.evidence = values['evidence']
    
    try:
        doc.save()
        return {
            'success': True,
            'name': doc.name,
            'message': _('Corrective Action updated successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to update Corrective Action: {0}').format(str(e)))


@frappe.whitelist()
def get_ca_summary() -> dict:
    """Get counts by status for dashboard."""
    result = frappe.db.sql("""
        SELECT 
            status,
            COUNT(*) as count
        FROM `tabCorrective Action`
        GROUP BY status
    """, as_dict=True)
    
    summary = {
        'total': 0,
        'open': 0,
        'in_progress': 0,
        'resolved': 0,
        'closed': 0,
        'by_priority': {}
    }
    
    for row in result:
        count = row['count']
        summary['total'] += count
        
        status_key = row['status'].lower().replace(' ', '_')
        if status_key in summary:
            summary[status_key] = count
    
    # Get by priority
    priority_result = frappe.db.sql("""
        SELECT 
            priority,
            COUNT(*) as count
        FROM `tabCorrective Action`
        WHERE status IN ('Open', 'In Progress')
        GROUP BY priority
    """, as_dict=True)
    
    for row in priority_result:
        summary['by_priority'][row['priority']] = row['count']
    
    return summary


@frappe.whitelist()
def get_ca_options() -> dict:
    """Get dropdown options for corrective action forms."""
    # Get employees for assignment
    employees = frappe.get_all(
        'Pulse Employee',
        filters={'is_active': 1},
        fields=['name', 'employee_name', 'pulse_role', 'branch'],
        order_by='employee_name'
    )
    
    # Get runs for linking
    runs = frappe.get_all(
        'SOP Run',
        filters={'status': ['in', ['Pending', 'In Progress', 'Overdue']]},
        fields=['name', 'template', 'employee', 'period_date'],
        order_by='creation desc',
        limit=100
    )
    
    # Enrich runs with names
    for run in runs:
        template_title = frappe.db.get_value('SOP Template', run['template'], 'title')
        employee_name = frappe.db.get_value('Pulse Employee', run['employee'], 'employee_name')
        run['template_title'] = template_title
        run['employee_name'] = employee_name
    
    return {
        'employees': employees,
        'runs': runs,
        'statuses': ['Open', 'In Progress', 'Resolved', 'Closed'],
        'priorities': ['Low', 'Medium', 'High', 'Critical']
    }


@frappe.whitelist()
def get_my_corrective_actions(limit: int = 50) -> list:
    """Get corrective actions assigned to current user."""
    current_user = frappe.session.user
    employee = frappe.db.get_value('Pulse Employee', {'user': current_user}, 'name')
    
    if not employee:
        return []
    
    return get_corrective_actions(assigned_to=employee, limit=limit)


@frappe.whitelist()
def close_corrective_action(ca_name: str, resolution: str = None) -> dict:
    """Close a corrective action with optional resolution."""
    if not frappe.db.exists('Corrective Action', ca_name):
        frappe.throw(_('Corrective Action not found'))
    
    doc = frappe.get_doc('Corrective Action', ca_name)
    doc.status = 'Closed'
    if resolution:
        doc.resolution = resolution
    doc.resolved_at = now()
    
    try:
        doc.save()
        return {
            'success': True,
            'name': doc.name,
            'message': _('Corrective Action closed')
        }
    except Exception as e:
        frappe.throw(_('Failed to close Corrective Action: {0}').format(str(e)))
