# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _


@frappe.whitelist()
def global_search(query: str, limit: int = 20) -> dict:
    """Search across all major entities in Pulse."""
    if not query or len(query) < 2:
        return {'results': [], 'total': 0}
    
    query = query.lower()
    results = []
    
    # Search employees
    employees = frappe.get_all(
        'Pulse Employee',
        filters=[
            ['employee_name', 'like', f'%{query}%'],
            ['is_active', '=', 1]
        ],
        fields=['name', 'employee_name', 'pulse_role', 'branch', 'department'],
        limit=limit
    )
    for emp in employees:
        results.append({
            'type': 'employee',
            'id': emp['name'],
            'title': emp['employee_name'],
            'subtitle': f"{emp['pulse_role']} • {emp['branch']}",
            'url': f'/admin/employees/{emp["name"]}'
        })
    
    # Search templates
    templates = frappe.get_all(
        'SOP Template',
        filters=[
            ['title', 'like', f'%{query}%'],
            ['is_active', '=', 1]
        ],
        fields=['name', 'title', 'department', 'frequency_type'],
        limit=limit
    )
    for tmpl in templates:
        results.append({
            'type': 'template',
            'id': tmpl['name'],
            'title': tmpl['title'],
            'subtitle': f"{tmpl['department']} • {tmpl['frequency_type']}",
            'url': f'/templates/{tmpl["name"]}/edit'
        })
    
    # Search runs
    runs = frappe.get_all(
        'SOP Run',
        filters=[
            ['name', 'like', f'%{query}%']
        ],
        fields=['name', 'template', 'employee', 'period_date', 'status'],
        limit=limit
    )
    for run in runs:
        template_title = frappe.db.get_value('SOP Template', run['template'], 'title')
        employee_name = frappe.db.get_value('Pulse Employee', run['employee'], 'employee_name')
        results.append({
            'type': 'run',
            'id': run['name'],
            'title': f'Run: {template_title or run["template"]}',
            'subtitle': f"{employee_name or run['employee']} • {run['period_date']} • {run['status']}",
            'url': f'/tasks?id={run["name"]}'
        })
    
    # Search corrective actions
    cas = frappe.get_all(
        'Corrective Action',
        filters=[
            ['description', 'like', f'%{query}%']
        ],
        fields=['name', 'description', 'status', 'priority'],
        limit=limit
    )
    for ca in cas:
        results.append({
            'type': 'corrective_action',
            'id': ca['name'],
            'title': f'CA: {ca["description"][:50]}...',
            'subtitle': f"{ca['status']} • {ca['priority']}",
            'url': f'/corrective-actions/{ca["name"]}'
        })
    
    return {
        'results': results[:limit],
        'total': len(results),
        'query': query
    }


@frappe.whitelist()
def get_recent_searches(limit: int = 10) -> list:
    """Get recent searches for current user."""
    # In a real implementation, this would be stored in DB
    # For now, return empty list
    return []


@frappe.whitelist()
def get_quick_actions() -> list:
    """Get quick actions for search modal."""
    return [
        {'name': 'New Employee', 'url': '/admin/employees/new', 'icon': 'user-plus'},
        {'name': 'New Template', 'url': '/templates/new', 'icon': 'file-plus'},
        {'name': 'New Assignment', 'url': '/admin/assignments/new', 'icon': 'clipboard-plus'},
        {'name': 'Corrective Actions', 'url': '/corrective-actions', 'icon': 'flag'},
        {'name': 'My Tasks', 'url': '/tasks', 'icon': 'check-square'},
        {'name': 'Insights', 'url': '/insights', 'icon': 'bar-chart'},
    ]
