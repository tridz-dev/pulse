# Copyright (c) 2026, Pulse and contributors
# For license information, please see license.txt

import unittest


class TestPulseSmoke(unittest.TestCase):
    """Harmless smoke test proving the Pulse test package is collected."""

    def test_package_is_collected(self):
        """Always passes; verifies test discovery reaches pulse.tests."""
        self.assertTrue(True)
