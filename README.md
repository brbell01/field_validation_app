# Geolocation Field Verification

A personal, mobile-friendly static web app for reviewing point classifications in the field.

## Features
- CSV import
- Embedded Esri World Imagery + reference labels
- Current target marker
- Browser geolocation and distance to target
- Google Maps directions link
- Confirm or change classifications
- Notes and review timestamps
- Automatic local saving in the browser
- Updated CSV export
- Progressive Web App manifest and service worker

## CSV format
Required:
- `latitude` and `longitude` (aliases `lat`, `lon`, `lng` also work)
- `classification` (aliases `class`, `category` also work)

Optional:
- `id`
- `name`

## Run locally
Because service workers and geolocation work best in a secure browser context, serve the folder rather than double-clicking index.html.

Example with Python:

    python3 -m http.server 8000

Then visit http://localhost:8000/geolocation-field-verifier/ if serving from /mnt/data, or http://localhost:8000 if running the command inside this folder.

## Deploy
Upload the folder to any static host such as GitHub Pages, Netlify or Cloudflare Pages. HTTPS is recommended/required for phone geolocation outside localhost.

## Offline behavior
The app shell is cached after the first load. Live satellite imagery still requires a network connection because imagery tiles are not bulk-downloaded by this app.


## Confidence filtering

Include a `confidence` column using the full numbered labels: `1 - Very low confidence`, `2 - Low confidence`, `3 - Medium confidence`, `4 - High confidence`, or `5 - Very high confidence`. The app preserves that full source text for display/export and uses the complete numbered label to determine the cumulative filter. Common separators after the number (hyphen, en dash, em dash, colon, period, or parenthesis) are accepted. Aliases `confidence_level` and `certainty` are also accepted. Older unnumbered labels remain supported for backward compatibility.

## Database compatibility

The app recognizes the working database fields `class`, `conf_level`, `confidence`, `notes`, and `Check`. Confidence filtering uses `conf_level` (for example `2 - Low`), not the numeric `confidence` score. Export preserves original database columns and adds `field_classification`, `review_status`, `reviewed_at`, and lowercase `check`. If the user changes a classification, `check` is set to `field validated`; confirming the existing classification leaves the prior check value unchanged.
