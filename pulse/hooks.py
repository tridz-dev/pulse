app_name = "pulse"
app_title = "Pulse"
app_publisher = "Tridz"
app_description = "Pulse tracks SOP execution across teams and converts daily operational activity into measurable performance signals for managers and leadership."
app_email = "pulse@tridz.com"
app_license = "agpl-3.0"
app_logo_url = "/assets/pulse/logo.svg"
app_url = "pulse"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "pulse",
		"logo": app_logo_url,
		"title": "Pulse",
		"route": app_url,
		"has_permission": "pulse.api.permissions.has_app_permission"
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/pulse/css/pulse.css"
# app_include_js = "/assets/pulse/js/pulse.js"

# include js, css files in header of web template
# web_include_css = "/assets/pulse/css/pulse.css"
# web_include_js = "/assets/pulse/js/pulse.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "pulse/public/scss/website"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "pulse/public/icons.svg"

# Home Pages
# ----------

# Website route rules for frontend SPA
website_route_rules = [
	{"from_route": "/pulse/<path:app_path>", "to_route": "pulse"},
]

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "pulse.utils.jinja_methods",
# 	"filters": "pulse.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "pulse.install.before_install"
after_install = "pulse.install.after_install"

# Setup Wizard (first-time site setup: optional demo data)
# ------------
setup_wizard_requires = "assets/pulse/js/setup_wizard.js"
setup_wizard_complete = "pulse.setup.setup_wizard.setup_demo"

# Uninstallation
# ------------

# before_uninstall = "pulse.uninstall.before_uninstall"
# after_uninstall = "pulse.uninstall.after_uninstall"

# Integration Setup
# ------------------
# Name of the app being installed is passed as an argument

# before_app_install = "pulse.utils.before_app_install"
# after_app_install = "pulse.utils.after_app_install"

# Integration Cleanup
# -------------------

# before_app_uninstall = "pulse.utils.before_app_uninstall"
# after_app_uninstall = "pulse.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "pulse.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"SOP Run": "pulse.api.permissions.sop_run_conditions",
	"Score Snapshot": "pulse.api.permissions.score_snapshot_conditions",
	"Corrective Action": "pulse.api.permissions.corrective_action_conditions",
	"Pulse Notification": "pulse.api.permissions.pulse_notification_conditions",
}

# Document Events
# ---------------

doc_events = {
	"SOP Run": {"on_update": "pulse.api.pulse_cache_invalidate.on_sop_run_saved"},
	"SOP Run Item": {"on_update": "pulse.api.pulse_cache_invalidate.on_sop_run_item_saved"},
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	"cron": {
		"0/15 * * * *": [
			"pulse.tasks.every_quarter_hour",
		],
	},
	"daily": [
		"pulse.tasks.daily"
	],
	"hourly": [
		"pulse.tasks.hourly"
	],
	"weekly": [
		"pulse.tasks.weekly"
	],
	"monthly": [
		"pulse.tasks.monthly"
	],
}

# Testing
# -------

# before_tests = "pulse.install.before_tests"

# Extend DocType Class
# ------------------------------
# extend_doctype_class = {
# 	"Task": "pulse.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "pulse.event.get_events"
# }
#
# override_doctype_dashboards = {
# 	"Task": "pulse.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["pulse.utils.before_request"]
# after_request = ["pulse.utils.after_request"]

# Job Events
# ----------
# before_job = ["pulse.utils.bob"]
# after_job = ["pulse.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"pulse.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain
# }

# Translation
# ------------
# ignore_translatable_strings_from = []
