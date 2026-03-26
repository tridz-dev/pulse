# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Form Intelligence Engine - AI-powered form assistance.

This module provides intelligent form features including:
- Predictive field completion based on history
- Named entity extraction from text
- AI validation with suggestions
- Automatic correction recommendations
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import Counter

import frappe
from frappe import _
from frappe.utils import getdate, today, add_days


class FormIntelligence:
    """Intelligent form assistance engine."""
    
    def __init__(self, user: Optional[str] = None):
        self.user = user or frappe.session.user
        self.employee = self._get_employee()
        
    def _get_employee(self) -> Optional[str]:
        """Get employee ID for the user."""
        if self.user == "Administrator":
            return None
        return frappe.db.get_value("Pulse Employee", {"user": self.user}, "name")
    
    def predict_field_value(self, field: Dict[str, Any], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict a field value based on historical patterns and context.
        
        Args:
            field: Field configuration with name, type, etc.
            context: Current form context (other field values, user info, etc.)
            
        Returns:
            Dict with predicted value, confidence, and reasoning
        """
        field_name = field.get("name", "")
        field_type = field.get("type", "text")
        
        # Context-based predictions
        predictions = []
        
        # 1. Based on current context
        context_prediction = self._predict_from_context(field, context)
        if context_prediction:
            predictions.append(context_prediction)
        
        # 2. Based on historical data
        history_prediction = self._predict_from_history(field)
        if history_prediction:
            predictions.append(history_prediction)
        
        # 3. Based on temporal patterns
        temporal_prediction = self._predict_from_temporal_patterns(field)
        if temporal_prediction:
            predictions.append(temporal_prediction)
        
        # Return best prediction
        if predictions:
            best = max(predictions, key=lambda x: x.get("confidence", 0))
            return best
        
        return None
    
    def _predict_from_context(self, field: Dict[str, Any], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict field value based on current context."""
        field_name = field.get("name", "").lower()
        
        # Location-based predictions
        if "department" in field_name and context.get("location"):
            return {
                "value": "Operations",  # Default based on location
                "confidence": 60,
                "reason": "Based on selected location"
            }
        
        # Role-based predictions
        if "role" in field_name and context.get("user_role"):
            return {
                "value": context["user_role"],
                "confidence": 90,
                "reason": "Based on user role"
            }
        
        # Time-based predictions
        if "time" in field_name or "hour" in field_name:
            current_hour = datetime.now().hour
            if 6 <= current_hour < 12:
                return {
                    "value": "Morning",
                    "confidence": 70,
                    "reason": "Current time is morning"
                }
            elif 12 <= current_hour < 18:
                return {
                    "value": "Afternoon",
                    "confidence": 70,
                    "reason": "Current time is afternoon"
                }
        
        return None
    
    def _predict_from_history(self, field: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict field value based on user's historical inputs."""
        if not self.employee:
            return None
        
        field_name = field.get("name", "")
        
        try:
            # Get recent form submissions
            recent_values = frappe.db.sql(f"""
                SELECT field_name, field_value, COUNT(*) as freq
                FROM `tabForm History`
                WHERE employee = %s
                    AND field_name = %s
                    AND created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY field_value
                ORDER BY freq DESC, created DESC
                LIMIT 1
            """, (self.employee, field_name), as_dict=True)
            
            if recent_values:
                most_common = recent_values[0]
                frequency = recent_values[0].get("freq", 1)
                confidence = min(85, 60 + frequency * 5)  # Higher confidence with more repetition
                
                return {
                    "value": most_common["field_value"],
                    "confidence": confidence,
                    "reason": f"Used {frequency} times in the last 30 days"
                }
        except Exception:
            # Table might not exist
            pass
        
        return None
    
    def _predict_from_temporal_patterns(self, field: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict based on temporal patterns."""
        field_name = field.get("name", "").lower()
        
        # Date field predictions
        if "date" in field_name:
            now = datetime.now()
            
            # For scheduled tasks, predict next occurrence
            if "next" in field_name or "scheduled" in field_name:
                next_date = add_days(today(), 1)
                return {
                    "value": str(next_date),
                    "confidence": 75,
                    "reason": "Next available date"
                }
            
            # For completion dates, predict today
            if "completion" in field_name or "finish" in field_name:
                return {
                    "value": today(),
                    "confidence": 80,
                    "reason": "Today's date"
                }
        
        # Day of week predictions
        if "day" in field_name:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            today_idx = datetime.now().weekday()
            return {
                "value": days[today_idx],
                "confidence": 90,
                "reason": "Current day"
            }
        
        return None
    
    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract named entities from text.
        
        Args:
            text: Input text to analyze
            
        Returns:
            List of extracted entities with type and confidence
        """
        entities = []
        
        # Date entities
        date_patterns = [
            (r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', 'date'),
            (r'\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b', 'date'),
            (r'\b(today|tomorrow|yesterday)\b', 'date_relative'),
            (r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?\b', 'date'),
        ]
        
        for pattern, entity_type in date_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                entities.append({
                    "text": match.group(1),
                    "type": entity_type,
                    "start": match.start(),
                    "end": match.end(),
                    "confidence": 85
                })
        
        # Time entities
        time_pattern = r'\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\b'
        for match in re.finditer(time_pattern, text):
            entities.append({
                "text": match.group(1),
                "type": "time",
                "start": match.start(),
                "end": match.end(),
                "confidence": 90
            })
        
        # Email entities
        email_pattern = r'\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b'
        for match in re.finditer(email_pattern, text):
            entities.append({
                "text": match.group(1),
                "type": "email",
                "start": match.start(),
                "end": match.end(),
                "confidence": 95
            })
        
        # Phone number entities
        phone_pattern = r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b'
        for match in re.finditer(phone_pattern, text):
            entities.append({
                "text": match.group(0),
                "type": "phone",
                "start": match.start(),
                "end": match.end(),
                "confidence": 80
            })
        
        # Employee names (lookup in database)
        employee_names = frappe.get_all(
            "Pulse Employee",
            filters={"is_active": 1},
            fields=["employee_name", "name"],
            limit=100
        )
        
        for emp in employee_names:
            name = emp["employee_name"]
            if name.lower() in text.lower():
                idx = text.lower().find(name.lower())
                entities.append({
                    "text": name,
                    "type": "employee",
                    "entity_id": emp["name"],
                    "start": idx,
                    "end": idx + len(name),
                    "confidence": 90
                })
        
        # Remove overlapping entities (keep higher confidence)
        entities.sort(key=lambda x: (x["start"], -x["confidence"]))
        filtered = []
        for entity in entities:
            if not any(
                e["start"] <= entity["start"] < e["end"] or 
                entity["start"] <= e["start"] < entity["end"]
                for e in filtered
            ):
                filtered.append(entity)
        
        return filtered
    
    def validate_with_ai(self, data: Dict[str, Any], form_type: str) -> Dict[str, Any]:
        """Validate form data using AI patterns.
        
        Args:
            data: Form data to validate
            form_type: Type of form for context-specific validation
            
        Returns:
            Dict with validation results and suggestions
        """
        errors = []
        warnings = []
        suggestions = []
        
        # 1. Completeness check
        required_fields = self._get_required_fields(form_type)
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append({
                    "field": field,
                    "message": f"{field} is required",
                    "severity": "error"
                })
        
        # 2. Consistency checks
        consistency_issues = self._check_consistency(data, form_type)
        warnings.extend(consistency_issues)
        
        # 3. Anomaly detection
        anomalies = self._detect_anomalies(data, form_type)
        warnings.extend(anomalies)
        
        # 4. Generate improvement suggestions
        suggestions = self._generate_validation_suggestions(data, form_type)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "score": self._calculate_validation_score(errors, warnings)
        }
    
    def _get_required_fields(self, form_type: str) -> List[str]:
        """Get required fields for a form type."""
        # This could be fetched from DocType configuration
        required_map = {
            "sop_run": ["template", "employee", "run_date"],
            "corrective_action": ["title", "description", "priority", "assigned_to"],
            "equipment_check": ["equipment", "inspection_date", "condition"],
        }
        return required_map.get(form_type, [])
    
    def _check_consistency(self, data: Dict[str, Any], form_type: str) -> List[Dict[str, Any]]:
        """Check for data consistency issues."""
        warnings = []
        
        # Date consistency
        if "start_date" in data and "end_date" in data:
            try:
                start = getdate(data["start_date"])
                end = getdate(data["end_date"])
                if end < start:
                    warnings.append({
                        "field": "end_date",
                        "message": "End date is before start date",
                        "severity": "warning"
                    })
            except Exception:
                pass
        
        # Time consistency
        if "start_time" in data and "end_time" in data:
            # Simplified check - would need proper time parsing
            if data["end_time"] < data["start_time"]:
                warnings.append({
                    "field": "end_time",
                    "message": "End time is before start time",
                    "severity": "warning"
                })
        
        return warnings
    
    def _detect_anomalies(self, data: Dict[str, Any], form_type: str) -> List[Dict[str, Any]]:
        """Detect anomalous values."""
        warnings = []
        
        # Numeric anomaly detection
        for field, value in data.items():
            if isinstance(value, (int, float)):
                # Check for extreme values
                if value > 10000:
                    warnings.append({
                        "field": field,
                        "message": f"Value {value} seems unusually high",
                        "severity": "warning"
                    })
                elif value < 0:
                    warnings.append({
                        "field": field,
                        "message": "Negative value detected",
                        "severity": "warning"
                    })
        
        return warnings
    
    def _generate_validation_suggestions(self, data: Dict[str, Any], form_type: str) -> List[Dict[str, Any]]:
        """Generate suggestions for improving form data."""
        suggestions = []
        
        # Suggest standard formats
        if "description" in data and len(data.get("description", "")) < 20:
            suggestions.append({
                "field": "description",
                "message": "Consider providing a more detailed description",
                "type": "improvement"
            })
        
        # Suggest related fields
        if "department" in data and "location" not in data:
            suggestions.append({
                "field": "location",
                "message": "Consider adding location for department context",
                "type": "addition"
            })
        
        return suggestions
    
    def _calculate_validation_score(self, errors: List, warnings: List) -> int:
        """Calculate overall validation score (0-100)."""
        base_score = 100
        base_score -= len(errors) * 20  # Major deduction for errors
        base_score -= len(warnings) * 5  # Minor deduction for warnings
        return max(0, min(100, base_score))
    
    def suggest_corrections(self, data: Dict[str, Any], errors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Suggest corrections for validation errors.
        
        Args:
            data: Current form data
            errors: List of validation errors
            
        Returns:
            List of suggested corrections
        """
        suggestions = []
        
        for error in errors:
            field = error.get("field", "")
            message = error.get("message", "")
            
            # Generate appropriate correction
            if "required" in message.lower():
                # Try to predict a value
                field_config = {"name": field, "type": "text"}
                prediction = self.predict_field_value(field_config, data)
                if prediction:
                    suggestions.append({
                        "field": field,
                        "current_value": data.get(field),
                        "suggested_value": prediction["value"],
                        "reason": prediction["reason"],
                        "confidence": prediction["confidence"]
                    })
            
            elif "date" in message.lower():
                # Suggest today's date
                suggestions.append({
                    "field": field,
                    "current_value": data.get(field),
                    "suggested_value": today(),
                    "reason": "Valid date required",
                    "confidence": 90
                })
            
            elif "format" in message.lower():
                # Suggest format correction based on field type
                current = data.get(field, "")
                if "email" in field.lower() and "@" not in str(current):
                    suggestions.append({
                        "field": field,
                        "current_value": current,
                        "suggested_value": f"{current}@example.com",
                        "reason": "Email format required",
                        "confidence": 70
                    })
        
        return suggestions


# =============================================================================
# API Functions
# =============================================================================

@frappe.whitelist()
def predict_field(field_name: str, field_type: str = "text", context: Optional[Dict] = None) -> Dict[str, Any]:
    """API endpoint to predict a field value.
    
    Args:
        field_name: Name of the field
        field_type: Type of field (text, date, number, etc.)
        context: Current form context
        
    Returns:
        Dict with prediction result
    """
    try:
        engine = FormIntelligence()
        field = {"name": field_name, "type": field_type}
        context = context or {}
        
        prediction = engine.predict_field_value(field, context)
        
        if prediction:
            return {
                "success": True,
                "prediction": prediction
            }
        
        return {
            "success": True,
            "prediction": None,
            "message": "No prediction available for this field"
        }
        
    except Exception as e:
        frappe.log_error("Form Intelligence Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def extract_entities_from_text(text: str) -> Dict[str, Any]:
    """API endpoint to extract entities from text.
    
    Args:
        text: Text to analyze
        
    Returns:
        Dict with extracted entities
    """
    try:
        engine = FormIntelligence()
        entities = engine.extract_entities(text)
        
        return {
            "success": True,
            "entities": entities,
            "count": len(entities)
        }
        
    except Exception as e:
        frappe.log_error("Entity Extraction Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def validate_form_data(data: Dict[str, Any], form_type: str) -> Dict[str, Any]:
    """API endpoint to validate form data with AI.
    
    Args:
        data: Form data to validate
        form_type: Type of form
        
    Returns:
        Dict with validation results
    """
    try:
        engine = FormIntelligence()
        result = engine.validate_with_ai(data, form_type)
        
        # Generate corrections if there are errors
        if result.get("errors"):
            suggestions = engine.suggest_corrections(data, result["errors"])
            result["corrections"] = suggestions
        
        return {
            "success": True,
            **result
        }
        
    except Exception as e:
        frappe.log_error("Form Validation Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_suggestions_for_form(form_type: str, current_data: Optional[Dict] = None) -> Dict[str, Any]:
    """Get AI suggestions for an entire form.
    
    Args:
        form_type: Type of form
        current_data: Current form data
        
    Returns:
        Dict with suggestions for multiple fields
    """
    try:
        engine = FormIntelligence()
        current_data = current_data or {}
        
        # Define fields to suggest for each form type
        form_fields = {
            "sop_run": [
                {"name": "run_date", "type": "date"},
                {"name": "department", "type": "text"},
                {"name": "notes", "type": "textarea"},
            ],
            "corrective_action": [
                {"name": "priority", "type": "select"},
                {"name": "due_date", "type": "date"},
                {"name": "assigned_to", "type": "text"},
            ],
        }
        
        fields = form_fields.get(form_type, [])
        suggestions = []
        
        for field in fields:
            # Only suggest for empty fields
            if not current_data.get(field["name"]):
                prediction = engine.predict_field_value(field, current_data)
                if prediction and prediction.get("confidence", 0) > 60:
                    suggestions.append({
                        "field": field["name"],
                        **prediction
                    })
        
        return {
            "success": True,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
        
    except Exception as e:
        frappe.log_error("Form Suggestions Error", str(e))
        return {
            "success": False,
            "error": str(e)
        }
