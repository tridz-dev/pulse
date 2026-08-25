# Copyright (c) 2026, Tridz and contributors
# License: MIT

import unittest
from datetime import date

from pulse.domain.periods import build_buckets, bucket_utc_bounds


class TestBuildBuckets(unittest.TestCase):
	def test_day_buckets_partition_range(self):
		buckets = build_buckets("Day", date(2026, 1, 1), date(2026, 1, 5))
		self.assertEqual(len(buckets), 5)
		self.assertEqual(buckets[0]["start"], date(2026, 1, 1))
		self.assertEqual(buckets[0]["end"], date(2026, 1, 1))
		self.assertEqual(buckets[-1]["start"], date(2026, 1, 5))
		self.assertEqual(buckets[-1]["end"], date(2026, 1, 5))

	def test_week_buckets_over_a_month(self):
		# 2026-01-01 is a Thursday; 2026-01-31 is a Saturday.
		buckets = build_buckets("Week", date(2026, 1, 1), date(2026, 1, 31))
		# ~4-5 weekly buckets, not one giant bucket.
		self.assertGreaterEqual(len(buckets), 4)
		self.assertLessEqual(len(buckets), 6)
		# First bucket clipped to the requested start.
		self.assertEqual(buckets[0]["start"], date(2026, 1, 1))
		# Last bucket clipped to the requested end.
		self.assertEqual(buckets[-1]["end"], date(2026, 1, 31))
		# Buckets are chronological and non-overlapping.
		for prev, nxt in zip(buckets, buckets[1:]):
			self.assertLess(prev["end"], nxt["start"])

	def test_month_buckets_over_a_year(self):
		buckets = build_buckets("Month", date(2026, 1, 15), date(2026, 3, 10))
		self.assertEqual(len(buckets), 3)
		self.assertEqual(buckets[0]["key"], "2026-01")
		self.assertEqual(buckets[0]["start"], date(2026, 1, 15))
		self.assertEqual(buckets[1]["key"], "2026-02")
		self.assertEqual(buckets[1]["start"], date(2026, 2, 1))
		self.assertEqual(buckets[1]["end"], date(2026, 2, 28))
		self.assertEqual(buckets[2]["end"], date(2026, 3, 10))

	def test_custom_range_produces_one_bucket(self):
		buckets = build_buckets("Custom", date(2026, 1, 1), date(2026, 6, 30))
		self.assertEqual(len(buckets), 1)
		self.assertEqual(buckets[0]["start"], date(2026, 1, 1))
		self.assertEqual(buckets[0]["end"], date(2026, 6, 30))

	def test_unknown_period_type_raises(self):
		with self.assertRaises(ValueError):
			build_buckets("Fortnight", date(2026, 1, 1), date(2026, 1, 5))


class TestBucketUtcBounds(unittest.TestCase):
	def test_boundary_datetime_lands_in_correct_bucket(self):
		buckets = build_buckets("Day", date(2026, 1, 1), date(2026, 1, 3))
		day1, day2, day3 = buckets

		start1, end1 = bucket_utc_bounds(day1, "Asia/Kolkata")
		start2, end2 = bucket_utc_bounds(day2, "Asia/Kolkata")

		# The end of day 1's UTC range must equal the start of day 2's,
		# so a due_at exactly at local midnight lands in day 2, not day 1.
		self.assertEqual(end1, start2)

		start3, end3 = bucket_utc_bounds(day3, "Asia/Kolkata")
		self.assertEqual(end2, start3)

	def test_utc_bounds_reflect_timezone_offset(self):
		bucket = build_buckets("Day", date(2026, 1, 1), date(2026, 1, 1))[0]
		start_utc, end_utc = bucket_utc_bounds(bucket, "Asia/Kolkata")
		# Asia/Kolkata is UTC+5:30, so local midnight is 18:30 UTC the prior day.
		self.assertEqual(start_utc.hour, 18)
		self.assertEqual(start_utc.minute, 30)
		self.assertEqual(start_utc.date(), date(2025, 12, 31))
		self.assertEqual(end_utc.date(), date(2026, 1, 1))
		self.assertEqual(end_utc.hour, 18)
		self.assertEqual(end_utc.minute, 30)


if __name__ == "__main__":
	unittest.main()
