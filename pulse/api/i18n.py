"""
i18n API endpoints for Pulse application
Provides translation services integrated with Frappe's translation system
"""

import frappe
from frappe import _
from frappe.utils import cstr


@frappe.whitelist(allow_guest=True)
def get_translations(lang: str = None) -> dict:
    """
    Get all translations for a specific language
    
    Args:
        lang: Language code (e.g., 'en', 'es', 'fr'). Defaults to current user's language.
    
    Returns:
        Dictionary of translation keys and values
    """
    if not lang:
        lang = frappe.local.lang or "en"
    
    # Get translations from Frappe's translation system
    translations = frappe.get_all(
        "Translation",
        filters={"language": lang},
        fields=["source_text", "translated_text"]
    )
    
    # Convert to dictionary
    result = {t.source_text: t.translated_text for t in translations}
    
    # Add Pulse-specific translations if not in Frappe system
    pulse_translations = _get_pulse_translations(lang)
    result.update(pulse_translations)
    
    return {
        "language": lang,
        "translations": result,
        "rtl": lang in ["ar", "he", "fa", "ur"]
    }


@frappe.whitelist(allow_guest=True)
def get_available_languages() -> list:
    """
    Get list of supported languages
    
    Returns:
        List of language objects with code, name, flag, and direction
    """
    languages = [
        {"code": "en", "name": "English", "flag": "🇺🇸", "dir": "ltr", "native_name": "English"},
        {"code": "es", "name": "Spanish", "flag": "🇪🇸", "dir": "ltr", "native_name": "Español"},
        {"code": "fr", "name": "French", "flag": "🇫🇷", "dir": "ltr", "native_name": "Français"},
        {"code": "de", "name": "German", "flag": "🇩🇪", "dir": "ltr", "native_name": "Deutsch"},
        {"code": "ar", "name": "Arabic", "flag": "🇸🇦", "dir": "rtl", "native_name": "العربية"},
        {"code": "hi", "name": "Hindi", "flag": "🇮🇳", "dir": "ltr", "native_name": "हिन्दी"},
        {"code": "zh", "name": "Chinese", "flag": "🇨🇳", "dir": "ltr", "native_name": "中文"},
    ]
    
    # Get enabled languages from Frappe if configured
    enabled_langs = frappe.get_all(
        "Language",
        filters={"enabled": 1},
        fields=["language_code", "language_name"]
    )
    
    if enabled_langs:
        enabled_codes = [l.language_code for l in enabled_langs]
        languages = [l for l in languages if l["code"] in enabled_codes]
    
    return languages


@frappe.whitelist()
def translate_key(key: str, lang: str = None) -> dict:
    """
    Translate a single key to the specified language
    
    Args:
        key: Translation key/source text
        lang: Target language code
    
    Returns:
        Dictionary with original key and translated text
    """
    if not lang:
        lang = frappe.local.lang or "en"
    
    # Set language context temporarily
    original_lang = frappe.local.lang
    frappe.local.lang = lang
    
    try:
        translated = _(key)
    finally:
        frappe.local.lang = original_lang
    
    return {
        "key": key,
        "translation": translated,
        "language": lang
    }


@frappe.whitelist()
def sync_translations() -> dict:
    """
    Sync Pulse translations with Frappe's translation system
    Creates Translation documents for any missing keys
    
    Returns:
        Sync status with counts
    """
    # Only allow administrators
    if not frappe.has_permission("Translation", "write"):
        frappe.throw(_("Insufficient permissions to sync translations"))
    
    created = 0
    updated = 0
    
    for lang_code, translations in PULSE_TRANSLATIONS.items():
        for source, target in translations.items():
            existing = frappe.db.get_value(
                "Translation",
                {"language": lang_code, "source_text": source},
                "name"
            )
            
            if existing:
                # Update if translation changed
                doc = frappe.get_doc("Translation", existing)
                if doc.translated_text != target:
                    doc.translated_text = target
                    doc.save()
                    updated += 1
            else:
                # Create new translation
                doc = frappe.new_doc("Translation")
                doc.language = lang_code
                doc.source_text = source
                doc.translated_text = target
                doc.save()
                created += 1
    
    return {
        "success": True,
        "created": created,
        "updated": updated
    }


def _get_pulse_translations(lang: str) -> dict:
    """Get Pulse-specific translations for a language"""
    return PULSE_TRANSLATIONS.get(lang, {})


# Pulse-specific translations (fallback when not in Frappe system)
PULSE_TRANSLATIONS = {
    "en": {
        "Execution Dashboard": "Execution Dashboard",
        "Performance": "Performance",
        "Predictions": "Predictions",
        "Anomalies": "Anomalies",
        "Trends": "Trends",
        "Benchmarks": "Benchmarks",
        "AI-Powered Analytics": "AI-Powered Analytics",
        "My Tasks": "My Tasks",
        "Team": "Team",
        "Operations": "Operations",
        "Insights": "Insights",
        "Settings": "Settings",
    },
    "es": {
        "Execution Dashboard": "Panel de Ejecución",
        "Performance": "Rendimiento",
        "Predictions": "Predicciones",
        "Anomalies": "Anomalías",
        "Trends": "Tendencias",
        "Benchmarks": "Benchmarks",
        "AI-Powered Analytics": "Análisis Impulsado por IA",
        "My Tasks": "Mis Tareas",
        "Team": "Equipo",
        "Operations": "Operaciones",
        "Insights": "Informes",
        "Settings": "Configuración",
    },
    "fr": {
        "Execution Dashboard": "Tableau de Bord d'Exécution",
        "Performance": "Performance",
        "Predictions": "Prédictions",
        "Anomalies": "Anomalies",
        "Trends": "Tendances",
        "Benchmarks": "Benchmarks",
        "AI-Powered Analytics": "Analyses Alimentées par l'IA",
        "My Tasks": "Mes Tâches",
        "Team": "Équipe",
        "Operations": "Opérations",
        "Insights": "Analyses",
        "Settings": "Paramètres",
    },
    "de": {
        "Execution Dashboard": "Ausführungs-Dashboard",
        "Performance": "Leistung",
        "Predictions": "Vorhersagen",
        "Anomalies": "Anomalien",
        "Trends": "Trends",
        "Benchmarks": "Benchmarks",
        "AI-Powered Analytics": "KI-gestützte Analysen",
        "My Tasks": "Meine Aufgaben",
        "Team": "Team",
        "Operations": "Operationen",
        "Insights": "Einblicke",
        "Settings": "Einstellungen",
    },
    "ar": {
        "Execution Dashboard": "لوحة تنفيذ المهام",
        "Performance": "الأداء",
        "Predictions": "التنبؤات",
        "Anomalies": "الشواذ",
        "Trends": "الاتجاهات",
        "Benchmarks": "معايير المقارنة",
        "AI-Powered Analytics": "التحليلات المدعومة بالذكاء الاصطناعي",
        "My Tasks": "مهامي",
        "Team": "الفريق",
        "Operations": "العمليات",
        "Insights": "التحليلات",
        "Settings": "الإعدادات",
    },
    "hi": {
        "Execution Dashboard": "एक्जीक्यूशन डैशबोर्ड",
        "Performance": "प्रदर्शन",
        "Predictions": "भविष्यवाणियां",
        "Anomalies": "विषमताएं",
        "Trends": "रुझान",
        "Benchmarks": "बेंचमार्क्स",
        "AI-Powered Analytics": "AI-संचालित विश्लेषण",
        "My Tasks": "मेरे कार्य",
        "Team": "टीम",
        "Operations": "संचालन",
        "Insights": "विश्लेषण",
        "Settings": "सेटिंग्स",
    },
    "zh": {
        "Execution Dashboard": "执行仪表板",
        "Performance": "绩效",
        "Predictions": "预测",
        "Anomalies": "异常",
        "Trends": "趋势",
        "Benchmarks": "基准",
        "AI-Powered Analytics": "AI 驱动的分析",
        "My Tasks": "我的任务",
        "Team": "团队",
        "Operations": "运营",
        "Insights": "洞察",
        "Settings": "设置",
    },
}
