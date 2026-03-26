# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _
from frappe.utils import now, get_datetime, add_days


@frappe.whitelist()
def get_follow_up_rules(source_template: str = None, is_active: bool = None, limit: int = 100) -> list:
    """List all follow-up rules with optional filters."""
    filters = {}
    
    if source_template:
        filters['source_template'] = source_template
    if is_active is not None:
        filters['is_active'] = is_active
    
    rules = frappe.get_all(
        'SOP Follow-up Rule',
        filters=filters,
        fields=['name', 'source_template', 'trigger_on', 'source_item_key', 'action', 
                'target_template', 'target_assignee', 'is_active', 'creation', 'modified'],
        order_by='modified desc',
        limit_page_length=limit
    )
    
    # Enrich with template names
    for rule in rules:
        # Get source template title
        source_title = frappe.db.get_value('SOP Template', rule['source_template'], 'title')
        rule['source_template_title'] = source_title or rule['source_template']
        
        # Get target template title
        target_title = frappe.db.get_value('SOP Template', rule['target_template'], 'title')
        rule['target_template_title'] = target_title or rule['target_template']
    
    return rules


@frappe.whitelist()
def get_rule_detail(rule_name: str) -> dict:
    """Get detailed information about a specific follow-up rule."""
    if not frappe.db.exists('SOP Follow-up Rule', rule_name):
        frappe.throw(_('Follow-up Rule not found'))
    
    doc = frappe.get_doc('SOP Follow-up Rule', rule_name)
    
    # Get source template details
    source_template = frappe.db.get_value(
        'SOP Template',
        doc.source_template,
        ['title', 'department'],
        as_dict=True
    )
    
    # Get target template details
    target_template = frappe.db.get_value(
        'SOP Template',
        doc.target_template,
        ['title', 'department'],
        as_dict=True
    )
    
    return {
        'name': doc.name,
        'source_template': doc.source_template,
        'source_template_title': source_template['title'] if source_template else doc.source_template,
        'source_department': source_template['department'] if source_template else None,
        'trigger_on': doc.trigger_on,
        'source_item_key': doc.source_item_key,
        'action': doc.action,
        'target_template': doc.target_template,
        'target_template_title': target_template['title'] if target_template else doc.target_template,
        'target_department': target_template['department'] if target_template else None,
        'target_assignee': doc.target_assignee,
        'is_active': doc.is_active,
        'creation': str(doc.creation),
        'modified': str(doc.modified),
        'owner': doc.owner
    }


@frappe.whitelist()
def create_rule(values: dict) -> dict:
    """Create a new follow-up rule."""
    required_fields = ['source_template', 'trigger_on', 'source_item_key', 
                       'action', 'target_template', 'target_assignee']
    
    for field in required_fields:
        if field not in values or not values[field]:
            frappe.throw(_('{0} is required').format(field.replace('_', ' ').title()))
    
    # Validate templates exist
    if not frappe.db.exists('SOP Template', values['source_template']):
        frappe.throw(_('Source Template not found'))
    if not frappe.db.exists('SOP Template', values['target_template']):
        frappe.throw(_('Target Template not found'))
    
    # Validate source_item_key exists in source template
    template_doc = frappe.get_doc('SOP Template', values['source_template'])
    item_keys = [item.key for item in template_doc.items]
    if values['source_item_key'] not in item_keys:
        frappe.throw(_('Item key "{0}" not found in source template').format(values['source_item_key']))
    
    try:
        doc = frappe.get_doc({
            'doctype': 'SOP Follow-up Rule',
            'source_template': values['source_template'],
            'trigger_on': values['trigger_on'],
            'source_item_key': values['source_item_key'],
            'action': values['action'],
            'target_template': values['target_template'],
            'target_assignee': values['target_assignee'],
            'is_active': values.get('is_active', 1)
        })
        doc.insert()
        
        # Log creation
        frappe.get_doc({
            'doctype': 'Pulse Audit Log',
            'action': 'Create',
            'entity_type': 'SOP Follow-up Rule',
            'entity_name': doc.name,
            'details': f"Created follow-up rule: {doc.name}"
        }).insert(ignore_permissions=True)
        
        return {
            'success': True,
            'name': doc.name,
            'message': _('Follow-up Rule created successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to create Follow-up Rule: {0}').format(str(e)))


@frappe.whitelist()
def update_rule(rule_name: str, values: dict) -> dict:
    """Update an existing follow-up rule."""
    if not frappe.db.exists('SOP Follow-up Rule', rule_name):
        frappe.throw(_('Follow-up Rule not found'))
    
    doc = frappe.get_doc('SOP Follow-up Rule', rule_name)
    
    # Track what changed for audit log
    changes = []
    
    if 'source_template' in values and values['source_template'] != doc.source_template:
        if not frappe.db.exists('SOP Template', values['source_template']):
            frappe.throw(_('Source Template not found'))
        doc.source_template = values['source_template']
        changes.append('source_template')
    
    if 'trigger_on' in values:
        doc.trigger_on = values['trigger_on']
        changes.append('trigger_on')
    
    if 'source_item_key' in values:
        # Validate item key exists in source template
        template_doc = frappe.get_doc('SOP Template', doc.source_template)
        item_keys = [item.key for item in template_doc.items]
        if values['source_item_key'] not in item_keys:
            frappe.throw(_('Item key "{0}" not found in source template').format(values['source_item_key']))
        doc.source_item_key = values['source_item_key']
        changes.append('source_item_key')
    
    if 'action' in values:
        doc.action = values['action']
        changes.append('action')
    
    if 'target_template' in values and values['target_template'] != doc.target_template:
        if not frappe.db.exists('SOP Template', values['target_template']):
            frappe.throw(_('Target Template not found'))
        doc.target_template = values['target_template']
        changes.append('target_template')
    
    if 'target_assignee' in values:
        doc.target_assignee = values['target_assignee']
        changes.append('target_assignee')
    
    if 'is_active' in values:
        doc.is_active = values['is_active']
        changes.append('is_active')
    
    try:
        doc.save()
        
        # Log update
        if changes:
            frappe.get_doc({
                'doctype': 'Pulse Audit Log',
                'action': 'Update',
                'entity_type': 'SOP Follow-up Rule',
                'entity_name': doc.name,
                'details': f"Updated fields: {', '.join(changes)}"
            }).insert(ignore_permissions=True)
        
        return {
            'success': True,
            'name': doc.name,
            'message': _('Follow-up Rule updated successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to update Follow-up Rule: {0}').format(str(e)))


@frappe.whitelist()
def delete_rule(rule_name: str) -> dict:
    """Delete a follow-up rule."""
    if not frappe.db.exists('SOP Follow-up Rule', rule_name):
        frappe.throw(_('Follow-up Rule not found'))
    
    try:
        frappe.delete_doc('SOP Follow-up Rule', rule_name)
        
        # Log deletion
        frappe.get_doc({
            'doctype': 'Pulse Audit Log',
            'action': 'Delete',
            'entity_type': 'SOP Follow-up Rule',
            'entity_name': rule_name,
            'details': f"Deleted follow-up rule: {rule_name}"
        }).insert(ignore_permissions=True)
        
        return {
            'success': True,
            'message': _('Follow-up Rule deleted successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to delete Follow-up Rule: {0}').format(str(e)))


@frappe.whitelist()
def toggle_rule_status(rule_name: str, is_active: bool) -> dict:
    """Quick toggle for enabling/disabling a rule."""
    if not frappe.db.exists('SOP Follow-up Rule', rule_name):
        frappe.throw(_('Follow-up Rule not found'))
    
    doc = frappe.get_doc('SOP Follow-up Rule', rule_name)
    doc.is_active = 1 if is_active else 0
    
    try:
        doc.save()
        
        status_text = 'enabled' if is_active else 'disabled'
        frappe.get_doc({
            'doctype': 'Pulse Audit Log',
            'action': 'Update',
            'entity_type': 'SOP Follow-up Rule',
            'entity_name': doc.name,
            'details': f"Rule {status_text}"
        }).insert(ignore_permissions=True)
        
        return {
            'success': True,
            'name': doc.name,
            'is_active': bool(doc.is_active),
            'message': _('Follow-up Rule {0}').format(status_text)
        }
    except Exception as e:
        frappe.throw(_('Failed to toggle rule status: {0}').format(str(e)))


@frappe.whitelist()
def get_rule_execution_logs(rule_name: str = None, limit: int = 50) -> list:
    """Get execution history for rules.
    
    For now, this returns related SOP Runs created by rules.
    In a full implementation, this would query a dedicated execution log table.
    """
    # Get recent runs that might have been triggered by rules
    # We look for runs with source_run reference (follow-up runs)
    filters = {'source_run': ['is', 'set']}
    
    runs = frappe.get_all(
        'SOP Run',
        filters=filters,
        fields=['name', 'template', 'employee', 'period_date', 'status', 
                'source_run', 'creation', 'modified'],
        order_by='creation desc',
        limit_page_length=limit
    )
    
    # Enrich with details
    for run in runs:
        # Get template title
        template_title = frappe.db.get_value('SOP Template', run['template'], 'title')
        run['template_title'] = template_title or run['template']
        
        # Get employee name
        employee_name = frappe.db.get_value('Pulse Employee', run['employee'], 'employee_name')
        run['employee_name'] = employee_name or run['employee']
        
        # Get source run details
        if run['source_run']:
            source_template = frappe.db.get_value('SOP Run', run['source_run'], 'template')
            if source_template:
                source_title = frappe.db.get_value('SOP Template', source_template, 'title')
                run['source_template_title'] = source_title or source_template
    
    return runs


@frappe.whitelist()
def get_trigger_options() -> list:
    """Get available trigger conditions for rules."""
    # These match the options defined in the DocType
    return [
        {
            'value': 'ItemOutcomeFail',
            'label': 'Item Outcome: Fail',
            'description': 'Trigger when a specific checklist item fails'
        },
        {
            'value': 'AnyOutcomeFail',
            'label': 'Any Item Failed',
            'description': 'Trigger when any item in the SOP fails'
        },
        {
            'value': 'ScoreBelow',
            'label': 'Score Below Threshold',
            'description': 'Trigger when overall score falls below a threshold'
        },
        {
            'value': 'CompletionOverdue',
            'label': 'Completion Overdue',
            'description': 'Trigger when SOP completion is overdue'
        }
    ]


@frappe.whitelist()
def get_action_options() -> list:
    """Get available actions for rules."""
    # These match the options defined in the DocType
    return [
        {
            'value': 'CreateRun',
            'label': 'Create Follow-up Run',
            'description': 'Create a new SOP Run based on target template'
        },
        {
            'value': 'CreateCA',
            'label': 'Create Corrective Action',
            'description': 'Create a corrective action for follow-up'
        },
        {
            'value': 'NotifyManager',
            'label': 'Notify Manager',
            'description': 'Send notification to employee\'s manager'
        },
        {
            'value': 'NotifyAssignee',
            'label': 'Notify Assignee',
            'description': 'Send notification to the assigned employee'
        }
    ]


@frappe.whitelist()
def get_assignee_options() -> list:
    """Get target assignee options."""
    return [
        {
            'value': 'SameEmployee',
            'label': 'Same Employee',
            'description': 'Assign to the employee who completed the source SOP'
        },
        {
            'value': 'EmployeesManager',
            'label': 'Employee\'s Manager',
            'description': 'Assign to the manager of the employee who completed the source SOP'
        }
    ]


@frappe.whitelist()
def get_template_checklist_items(template_name: str) -> list:
    """Get checklist items for a template (for item key selection)."""
    if not frappe.db.exists('SOP Template', template_name):
        frappe.throw(_('Template not found'))
    
    template = frappe.get_doc('SOP Template', template_name)
    items = []
    
    for item in template.items:
        items.append({
            'key': item.key,
            'description': item.description,
            'type': item.type,
            'is_required': item.is_required
        })
    
    return items


@frappe.whitelist()
def get_rule_stats() -> dict:
    """Get statistics for rules dashboard."""
    # Count active vs inactive
    active_count = frappe.db.count('SOP Follow-up Rule', {'is_active': 1})
    inactive_count = frappe.db.count('SOP Follow-up Rule', {'is_active': 0})
    total_count = active_count + inactive_count
    
    # Count by trigger type
    trigger_stats = frappe.db.sql("""
        SELECT trigger_on, COUNT(*) as count
        FROM `tabSOP Follow-up Rule`
        GROUP BY trigger_on
    """, as_dict=True)
    
    # Count by action type
    action_stats = frappe.db.sql("""
        SELECT action, COUNT(*) as count
        FROM `tabSOP Follow-up Rule`
        GROUP BY action
    """, as_dict=True)
    
    return {
        'total': total_count,
        'active': active_count,
        'inactive': inactive_count,
        'by_trigger': {row['trigger_on']: row['count'] for row in trigger_stats},
        'by_action': {row['action']: row['count'] for row in action_stats}
    }
