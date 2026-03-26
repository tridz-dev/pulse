"""
Pulse Offline Sync API
Handles batched offline actions, sync status, and conflict resolution
"""

import frappe
from frappe import _
from typing import List, Dict, Any, Optional
import json
from datetime import datetime


class SyncConflict(Exception):
    """Raised when a sync conflict is detected"""
    pass


@frappe.whitelist()
def process_sync_batch(actions: str) -> Dict[str, Any]:
    """
    Process a batch of offline actions from the client.
    
    Args:
        actions: JSON string containing list of QueuedAction objects
        
    Returns:
        Dict with results for each action and any conflicts
    """
    try:
        actions_list = json.loads(actions) if isinstance(actions, str) else actions
    except json.JSONDecodeError:
        frappe.throw(_("Invalid actions format"), title=_("Sync Error"))
        return {"success": False, "error": "Invalid JSON"}
    
    if not isinstance(actions_list, list):
        actions_list = [actions_list]
    
    results = []
    conflicts = []
    user = frappe.session.user
    
    for action in actions_list:
        try:
            result = _process_single_action(action, user)
            results.append(result)
            
            if result.get("conflict"):
                conflicts.append(result)
                
        except SyncConflict as e:
            conflicts.append({
                "action_id": action.get("id"),
                "success": False,
                "conflict": True,
                "error": str(e),
                "server_data": getattr(e, "server_data", None),
                "client_data": action
            })
        except Exception as e:
            frappe.log_error(f"Sync action failed: {str(e)}", "Pulse Sync")
            results.append({
                "action_id": action.get("id"),
                "success": False,
                "error": str(e)
            })
    
    # Update user's last sync time
    _update_last_sync(user)
    
    return {
        "success": len([r for r in results if r.get("success")]) == len(results),
        "processed": len(results),
        "successful": len([r for r in results if r.get("success")]),
        "failed": len([r for r in results if not r.get("success")]),
        "conflicts": conflicts,
        "results": results,
        "sync_timestamp": frappe.utils.now()
    }


def _process_single_action(action: Dict[str, Any], user: str) -> Dict[str, Any]:
    """Process a single offline action"""
    action_type = action.get("type")
    payload = action.get("payload", {})
    action_id = action.get("id")
    
    processors = {
        "CREATE_SOP_RUN": _process_create_sop_run,
        "UPDATE_SOP_RUN": _process_update_sop_run,
        "COMPLETE_STEP": _process_complete_step,
        "ADD_NOTE": _process_add_note,
        "UPLOAD_ATTACHMENT": _process_upload_attachment,
        "UPDATE_PROFILE": _process_update_profile,
        "CORRECTIVE_ACTION": _process_corrective_action,
    }
    
    processor = processors.get(action_type)
    if not processor:
        return {
            "action_id": action_id,
            "success": False,
            "error": f"Unknown action type: {action_type}"
        }
    
    result = processor(payload, user, action)
    result["action_id"] = action_id
    result["action_type"] = action_type
    
    return result


def _process_create_sop_run(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Create a new SOP Run from offline data"""
    # Check for existing run with same client-generated ID
    client_id = payload.get("client_generated_id")
    if client_id:
        existing = frappe.get_all(
            "SOP Run",
            filters={
                "client_generated_id": client_id,
                "owner": user
            },
            limit=1
        )
        if existing:
            return {
                "success": True,
                "duplicate": True,
                "name": existing[0].name,
                "message": "Run already exists (duplicate)"
            }
    
    # Create the SOP Run
    doc = frappe.get_doc({
        "doctype": "SOP Run",
        "sop_template": payload.get("sop_template"),
        "assigned_to": payload.get("assigned_to", user),
        "branch": payload.get("branch"),
        "started_at": payload.get("started_at"),
        "status": payload.get("status", "In Progress"),
        "client_generated_id": client_id,
        "offline_created": 1,
        "owner": user
    })
    
    # Add steps if provided
    for step in payload.get("steps", []):
        doc.append("steps", {
            "step_number": step.get("step_number"),
            "description": step.get("description"),
            "is_completed": step.get("is_completed", 0),
            "completed_at": step.get("completed_at"),
            "completed_by": step.get("completed_by"),
            "notes": step.get("notes")
        })
    
    doc.insert()
    
    return {
        "success": True,
        "name": doc.name,
        "message": "SOP Run created successfully"
    }


def _process_update_sop_run(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Update an existing SOP Run"""
    run_name = payload.get("name")
    if not run_name:
        return {"success": False, "error": "SOP Run name is required"}
    
    # Check for conflicts
    server_doc = frappe.get_doc("SOP Run", run_name)
    client_version = payload.get("version", 0)
    server_version = _get_doc_version(server_doc)
    
    if server_version > client_version:
        raise SyncConflict(
            "Document has been modified on server",
            server_data=server_doc.as_dict(),
            client_data=payload
        )
    
    # Update fields
    if "status" in payload:
        server_doc.status = payload["status"]
    if "completed_at" in payload:
        server_doc.completed_at = payload["completed_at"]
    if "notes" in payload:
        server_doc.notes = payload["notes"]
    
    server_doc.save()
    
    return {
        "success": True,
        "name": server_doc.name,
        "version": server_version + 1,
        "message": "SOP Run updated successfully"
    }


def _process_complete_step(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Mark a step as completed"""
    run_name = payload.get("run_name")
    step_number = payload.get("step_number")
    
    if not run_name or step_number is None:
        return {"success": False, "error": "Run name and step number are required"}
    
    run_doc = frappe.get_doc("SOP Run", run_name)
    
    # Find and update the step
    for step in run_doc.steps:
        if step.step_number == step_number:
            step.is_completed = 1
            step.completed_at = payload.get("completed_at") or frappe.utils.now()
            step.completed_by = user
            step.notes = payload.get("notes", step.notes)
            break
    else:
        return {"success": False, "error": f"Step {step_number} not found"}
    
    # Check if all steps are completed
    if all(step.is_completed for step in run_doc.steps):
        run_doc.status = "Completed"
        run_doc.completed_at = frappe.utils.now()
    
    run_doc.save()
    
    return {
        "success": True,
        "run_name": run_name,
        "step_number": step_number,
        "message": "Step completed successfully"
    }


def _process_add_note(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Add a note to an SOP Run"""
    run_name = payload.get("run_name")
    note_text = payload.get("note")
    
    if not run_name or not note_text:
        return {"success": False, "error": "Run name and note are required"}
    
    run_doc = frappe.get_doc("SOP Run", run_name)
    
    run_doc.append("notes_history", {
        "note": note_text,
        "added_by": user,
        "added_at": payload.get("timestamp") or frappe.utils.now()
    })
    
    run_doc.save()
    
    return {
        "success": True,
        "run_name": run_name,
        "message": "Note added successfully"
    }


def _process_upload_attachment(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Process an attachment upload from offline"""
    # Note: Actual file upload should be handled via separate endpoint
    # This just creates the attachment reference
    run_name = payload.get("run_name")
    file_name = payload.get("file_name")
    
    if not run_name or not file_name:
        return {"success": False, "error": "Run name and file name are required"}
    
    run_doc = frappe.get_doc("SOP Run", run_name)
    
    run_doc.append("attachments", {
        "file_name": file_name,
        "uploaded_by": user,
        "uploaded_at": payload.get("timestamp") or frappe.utils.now(),
        "is_offline": 1
    })
    
    run_doc.save()
    
    return {
        "success": True,
        "run_name": run_name,
        "message": "Attachment reference created. Please upload file via web interface."
    }


def _process_update_profile(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Update user profile"""
    user_doc = frappe.get_doc("User", user)
    
    allowed_fields = ["first_name", "last_name", "phone", "mobile_no", "location"]
    
    for field in allowed_fields:
        if field in payload:
            setattr(user_doc, field, payload[field])
    
    user_doc.save()
    
    return {
        "success": True,
        "message": "Profile updated successfully"
    }


def _process_corrective_action(payload: Dict, user: str, action: Dict) -> Dict[str, Any]:
    """Create a corrective action"""
    doc = frappe.get_doc({
        "doctype": "Corrective Action",
        "sop_run": payload.get("sop_run"),
        "issue_description": payload.get("issue_description"),
        "severity": payload.get("severity", "Medium"),
        "assigned_to": payload.get("assigned_to"),
        "due_date": payload.get("due_date"),
        "created_by": user,
        "offline_created": 1
    })
    
    doc.insert()
    
    return {
        "success": True,
        "name": doc.name,
        "message": "Corrective action created successfully"
    }


@frappe.whitelist()
def get_sync_status(user: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the current sync status for a user.
    
    Args:
        user: User to get status for (defaults to current user)
        
    Returns:
        Dict with sync status information
    """
    if not user:
        user = frappe.session.user
    
    # Get last sync time
    last_sync = frappe.cache().get_value(f"pulse:last_sync:{user}")
    
    # Count offline-created items
    offline_runs = frappe.db.count("SOP Run", {
        "owner": user,
        "offline_created": 1,
        "modified": [">=", last_sync or "2000-01-01"]
    })
    
    offline_actions = frappe.db.count("Corrective Action", {
        "created_by": user,
        "offline_created": 1,
        "modified": [">=", last_sync or "2000-01-01"]
    })
    
    # Get pending notifications
    notifications = frappe.db.get_all(
        "Notification Log",
        filters={
            "for_user": user,
            "read": 0
        },
        limit=10,
        order_by="creation desc",
        fields=["name", "subject", "type", "creation"]
    )
    
    return {
        "user": user,
        "last_sync": last_sync,
        "offline_items": {
            "sop_runs": offline_runs,
            "corrective_actions": offline_actions
        },
        "unread_notifications": len(notifications),
        "recent_notifications": notifications,
        "server_time": frappe.utils.now()
    }


@frappe.whitelist()
def resolve_sync_conflicts(conflicts: str, resolution: str) -> Dict[str, Any]:
    """
    Resolve sync conflicts.
    
    Args:
        conflicts: JSON string of conflict data
        resolution: Resolution strategy ('client', 'server', 'merge')
        
    Returns:
        Dict with resolution results
    """
    try:
        conflicts_list = json.loads(conflicts) if isinstance(conflicts, str) else conflicts
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid conflicts format"}
    
    if not isinstance(conflicts_list, list):
        conflicts_list = [conflicts_list]
    
    results = []
    
    for conflict in conflicts_list:
        try:
            result = _resolve_single_conflict(conflict, resolution)
            results.append(result)
        except Exception as e:
            results.append({
                "conflict_id": conflict.get("action_id"),
                "success": False,
                "error": str(e)
            })
    
    return {
        "success": all(r.get("success") for r in results),
        "resolved": len([r for r in results if r.get("success")]),
        "failed": len([r for r in results if not r.get("success")]),
        "results": results
    }


def _resolve_single_conflict(conflict: Dict, resolution: str) -> Dict[str, Any]:
    """Resolve a single sync conflict"""
    action_type = conflict.get("action_type")
    server_data = conflict.get("server_data", {})
    client_data = conflict.get("client_data", {}).get("payload", {})
    
    if resolution == "server":
        # Use server version - no action needed
        return {
            "success": True,
            "resolution": "server",
            "message": "Server version accepted"
        }
    
    elif resolution == "client":
        # Force client version (overwrites server)
        if action_type == "UPDATE_SOP_RUN":
            doc = frappe.get_doc("SOP Run", client_data.get("name"))
            if "status" in client_data:
                doc.status = client_data["status"]
            if "notes" in client_data:
                doc.notes = client_data["notes"]
            doc.save(ignore_version=True)
            
        return {
            "success": True,
            "resolution": "client",
            "message": "Client version forced"
        }
    
    elif resolution == "merge":
        # Merge both versions (context-specific)
        if action_type == "UPDATE_SOP_RUN":
            doc = frappe.get_doc("SOP Run", client_data.get("name"))
            
            # Merge notes
            if client_data.get("notes") and server_data.get("notes"):
                merged_notes = f"{server_data['notes']}\n\n--- Offline Edit ---\n{client_data['notes']}"
                doc.notes = merged_notes
            elif client_data.get("notes"):
                doc.notes = client_data["notes"]
            
            # Use latest status
            if client_data.get("status"):
                doc.status = client_data["status"]
            
            doc.save()
            
        return {
            "success": True,
            "resolution": "merge",
            "message": "Changes merged"
        }
    
    else:
        return {
            "success": False,
            "error": f"Unknown resolution strategy: {resolution}"
        }


def _update_last_sync(user: str):
    """Update the last sync timestamp for a user"""
    frappe.cache().set_value(
        f"pulse:last_sync:{user}",
        frappe.utils.now(),
        expires_in_sec=86400 * 7  # 7 days
    )


def _get_doc_version(doc) -> int:
    """Get document version for conflict detection"""
    # Use modified timestamp as version proxy
    return int(doc.modified.timestamp()) if doc.modified else 0


@frappe.whitelist()
def get_pending_changes(user: Optional[str] = None) -> Dict[str, Any]:
    """
    Get all pending changes that need to be synced to a device.
    Used when a device comes back online after being offline.
    
    Args:
        user: User to get changes for
        
    Returns:
        Dict with pending changes
    """
    if not user:
        user = frappe.session.user
    
    last_sync = frappe.cache().get_value(f"pulse:last_sync:{user}")
    
    # Get SOP runs modified since last sync
    sop_runs = frappe.get_all(
        "SOP Run",
        filters={
            "modified": [">=", last_sync or "2000-01-01"],
            "docstatus": ["<", 2]
        },
        fields=["name", "sop_template", "status", "assigned_to", "modified"]
    )
    
    # Get corrective actions
    corrective_actions = frappe.get_all(
        "Corrective Action",
        filters={
            "modified": [">=", last_sync or "2000-01-01"],
            "docstatus": ["<", 2]
        },
        fields=["name", "sop_run", "issue_description", "status", "modified"]
    )
    
    return {
        "changes_since": last_sync,
        "sop_runs": sop_runs,
        "corrective_actions": corrective_actions,
        "total_changes": len(sop_runs) + len(corrective_actions)
    }


@frappe.whitelist()
def clear_offline_data():
    """Clear all offline-created flags (admin only)"""
    if not frappe.has_permission("SOP Run", "write"):
        frappe.throw(_("Not permitted"))
    
    # This is a maintenance function for cleaning up offline data flags
    frappe.db.sql("""
        UPDATE `tabSOP Run` 
        SET offline_created = 0 
        WHERE offline_created = 1
    """)
    
    frappe.db.sql("""
        UPDATE `tabCorrective Action` 
        SET offline_created = 0 
        WHERE offline_created = 1
    """)
    
    frappe.db.commit()
    
    return {"success": True, "message": "Offline data flags cleared"}
