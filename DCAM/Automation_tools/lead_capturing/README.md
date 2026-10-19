# Market Capturing Tools

This project is a small Flask workspace for finding potential client businesses and contact details.

It currently includes two tools:

- Business Contact Finder: search one or more business types in an area and collect available phone numbers, emails, addresses, websites, Google Maps links, ratings, review counts, and descriptions. Results can be downloaded as a CSV with the configured outreach columns.
- Website Gap Finder: search a business type in an area and highlight businesses with missing, broken, parked, expired, or suspicious websites.

Both tools request every result page returned by Google Places for the query and enrich results from public pages on listed business websites.

## How it works

1. Open the home page and choose a tool.
2. Enter a business type, or multiple business types separated by commas or new lines, plus an area.
3. The app searches Google Places for queries like `law firms in Mumbai`.
4. Each result is checked for a listed website.
5. If a website exists, the app tests the site and looks for public email addresses on the homepage and contact/about pages.
6. Results can be downloaded as a mailing-ready CSV.

## Requirements

- Python 3.13+
- A Google Maps Platform API key with Places API enabled

## Setup

```powershell
cd D:\DCAM\Automation_tools\lead_capturing
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and add your real `GOOGLE_MAPS_API_KEY`.

If you also want to run tests locally:

```powershell
pip install -r requirements-dev.txt
```

## Run

```powershell
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Google Sheet Export

The Business Contact Finder can send the current result CSV directly to this configured Google Sheet:

```text
https://docs.google.com/spreadsheets/d/1lPKb5kvQRD-Gdac05S_vE2uSYzlv1hC7KSUdfLJHrs4/edit
```

To enable sending:

1. Enable Google Sheets API in the same Google Cloud project.
2. Create a service account and download its JSON key.
3. Put the JSON file in this project as `google-service-account.json`.
4. Open the Google Sheet and share it with the service account email as an editor.
5. Make sure `.env` contains:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1lPKb5kvQRD-Gdac05S_vE2uSYzlv1hC7KSUdfLJHrs4
GOOGLE_SHEETS_CREDENTIALS_FILE=google-service-account.json
GOOGLE_SHEETS_RANGE=
```

If `GOOGLE_SHEETS_RANGE` is blank, the app automatically uses the first tab in the sheet. Each click on `Send to Google Sheet` appends new rows after the existing data; it does not overwrite previous leads. Newly sent rows are marked with `New` in the `status` column.
If a business has multiple emails, the app sends one row per email and repeats the same business details on each row. Businesses without an email stay visible in the table, but they are not sent to the mailing sheet.

## Test

```powershell
pip install -r requirements-dev.txt
pytest
```

## Notes

- Email addresses are only shown when they are publicly exposed on the business website.
- Businesses with no website will usually not have an email unless another public source exposes one, which this version does not crawl.
- No tool can guarantee every business on the internet. This app fetches every Google Places result page available for each query and enriches from public website pages.
- Google Places usage can incur billing depending on your account and quota setup.
- Google currently documents Text Search (New) as returning up to 60 results across all pages for a query, though that limit may change. This app fetches every page available for the query.
