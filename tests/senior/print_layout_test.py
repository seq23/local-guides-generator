"""Offline print behaviour: one page per canonical worksheet, with no controls."""
import json
import unittest
from pathlib import Path
from urllib.parse import unquote, urlparse

from weasyprint import HTML
from weasyprint.urls import URLFetcher

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'


class StaticAssets(URLFetcher):
    def fetch(self, url, headers=None):
        parsed = urlparse(url)
        if parsed.scheme != 'file':
            raise ValueError('Print tests only read local static assets')
        file = Path(unquote(parsed.path))
        if not file.is_relative_to(DIST):
            file = DIST / str(file).lstrip('/')
        if not file.resolve().is_relative_to(DIST.resolve()):
            raise ValueError('Print asset escapes dist')
        return super().fetch(file.as_uri(), headers)


class BinderPrintLayout(unittest.TestCase):
    def test_each_worksheet_fits_one_page_and_print_controls_are_hidden(self):
        source = ROOT / 'data/binders/binders.json'
        self.assertTrue(source.is_file())
        binders = json.loads(source.read_text())['binders']
        self.assertGreater(len(binders), 0)
        for binder in binders:
            with self.subTest(binder=binder['id']):
                file = DIST / 'resources/binders' / binder['id'] / 'index.html'
                self.assertTrue(file.is_file(), 'Build the senior pack before print tests')
                doc = HTML(filename=str(file), media_type='print',
                           url_fetcher=StaticAssets(allowed_protocols=['file'])).render()
                self.assertEqual(len(doc.pages), len(binder['sheets']))
                for page, sheet in zip(doc.pages, binder['sheets']):
                    elements = [box.element for box in page._page_box.descendants()
                                if box.element is not None]
                    printed_sheets = {e.get('data-binder-sheet') for e in elements
                                      if e.get('data-binder-sheet')}
                    self.assertEqual(printed_sheets, {sheet['id']})
                    self.assertFalse(any('data-binder-print' in e.attrib for e in elements))


if __name__ == '__main__':
    unittest.main()
