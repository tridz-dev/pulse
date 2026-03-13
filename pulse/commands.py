# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Bench commands for Pulse."""

import click

import frappe
from frappe.commands import get_site, pass_context
from frappe.utils.bench_helper import CliCtxObj


@click.command("pulse-load-demo")
@pass_context
def load_demo(context: CliCtxObj):
	"""Load Pulse demo data (users, employees, SOPs, ~30 days of runs and scores)."""
	site = get_site(context)
	with frappe.init_site(site):
		frappe.connect()
		from pulse.seed.seed import seed_dummy_data

		seed_dummy_data()
		frappe.db.commit()
	click.echo("Pulse demo data loaded.")


commands = [load_demo]
