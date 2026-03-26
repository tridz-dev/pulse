# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Voice Command API for hands-free SOP operation."""

import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import frappe
from frappe import _
from frappe.utils import now, getdate, today, add_days

from pulse.api.permissions import _get_employee_for_user


# Voice command patterns and handlers
VOICE_COMMANDS = {
    "COMPLETE_TASK": {
        "label": "Complete Task",
        "description": "Mark a task as complete by its number",
        "patterns": [
            r"complete task (\d+)",
            r"finish task (\d+)",
            r"mark task (\d+) as complete",
            r"done with task (\d+)",
            r"task (\d+) complete",
        ],
    },
    "START_RUN": {
        "label": "Start Run",
        "description": "Start a new SOP run from a template",
        "patterns": [
            r"start run (\w+)",
            r"begin run (\w+)",
            r"new run (\w+)",
            r"create run (\w+)",
            r"start (\w+) run",
        ],
    },
    "NAVIGATE": {
        "label": "Navigate",
        "description": "Navigate to a specific page",
        "patterns": [
            r"show (\w+) dashboard",
            r"go to (\w+)",
            r"open (\w+)",
            r"navigate to (\w+)",
        ],
    },
    "GET_SCORE": {
        "label": "Get Score",
        "description": "Get current performance score",
        "patterns": [
            r"what is my score",
            r"show my score",
            r"my performance",
            r"how am i doing",
        ],
    },
    "CREATE_CA": {
        "label": "Create Corrective Action",
        "description": "Create a new corrective action",
        "patterns": [
            r"create corrective action",
            r"new corrective action",
            r"add corrective action",
            r"create ca",
            r"new ca",
        ],
    },
    "SEARCH": {
        "label": "Search",
        "description": "Search for items in the system",
        "patterns": [
            r"search for (.+)",
            r"find (.+)",
            r"look for (.+)",
        ],
    },
    "SHOW_HELP": {
        "label": "Help",
        "description": "Show available voice commands",
        "patterns": [
            r"help",
            r"what can i say",
            r"commands",
            r"voice commands",
        ],
    },
}


@frappe.whitelist()
def process_voice_command(command_text: str, context: Optional[Dict] = None) -> Dict:
    """Process a natural language voice command.
    
    Args:
        command_text: The transcribed voice command
        context: Additional context (user, path, action, params)
        
    Returns:
        Dict with success status, result data, and message
    """
    try:
        ctx = context or {}
        user = ctx.get("user") or frappe.session.user
        action = ctx.get("action")
        params = ctx.get("params", {})
        
        # Route to appropriate handler
        handlers = {
            "COMPLETE_TASK": _handle_complete_task,
            "START_RUN": _handle_start_run,
            "NAVIGATE": _handle_navigate,
            "GET_SCORE": _handle_get_score,
            "CREATE_CA": _handle_create_ca,
            "SEARCH": _handle_search,
            "SHOW_HELP": _handle_show_help,
        }
        
        handler = handlers.get(action)
        if handler:
            result = handler(user, params)
            return {
                "success": True,
                "action": action,
                **result
            }
        
        # Try to auto-detect action if not provided
        detected_action = _detect_action(command_text)
        if detected_action:
            handler = handlers.get(detected_action)
            if handler:
                result = handler(user, {})
                return {
                    "success": True,
                    "action": detected_action,
                    **result
                }
        
        return {
            "success": False,
            "action": action or "UNKNOWN",
            "error": "Command not recognized. Say 'help' for available commands."
        }
        
    except Exception as e:
        frappe.log_error("Voice Command Error", str(e))
        return {
            "success": False,
            "action": action or "UNKNOWN",
            "error": str(e)
        }


def _detect_action(command_text: str) -> Optional[str]:
    """Detect action from command text using pattern matching."""
    text_lower = command_text.lower()
    
    for action, config in VOICE_COMMANDS.items():
        for pattern in config["patterns"]:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return action
    
    return None


def _handle_complete_task(user: str, params: Dict) -> Dict:
    """Handle COMPLETE_TASK command."""
    task_number = params.get("taskNumber")
    
    if not task_number:
        return {
            "message": "No task number provided",
            "error": "Please specify a task number"
        }
    
    # Get employee for user
    emp = _get_employee_for_user()
    if not emp:
        return {
            "message": "Employee not found",
            "error": "No Pulse employee profile found for current user"
        }
    
    # Find active runs for this employee
    runs = frappe.get_all(
        "SOP Run",
        filters={
            "assigned_to": emp,
            "status": ["in", ["Draft", "In Progress"]]
        },
        fields=["name"],
        order_by="creation desc",
        limit=1
    )
    
    if not runs:
        return {
            "message": "No active runs found",
            "error": "You don't have any active SOP runs to complete tasks in"
        }
    
    run_id = runs[0].name
    
    # Get tasks for this run
    tasks = frappe.get_all(
        "SOP Task",
        filters={"parent": run_id},
        fields=["name", "idx", "status"],
        order_by="idx"
    )
    
    # Find task by number
    target_task = None
    for task in tasks:
        if str(task["idx"]) == str(task_number):
            target_task = task
            break
    
    if not target_task:
        return {
            "message": f"Task {task_number} not found",
            "error": f"Task {task_number} does not exist in your current run"
        }
    
    if target_task["status"] == "Completed":
        return {
            "message": f"Task {task_number} already completed",
            "result": {"task_id": target_task["name"], "already_complete": True}
        }
    
    # Complete the task
    try:
        task_doc = frappe.get_doc("SOP Task", target_task["name"])
        task_doc.status = "Completed"
        task_doc.completed_by = user
        task_doc.completed_at = now()
        task_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "message": f"Task {task_number} marked as complete",
            "result": {
                "task_id": target_task["name"],
                "task_number": task_number,
                "run_id": run_id
            }
        }
    except Exception as e:
        return {
            "message": f"Failed to complete task {task_number}",
            "error": str(e)
        }


def _handle_start_run(user: str, params: Dict) -> Dict:
    """Handle START_RUN command."""
    template_name = params.get("templateName", "").lower()
    
    # Get employee for user
    emp = _get_employee_for_user()
    if not emp:
        return {
            "message": "Employee not found",
            "error": "No Pulse employee profile found for current user"
        }
    
    # Find template matching the name
    templates = frappe.get_all(
        "SOP Template",
        filters={"is_active": 1},
        fields=["name", "template_name"]
    )
    
    matching_template = None
    for template in templates:
        if template_name in template["template_name"].lower():
            matching_template = template
            break
    
    if not matching_template:
        return {
            "message": f"Template '{params.get('templateName')}' not found",
            "error": "No matching SOP template found. Check available templates."
        }
    
    # Create new run
    try:
        from pulse.api.go import create_run_from_template
        
        run = create_run_from_template(
            template_id=matching_template["name"],
            assigned_to=emp,
            due_date=add_days(today(), 1)
        )
        
        return {
            "message": f"Started {matching_template['template_name']} run",
            "result": {
                "run_id": run["name"],
                "template": matching_template["template_name"],
                "task_count": run.get("task_count", 0)
            }
        }
    except Exception as e:
        return {
            "message": "Failed to start run",
            "error": str(e)
        }


def _handle_navigate(user: str, params: Dict) -> Dict:
    """Handle NAVIGATE command."""
    page = params.get("page", "").lower()
    
    valid_pages = {
        "dashboard": "/",
        "tasks": "/tasks",
        "team": "/team",
        "operations": "/operations",
        "templates": "/templates",
        "insights": "/insights",
        "analytics": "/analytics",
        "branches": "/admin/branches",
        "employees": "/admin/employees",
        "settings": "/admin/settings",
        "checklists": "/go/checklists",
        "alerts": "/go/alerts",
        "profile": "/go/me",
    }
    
    if page in valid_pages:
        return {
            "message": f"Navigating to {page}",
            "result": {"route": valid_pages[page]}
        }
    
    return {
        "message": f"Unknown page: {page}",
        "error": f"Page '{page}' not found"
    }


def _handle_get_score(user: str, params: Dict) -> Dict:
    """Handle GET_SCORE command."""
    # Get employee for user
    emp = _get_employee_for_user()
    if not emp:
        return {
            "message": "Employee not found",
            "error": "No Pulse employee profile found for current user"
        }
    
    try:
        from pulse.api.scores import _calculate_score_snapshot
        
        score_data = _calculate_score_snapshot(emp, today(), "Day")
        
        return {
            "message": f"Your score is {score_data.get('combined_score', 0):.0%}",
            "result": {
                "score": score_data.get("combined_score", 0),
                "completion_rate": score_data.get("completion_rate", 0),
                "timeliness_score": score_data.get("timeliness_score", 0),
                "quality_score": score_data.get("quality_score", 0),
                "employee": emp
            }
        }
    except Exception as e:
        return {
            "message": "Failed to get score",
            "error": str(e)
        }


def _handle_create_ca(user: str, params: Dict) -> Dict:
    """Handle CREATE_CA command."""
    return {
        "message": "Opening corrective action form",
        "result": {"route": "/corrective-actions/new"}
    }


def _handle_search(user: str, params: Dict) -> Dict:
    """Handle SEARCH command."""
    query = params.get("query", "")
    
    if not query:
        return {
            "message": "No search query provided",
            "error": "Please specify what to search for"
        }
    
    return {
        "message": f"Searching for '{query}'",
        "result": {"query": query, "route": f"/?search={query}"}
    }


def _handle_show_help(user: str, params: Dict) -> Dict:
    """Handle SHOW_HELP command."""
    commands_list = [
        {"name": "Complete Task", "example": "complete task 3"},
        {"name": "Start Run", "example": "start run daily"},
        {"name": "Navigate", "example": "show dashboard"},
        {"name": "Get Score", "example": "what is my score"},
        {"name": "Create CA", "example": "create corrective action"},
        {"name": "Search", "example": "search for John"},
    ]
    
    return {
        "message": "Available commands: " + ", ".join([c["name"] for c in commands_list]),
        "result": {"commands": commands_list}
    }


@frappe.whitelist()
def get_available_commands() -> Dict:
    """Get list of available voice commands.
    
    Returns:
        Dict with commands list
    """
    commands = []
    for action, config in VOICE_COMMANDS.items():
        commands.append({
            "action": action,
            "label": config["label"],
            "description": config["description"],
            "examples": _generate_examples(action, config["patterns"])
        })
    
    return {
        "commands": commands
    }


def _generate_examples(action: str, patterns: List[str]) -> List[str]:
    """Generate example phrases from patterns."""
    examples = {
        "COMPLETE_TASK": ["complete task 3", "finish task 5", "task 2 complete"],
        "START_RUN": ["start run daily", "begin run weekly", "new run inspection"],
        "NAVIGATE": ["show dashboard", "go to tasks", "open analytics"],
        "GET_SCORE": ["what is my score", "show my score", "how am i doing"],
        "CREATE_CA": ["create corrective action", "new corrective action", "create ca"],
        "SEARCH": ["search for John", "find employee", "look for template"],
        "SHOW_HELP": ["help", "what can i say", "commands"],
    }
    return examples.get(action, [])


@frappe.whitelist()
def get_voice_command_history(user: Optional[str] = None, limit: int = 20) -> Dict:
    """Get voice command history for a user.
    
    Args:
        user: User to get history for (defaults to current user)
        limit: Maximum number of history items to return
        
    Returns:
        Dict with history list
    """
    user = user or frappe.session.user
    
    # Check if DocType exists
    if not frappe.db.exists("DocType", "Voice Command Log"):
        return {"history": []}
    
    history = frappe.get_all(
        "Voice Command Log",
        filters={"user": user},
        fields=["name", "command_text", "action", "result", "confidence", "timestamp"],
        order_by="timestamp desc",
        limit=limit
    )
    
    return {
        "history": history
    }


@frappe.whitelist(allow_guest=False)
def log_voice_command(command: str, result: str, action: Optional[str] = None, 
                      confidence: Optional[float] = None, error: Optional[str] = None) -> Dict:
    """Log a voice command for audit purposes.
    
    Args:
        command: The command text
        result: 'success' or 'failure'
        action: The action type
        confidence: Speech recognition confidence
        error: Error message if failed
        
    Returns:
        Dict with success status
    """
    try:
        # Check if DocType exists, if not create it silently
        if not frappe.db.exists("DocType", "Voice Command Log"):
            # Just log to error log for now
            frappe.logger().info(f"Voice command: {command} - {result}")
            return {"success": True}
        
        doc = frappe.get_doc({
            "doctype": "Voice Command Log",
            "user": frappe.session.user,
            "command_text": command,
            "action": action or "UNKNOWN",
            "result": result,
            "confidence": confidence or 0,
            "error_message": error,
            "timestamp": now()
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {"success": True}
    except Exception as e:
        # Silently fail logging - don't break the user experience
        frappe.logger().warning(f"Failed to log voice command: {e}")
        return {"success": False, "error": str(e)}
