# Copyright (c) 2026, Tridz and contributors
# License: MIT

"""Pure period/range bucketing helpers for trend endpoints.

No Frappe database access here. Callers resolve buckets in terms of calendar
dates (what "Day"/"Week"/"Month" mean to a user), then convert each bucket's
calendar-date boundaries to UTC datetime bounds using the site timezone
before querying, so a ``due_at`` exactly at a boundary is bucketed correctly
instead of compared as a naive string/date.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def _week_start(d: date) -> date:
	"""Return the Monday on or before ``d``."""
	return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
	return d.replace(day=1)


def _month_end(d: date) -> date:
	if d.month == 12:
		next_month_start = d.replace(year=d.year + 1, month=1, day=1)
	else:
		next_month_start = d.replace(month=d.month + 1, day=1)
	return next_month_start - timedelta(days=1)


def build_buckets(period_type: str, start_date, end_date) -> list[dict]:
	"""Partition [start_date, end_date] into calendar-date buckets.

	Args:
		period_type: "Day", "Week", "Month" or "Custom".
		start_date: date (or date-like) marking the start of the overall range.
		end_date: date (or date-like) marking the end of the overall range,
			inclusive.

	Returns:
		A list of dicts, ordered chronologically, each shaped
		``{"key": str, "label": str, "start": date, "end": date}`` where
		``start``/``end`` are inclusive calendar-date bounds of the bucket.

	"Custom" always yields exactly one bucket spanning the whole range.
	Day/Week/Month partition the range into successive buckets, clipped to
	the requested overall range at both ends.
	"""
	if isinstance(start_date, datetime):
		start_date = start_date.date()
	if isinstance(end_date, datetime):
		end_date = end_date.date()
	if start_date > end_date:
		start_date, end_date = end_date, start_date

	if period_type == "Custom":
		return [
			{
				"key": f"{start_date.isoformat()}_{end_date.isoformat()}",
				"label": f"{start_date.isoformat()} to {end_date.isoformat()}",
				"start": start_date,
				"end": end_date,
			}
		]

	if period_type == "Day":
		buckets = []
		cursor = start_date
		while cursor <= end_date:
			buckets.append(
				{
					"key": cursor.isoformat(),
					"label": cursor.isoformat(),
					"start": cursor,
					"end": cursor,
				}
			)
			cursor += timedelta(days=1)
		return buckets

	if period_type == "Week":
		buckets = []
		cursor = _week_start(start_date)
		while cursor <= end_date:
			bucket_end = cursor + timedelta(days=6)
			buckets.append(
				{
					"key": cursor.isoformat(),
					"label": cursor.isoformat(),
					"start": max(cursor, start_date),
					"end": min(bucket_end, end_date),
				}
			)
			cursor += timedelta(days=7)
		return buckets

	if period_type == "Month":
		buckets = []
		cursor = _month_start(start_date)
		while cursor <= end_date:
			bucket_end = _month_end(cursor)
			buckets.append(
				{
					"key": cursor.strftime("%Y-%m"),
					"label": cursor.strftime("%Y-%m"),
					"start": max(cursor, start_date),
					"end": min(bucket_end, end_date),
				}
			)
			if cursor.month == 12:
				cursor = cursor.replace(year=cursor.year + 1, month=1)
			else:
				cursor = cursor.replace(month=cursor.month + 1)
		return buckets

	raise ValueError(f"Unknown period_type '{period_type}'")


def bucket_utc_bounds(bucket: dict, site_timezone: str) -> tuple[datetime, datetime]:
	"""Convert a bucket's inclusive calendar-date range to UTC datetime bounds.

	The bucket's ``start`` date at local midnight and the day *after*
	``end`` at local midnight (exclusive upper bound) are interpreted in
	``site_timezone`` and converted to naive UTC datetimes, matching how
	``due_at`` is stored (see pulse/tasks.py's scheduling code).

	Returns (start_utc, end_utc_exclusive).
	"""
	tz = ZoneInfo(site_timezone)
	local_start = datetime.combine(bucket["start"], datetime.min.time()).replace(tzinfo=tz)
	local_end_exclusive = datetime.combine(
		bucket["end"] + timedelta(days=1), datetime.min.time()
	).replace(tzinfo=tz)
	start_utc = local_start.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
	end_utc = local_end_exclusive.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
	return start_utc, end_utc
