# Copyright (c) 2026, Tridz and contributors
# License: MIT
"""Bench CLI commands for Pulse."""

import click
import frappe
from frappe.commands import get_site, pass_context
from frappe.utils.bench_helper import CliCtxObj


@click.command("pulse-load-demo")
@pass_context
def load_demo(context: CliCtxObj):
    """Load Pulse demo data (users, employees, SOPs, ~40 days of runs and scores)."""
    site = get_site(context)
    with frappe.init_site(site):
        frappe.connect()
        from pulse.demo.seed import seed_demo_data
        seed_demo_data()
        frappe.db.commit()
    click.echo("Done. See pulse/demo/README.md for a full account list and data table.")


@click.command("pulse-clear-demo")
@pass_context
def clear_demo(context: CliCtxObj):
    """Remove all Pulse demo data from the site."""
    site = get_site(context)
    with frappe.init_site(site):
        frappe.connect()
        from pulse.demo.seed import clear_demo_data
        clear_demo_data()
        frappe.db.commit()
    click.echo("Pulse demo data cleared.")


@click.command("pulse-load-acceptance-fixture")
@pass_context
def load_acceptance_fixture(context: CliCtxObj):
    """Load the deterministic S1-T06 acceptance fixture."""
    site = get_site(context)
    with frappe.init_site(site):
        frappe.connect()
        from pulse.demo.seed import seed_acceptance_fixture
        seed_acceptance_fixture()
        frappe.db.commit()
    click.echo("Acceptance fixture loaded.")


@click.command("pulse-clear-acceptance-fixture")
@pass_context
def clear_acceptance_fixture_command(context: CliCtxObj):
    """Remove the deterministic S1-T06 acceptance fixture."""
    site = get_site(context)
    with frappe.init_site(site):
        frappe.connect()
        from pulse.demo.seed import clear_acceptance_fixture
        clear_acceptance_fixture()
        frappe.db.commit()
    click.echo("Acceptance fixture cleared.")


commands = [load_demo, clear_demo, load_acceptance_fixture, clear_acceptance_fixture_command]
