# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure scheduling policy: resolve local schedule windows into UTC facts.

This module contains no Frappe database access. Callers provide plain dicts for
the template and assignment schedule fields plus an evaluation instant, and
receive the frozen ``opens_at``, ``due_at``, ``schedule_key`` and
``effective_timezone`` for the currently-actionable window, or ``None`` when
the local start time for the current window has not yet arrived.
"""

import datetime
from zoneinfo import ZoneInfo


SUPPORTED_FREQUENCIES = {"Daily", "Weekly", "Monthly"}


def resolve_schedule(template, assignment, evaluation_instant, site_timezone=None):
	"""Resolve the current actionable schedule window for an assignment.

	Args:
		template: dict-like with schedule fields ``frequency_type``,
			``local_start_time``, ``completion_window_minutes`` and
			``schedule_timezone``.
		assignment: dict-like with optional override fields
			``schedule_timezone_override``, ``local_start_time_override`` and
			``completion_window_minutes_override``.
		evaluation_instant: timezone-aware datetime in UTC, or a naive datetime
			treated as UTC.
		site_timezone: fallback IANA time-zone name when neither assignment nor
			template supplies one.

	Returns:
		dict with ``schedule_key``, ``window_date``, ``opens_at``,
		``due_at``, ``effective_timezone`` and ``completion_window_minutes``
		when the window is actionable, or ``None`` if the local start time has
		not yet arrived.
		All returned datetimes are naive UTC values, matching Frappe's normal
		UTC persistence.

	Raises:
		ValueError: if required schedule fields are missing or invalid.
	"""
	frequency_type = _coerce_frequency(template.get("frequency_type"))
	if frequency_type not in SUPPORTED_FREQUENCIES:
		return None

	effective_timezone = _resolve_effective_timezone(template, assignment, site_timezone)
	local_start_time = _resolve_local_start_time(template, assignment)
	completion_window_minutes = _resolve_completion_window(template, assignment)

	if local_start_time is None:
		raise ValueError("local_start_time is required for automatic generation")
	if completion_window_minutes is None or completion_window_minutes <= 0:
		raise ValueError("completion_window_minutes must be a positive integer")

	eval_utc = _as_utc_aware(evaluation_instant)
	local_dt = eval_utc.astimezone(ZoneInfo(effective_timezone))
	window_date = _current_window_date(frequency_type, local_dt.date())
	schedule_key = _schedule_key(frequency_type, window_date)

	tz = ZoneInfo(effective_timezone)
	opens_at_local = datetime.datetime.combine(window_date, local_start_time).replace(tzinfo=tz)
	opens_at_utc = opens_at_local.astimezone(ZoneInfo("UTC"))

	if eval_utc < opens_at_utc:
		return None

	due_at_utc = opens_at_utc + datetime.timedelta(minutes=completion_window_minutes)

	return {
		"schedule_key": schedule_key,
		"window_date": window_date,
		"opens_at": opens_at_utc.replace(tzinfo=None),
		"due_at": due_at_utc.replace(tzinfo=None),
		"effective_timezone": effective_timezone,
		"completion_window_minutes": completion_window_minutes,
	}


def make_run_key(assignment_name, schedule_key):
	"""Return the globally-unique run key for an assignment + schedule window.

	Because ``assignment_name`` is unique and ``schedule_key`` is unique per
	assignment, the derived key is guaranteed unique and deterministic.
	"""
	return f"{assignment_name}:{schedule_key}"


def _resolve_effective_timezone(template, assignment, site_timezone):
	return (
		assignment.get("schedule_timezone_override")
		or template.get("schedule_timezone")
		or site_timezone
		or "UTC"
	)


def _resolve_local_start_time(template, assignment):
	override = _coerce_time(assignment.get("local_start_time_override"))
	if override is not None:
		return override
	return _coerce_time(template.get("local_start_time"))


def _resolve_completion_window(template, assignment):
	override = _coerce_int(assignment.get("completion_window_minutes_override"))
	if override is not None and override > 0:
		return override
	return _coerce_int(template.get("completion_window_minutes"))


def _current_window_date(frequency_type, local_date):
	if frequency_type == "Daily":
		return local_date
	if frequency_type == "Weekly":
		# Week starts Monday per first-milestone contract.
		return local_date - datetime.timedelta(days=local_date.weekday())
	if frequency_type == "Monthly":
		return local_date.replace(day=1)
	return local_date


def _schedule_key(frequency_type, window_date):
	if frequency_type == "Daily":
		return window_date.isoformat()
	if frequency_type == "Weekly":
		iso = window_date.isocalendar()
		return f"{iso.year}-W{iso.week:02d}"
	if frequency_type == "Monthly":
		return f"{window_date.year:04d}-{window_date.month:02d}"
	return window_date.isoformat()


def _as_utc_aware(value):
	if isinstance(value, datetime.datetime):
		if value.tzinfo is None:
			return value.replace(tzinfo=ZoneInfo("UTC"))
		return value.astimezone(ZoneInfo("UTC"))
	raise ValueError(f"evaluation_instant must be a datetime, got {type(value).__name__}")


def _coerce_frequency(value):
	return (value or "").strip()


def _coerce_time(value):
	if value is None or value == "":
		return None
	if isinstance(value, datetime.time):
		return value
	if isinstance(value, datetime.timedelta):
		return (datetime.datetime.min + value).time()
	if isinstance(value, str):
		try:
			return datetime.time.fromisoformat(value)
		except ValueError:
			# Accept "HH:MM" or other common time representations.
			import dateutil.parser

			return dateutil.parser.parse(value).time()
	raise ValueError(f"Cannot coerce {value!r} to a time")


def _coerce_int(value):
	if value is None or value == "":
		return None
	if isinstance(value, int):
		return value
	if isinstance(value, float):
		return int(value)
	if isinstance(value, str):
		return int(value)
	raise ValueError(f"Cannot coerce {value!r} to an integer")
