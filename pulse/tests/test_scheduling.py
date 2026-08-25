# Copyright (c) 2026, Tridz and contributors
# License: MIT

import datetime
import unittest
from zoneinfo import ZoneInfo

from pulse.domain.scheduling import make_run_key, resolve_schedule


class TestSchedulingResolver(unittest.TestCase):
	"""Pure-domain tests for pulse.domain.scheduling.resolve_schedule."""

	def _template(
		self,
		frequency_type="Daily",
		schedule_timezone="UTC",
		local_start_time="09:00:00",
		completion_window_minutes=60,
	):
		return {
			"frequency_type": frequency_type,
			"schedule_timezone": schedule_timezone,
			"local_start_time": local_start_time,
			"completion_window_minutes": completion_window_minutes,
		}

	def _assignment(self, **overrides):
		return {
			"schedule_timezone_override": overrides.get("schedule_timezone_override"),
			"local_start_time_override": overrides.get("local_start_time_override"),
			"completion_window_minutes_override": overrides.get("completion_window_minutes_override"),
		}

	def test_daily_actionable_window_computes_opens_due_and_key(self):
		"""Daily window in Asia/Kolkata converts local start time to UTC correctly."""
		template = self._template(
			schedule_timezone="Asia/Kolkata",
			local_start_time="09:00:00",
			completion_window_minutes=60,
		)
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 8, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNotNone(result)
		self.assertEqual(result["schedule_key"], "2026-01-15")
		self.assertEqual(result["window_date"], datetime.date(2026, 1, 15))
		self.assertEqual(result["effective_timezone"], "Asia/Kolkata")
		# 09:00 IST = 03:30 UTC
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 15, 3, 30, 0))
		self.assertEqual(result["due_at"], datetime.datetime(2026, 1, 15, 4, 30, 0))
		self.assertEqual(result["completion_window_minutes"], 60)

	def test_daily_not_yet_actionable_returns_none(self):
		"""Evaluation before the local start time must not produce a window."""
		template = self._template(
			schedule_timezone="Asia/Kolkata",
			local_start_time="09:00:00",
			completion_window_minutes=60,
		)
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 2, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNone(result)

	def test_weekly_actionable_window_uses_monday(self):
		"""Weekly window is the Monday week in the assignment's time zone."""
		template = self._template(
			frequency_type="Weekly",
			schedule_timezone="America/New_York",
			local_start_time="09:00:00",
			completion_window_minutes=120,
		)
		assignment = self._assignment()
		# Wednesday 14 Jan 2026, 14:00 UTC = 09:00 EST. Week starts Monday 12 Jan.
		eval_instant = datetime.datetime(2026, 1, 14, 14, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNotNone(result)
		self.assertEqual(result["schedule_key"], "2026-W03")
		self.assertEqual(result["window_date"], datetime.date(2026, 1, 12))
		self.assertEqual(result["effective_timezone"], "America/New_York")
		# 09:00 EST (UTC-5) on 12 Jan = 14:00 UTC
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 12, 14, 0, 0))
		self.assertEqual(result["due_at"], datetime.datetime(2026, 1, 12, 16, 0, 0))

	def test_monthly_actionable_window_uses_first_of_month(self):
		"""Monthly window is the first day of the local month."""
		template = self._template(
			frequency_type="Monthly",
			schedule_timezone="UTC",
			local_start_time="08:00:00",
			completion_window_minutes=30,
		)
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 10, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNotNone(result)
		self.assertEqual(result["schedule_key"], "2026-01")
		self.assertEqual(result["window_date"], datetime.date(2026, 1, 1))
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 1, 8, 0, 0))
		self.assertEqual(result["due_at"], datetime.datetime(2026, 1, 1, 8, 30, 0))

	def test_assignment_override_beats_template_value(self):
		"""Assignment schedule overrides win over template defaults."""
		template = self._template(
			schedule_timezone="UTC",
			local_start_time="09:00:00",
			completion_window_minutes=60,
		)
		assignment = self._assignment(
			schedule_timezone_override="Asia/Kolkata",
			local_start_time_override="10:00:00",
			completion_window_minutes_override=90,
		)
		# 05:00 UTC = 10:30 IST, so the 10:00 IST window is actionable.
		eval_instant = datetime.datetime(2026, 1, 15, 5, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNotNone(result)
		self.assertEqual(result["effective_timezone"], "Asia/Kolkata")
		self.assertEqual(result["completion_window_minutes"], 90)
		# 10:00 IST = 04:30 UTC; 90 minutes later = 06:00 UTC
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 15, 4, 30, 0))
		self.assertEqual(result["due_at"], datetime.datetime(2026, 1, 15, 6, 0, 0))

	def test_template_value_used_when_no_assignment_override(self):
		"""When no override is present the template value is used."""
		template = self._template(
			schedule_timezone="UTC",
			local_start_time="07:00:00",
			completion_window_minutes=45,
		)
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 7, 30, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNotNone(result)
		self.assertEqual(result["effective_timezone"], "UTC")
		self.assertEqual(result["completion_window_minutes"], 45)
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 15, 7, 0, 0))
		self.assertEqual(result["due_at"], datetime.datetime(2026, 1, 15, 7, 45, 0))

	def test_site_timezone_fallback(self):
		"""Site timezone is used when neither assignment nor template supplies one."""
		template = {
			"frequency_type": "Daily",
			"schedule_timezone": "",
			"local_start_time": "09:00:00",
			"completion_window_minutes": 60,
		}
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 4, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant, site_timezone="Asia/Kolkata")

		self.assertIsNotNone(result)
		self.assertEqual(result["effective_timezone"], "Asia/Kolkata")
		self.assertEqual(result["opens_at"], datetime.datetime(2026, 1, 15, 3, 30, 0))

	def test_custom_frequency_is_not_supported(self):
		"""Custom frequency returns None instead of guessing a schedule."""
		template = self._template(frequency_type="Custom")
		assignment = self._assignment()
		eval_instant = datetime.datetime(2026, 1, 15, 12, 0, 0, tzinfo=ZoneInfo("UTC"))

		result = resolve_schedule(template, assignment, eval_instant)

		self.assertIsNone(result)

	def test_run_key_is_derived_from_assignment_and_schedule_key(self):
		"""run_key is deterministic and unique per assignment + window."""
		key = make_run_key("SOP-ASGN-0001", "2026-01-15")
		self.assertEqual(key, "SOP-ASGN-0001:2026-01-15")
		self.assertEqual(
			make_run_key("SOP-ASGN-0001", "2026-01-15"),
			make_run_key("SOP-ASGN-0001", "2026-01-15"),
		)
		self.assertNotEqual(
			make_run_key("SOP-ASGN-0001", "2026-01-15"),
			make_run_key("SOP-ASGN-0002", "2026-01-15"),
		)


if __name__ == "__main__":
	unittest.main()
