# Copyright (c) 2026, Tridz and contributors
# License: MIT

import frappe
from frappe import _


@frappe.whitelist()
def get_system_settings() -> dict:
    """Get system-wide settings for Pulse."""
    # Get settings from Pulse Settings DocType if it exists, otherwise use defaults
    try:
        settings = frappe.get_doc('Pulse Settings')
        return {
            'success': True,
            'settings': {
                'default_grace_period': settings.default_grace_period or 30,
                'default_open_run_policy': settings.default_open_run_policy or 'Auto-create',
                'pass_weight': settings.pass_weight or 100,
                'fail_weight': settings.fail_weight or 0,
                'late_penalty': settings.late_penalty or 10,
                'missed_penalty': settings.missed_penalty or 0,
                'default_reminder_time': settings.default_reminder_time or '09:00',
                'business_hours_start': settings.business_hours_start or '09:00',
                'business_hours_end': settings.business_hours_end or '18:00',
                'enable_email_notifications': settings.enable_email_notifications or 1,
                'enable_in_app_notifications': settings.enable_in_app_notifications or 1,
                'auto_archive_resolved_ca': settings.auto_archive_resolved_ca or 30,
            }
        }
    except:
        # Return defaults if settings don't exist
        return {
            'success': True,
            'settings': {
                'default_grace_period': 30,
                'default_open_run_policy': 'Auto-create',
                'pass_weight': 100,
                'fail_weight': 0,
                'late_penalty': 10,
                'missed_penalty': 0,
                'default_reminder_time': '09:00',
                'business_hours_start': '09:00',
                'business_hours_end': '18:00',
                'enable_email_notifications': 1,
                'enable_in_app_notifications': 1,
                'auto_archive_resolved_ca': 30,
            }
        }


@frappe.whitelist()
def update_system_settings(values: dict) -> dict:
    """Update system-wide settings."""
    if not frappe.has_permission('Pulse Settings', 'write'):
        frappe.throw(_('Not permitted to update settings'), frappe.PermissionError)
    
    try:
        # Try to get existing settings or create new
        try:
            settings = frappe.get_doc('Pulse Settings')
        except:
            settings = frappe.new_doc('Pulse Settings')
        
        # Update fields
        for key, value in values.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        
        settings.save()
        
        return {
            'success': True,
            'message': _('Settings updated successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to update settings: {0}').format(str(e)))


@frappe.whitelist()
def get_roles() -> list:
    """List all Pulse roles with permissions."""
    roles = frappe.get_all(
        'Pulse Role',
        fields=['name', 'role_name', 'alias', 'system_role', 'description', 'level'],
        order_by='name'
    )
    
    # Get permissions for each role (Pulse Role Permission DocType may not exist)
    for role in roles:
        try:
            permissions = frappe.get_all(
                'Pulse Role Permission',
                filters={'parent': role['name']},
                fields=['permission', 'allowed']
            )
            role['permissions'] = {p['permission']: p['allowed'] for p in permissions}
        except Exception:
            role['permissions'] = {}
    
    return roles


@frappe.whitelist()
def get_role_detail(role_name: str) -> dict:
    """Get detailed information about a role."""
    if not frappe.db.exists('Pulse Role', role_name):
        frappe.throw(_('Role not found'))
    
    role = frappe.get_doc('Pulse Role', role_name)
    
    # Get permissions
    permissions = {}
    for perm in role.permissions:
        permissions[perm.permission] = perm.allowed
    
    # Get employee count for this role
    employee_count = frappe.db.count('Pulse Employee', {'pulse_role': role_name})
    
    return {
        'name': role.name,
        'role_name': role.role_name,
        'alias': role.alias,
        'system_role': role.system_role,
        'description': role.description,
        'is_active': role.is_active,
        'permissions': permissions,
        'employee_count': employee_count
    }


@frappe.whitelist()
def create_role(values: dict) -> dict:
    """Create a new Pulse role."""
    if not frappe.has_permission('Pulse Role', 'create'):
        frappe.throw(_('Not permitted to create roles'), frappe.PermissionError)
    
    try:
        doc = frappe.get_doc({
            'doctype': 'Pulse Role',
            'role_name': values['role_name'],
            'alias': values.get('alias'),
            'system_role': values.get('system_role', 'Pulse User'),
            'description': values.get('description'),
            'is_active': values.get('is_active', 1)
        })
        
        # Add permissions if provided
        if 'permissions' in values:
            for perm, allowed in values['permissions'].items():
                doc.append('permissions', {
                    'permission': perm,
                    'allowed': allowed
                })
        
        doc.insert()
        
        return {
            'success': True,
            'name': doc.name,
            'message': _('Role created successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to create role: {0}').format(str(e)))


@frappe.whitelist()
def update_role(role_name: str, values: dict) -> dict:
    """Update a Pulse role."""
    if not frappe.has_permission('Pulse Role', 'write'):
        frappe.throw(_('Not permitted to update roles'), frappe.PermissionError)
    
    if not frappe.db.exists('Pulse Role', role_name):
        frappe.throw(_('Role not found'))
    
    try:
        doc = frappe.get_doc('Pulse Role', role_name)
        
        # Update basic fields
        if 'alias' in values:
            doc.alias = values['alias']
        if 'description' in values:
            doc.description = values['description']
        if 'is_active' in values:
            doc.is_active = values['is_active']
        
        # Update permissions
        if 'permissions' in values:
            # Clear existing permissions
            doc.permissions = []
            for perm, allowed in values['permissions'].items():
                doc.append('permissions', {
                    'permission': perm,
                    'allowed': allowed
                })
        
        doc.save()
        
        return {
            'success': True,
            'name': doc.name,
            'message': _('Role updated successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to update role: {0}').format(str(e)))


@frappe.whitelist()
def delete_role(role_name: str) -> dict:
    """Delete a Pulse role."""
    if not frappe.has_permission('Pulse Role', 'delete'):
        frappe.throw(_('Not permitted to delete roles'), frappe.PermissionError)
    
    if not frappe.db.exists('Pulse Role', role_name):
        frappe.throw(_('Role not found'))
    
    # Check if role is in use
    employee_count = frappe.db.count('Pulse Employee', {'pulse_role': role_name})
    if employee_count > 0:
        frappe.throw(_('Cannot delete role: {0} employees are using this role').format(employee_count))
    
    try:
        frappe.delete_doc('Pulse Role', role_name)
        return {
            'success': True,
            'message': _('Role deleted successfully')
        }
    except Exception as e:
        frappe.throw(_('Failed to delete role: {0}').format(str(e)))


@frappe.whitelist()
def get_permission_matrix() -> dict:
    """Get full permission matrix for all roles."""
    # Define all available permissions
    all_permissions = [
        'view_tasks',
        'create_tasks',
        'edit_tasks',
        'delete_tasks',
        'view_team',
        'view_operations',
        'view_insights',
        'view_templates',
        'create_templates',
        'edit_templates',
        'delete_templates',
        'view_assignments',
        'create_assignments',
        'edit_assignments',
        'delete_assignments',
        'view_corrective_actions',
        'create_corrective_actions',
        'edit_corrective_actions',
        'view_branches',
        'manage_branches',
        'view_employees',
        'manage_employees',
        'view_departments',
        'manage_departments',
        'view_settings',
        'manage_settings',
    ]
    
    roles = get_roles()
    
    return {
        'permissions': all_permissions,
        'roles': roles
    }


@frappe.whitelist()
def get_activity_log(limit: int = 50) -> list:
    """Get system activity log for audit."""
    activities = frappe.get_all(
        'Activity Log',
        fields=['name', 'user', 'operation', 'status', 'reference_doctype', 'reference_name', 'creation'],
        filters={'reference_doctype': ['in', ['SOP Run', 'SOP Template', 'Corrective Action', 'Pulse Employee']]},
        order_by='creation desc',
        limit=limit
    )
    
    # Enrich with user details
    for activity in activities:
        user = frappe.db.get_value('User', activity['user'], 'full_name')
        activity['user_name'] = user or activity['user']
    
    return activities
