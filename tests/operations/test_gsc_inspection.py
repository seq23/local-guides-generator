import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from distribution_scripts import gsc_inspect_urls


class TestInspection(unittest.TestCase):
    def run_inspection(self, urls, responses):
        with tempfile.TemporaryDirectory() as directory:
            priority = Path(directory) / "priority.txt"
            report = Path(directory) / "report.json"
            priority.write_text(urls)
            service = Mock()
            request = service.urlInspection.return_value.index.return_value.inspect.return_value
            request.execute.side_effect = responses
            with (
                patch.object(gsc_inspect_urls, "build", return_value=service),
                patch.object(gsc_inspect_urls.service_account.Credentials, "from_service_account_file") as credentials,
                patch.object(gsc_inspect_urls.time, "sleep"),
                patch.dict(os.environ, {"GSC_INSPECTION_LIMIT": "20", "GSC_INSPECTION_SLEEP": "0"}),
                patch.object(sys, "argv", ["inspect", "credentials.json", "sc-domain:example.com", str(priority), str(report)]),
            ):
                try:
                    gsc_inspect_urls.main()
                    status = 0
                except SystemExit as stop:
                    status = stop.code
            return status, json.loads(report.read_text()) if report.exists() else None, request.execute.call_count, credentials.called

    def test_transient_timeout_recovers(self):
        status, report, calls, _ = self.run_inspection(
            "https://example.com/one", [TimeoutError(), {"inspectionResult": {}}],
        )
        self.assertEqual(status, 0)
        self.assertEqual(calls, 2)
        self.assertEqual(report["inspected"], 1)
        self.assertIsNone(report["stopped_reason"])

    def test_persistent_timeout_keeps_completed_results_and_stays_red(self):
        status, report, calls, _ = self.run_inspection(
            "https://example.com/one\nhttps://example.com/two",
            [{"inspectionResult": {}}, TimeoutError(), TimeoutError(), TimeoutError()],
        )
        self.assertEqual(status, 1)
        self.assertEqual(calls, 4)
        self.assertEqual(report["inspected"], 1)
        self.assertEqual(report["stopped_reason"], "read_timeout_after_1_inspections")

    def test_empty_input_fails_before_credentials_or_report(self):
        status, report, calls, authenticated = self.run_inspection("", [])
        self.assertEqual(status, 1)
        self.assertIsNone(report)
        self.assertEqual(calls, 0)
        self.assertFalse(authenticated)
