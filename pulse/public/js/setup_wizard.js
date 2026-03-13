/**
 * Pulse setup wizard: add a single slide to load demo data.
 * Loaded when the Frappe setup wizard runs (first-time site setup).
 */
frappe.provide("pulse.setup");

frappe.setup.on("before_load", function () {
	if (
		frappe.boot.setup_wizard_completed_apps &&
		frappe.boot.setup_wizard_completed_apps.length &&
		frappe.boot.setup_wizard_completed_apps.includes("pulse")
	) {
		return;
	}

	frappe.setup.add_slide(pulse.setup.demo_slide);
});

pulse.setup.demo_slide = {
	name: "pulse_demo",
	title: __("Pulse"),
	icon: "fa fa-dashboard",
	fields: [
		{
			fieldname: "setup_demo_pulse",
			label: __("Load demo data for Pulse"),
			fieldtype: "Check",
			description: __(
				"Creates sample users, employees, departments, SOP templates, assignments, and ~30 days of runs and scores so you can explore the app. You can remove this data later."
			),
		},
	],
};
