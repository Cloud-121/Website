# Public API

Read-only HTTP API for published Gulf Coast Mesh meeting records. No authentication is required.

**Production base URL:** `https://meeting.gulfcoastmesh.org`

Only meetings that have been **ended**, **transcribed**, **summarized**, and **published** (with a YouTube URL set in the admin export UI) appear in these endpoints. Unpublished or incomplete meetings are omitted entirely.

## Base URL

| Environment | Base URL |
|-------------|----------|
| Local dev (API only) | `http://127.0.0.1:3001` |
| Local dev (via Vite proxy) | `http://127.0.0.1:5180` |
| Production | `https://meeting.gulfcoastmesh.org` |

In production, run the export server with static client assets:

```sh
npm run app:web:prod
```

Default port is `3001` (`EXPORT_APP_PORT`). Host defaults to `0.0.0.0` (`EXPORT_APP_HOST`).

All paths below are relative to the base URL.

## CORS

Public routes send:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

`OPTIONS` preflight requests return `204 No Content`. Cross-origin browser clients may call these endpoints without credentials.

## Meeting IDs

Meeting IDs are folder names under `recordings/`, for example `2026-05-18_18-31`.

Allowed characters: letters, numbers, dots, underscores, and hyphens.

## Endpoints

### List published meetings

```
GET /api/public/meetings
```

Returns a summary for each published meeting, newest first.

**Response `200`**

```json
{
  "meetings": [
    {
      "id": "2026-05-18_18-31",
      "dateLabel": "May 18, 2026",
      "startedAt": "2026-05-18T23:31:00.000Z",
      "endedAt": "2026-05-19T01:15:00.000Z",
      "youtubeUrl": "https://youtu.be/n_fmH2eKxq4",
      "publishedAt": "2026-05-24T21:59:30.032Z",
      "agendas": [
        {
          "originalName": "2026-05-18-agenda.pdf",
          "contentType": "application/pdf",
          "uploadedAt": "2026-05-18T23:25:00.000Z",
          "size": 84213,
          "downloadUrl": "/api/public/meetings/2026-05-18_18-31/agenda/2026-05-18-agenda.pdf"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Meeting identifier |
| `dateLabel` | string | Human-readable date (US long format, America/Chicago) |
| `startedAt` | string | ISO 8601 UTC start time |
| `endedAt` | string | ISO 8601 UTC end time |
| `youtubeUrl` | string | Published YouTube link |
| `publishedAt` | string | ISO 8601 UTC publish time |
| `agendas` | array | Agenda files attached to the meeting (may be empty) |

Agenda `downloadUrl` values are **relative paths**. Prepend your API base URL to fetch the file, for example:

`https://meeting.gulfcoastmesh.org/api/public/meetings/2026-05-18_18-31/agenda/2026-05-18-agenda.pdf`

---

### Get published meeting detail

```
GET /api/public/meetings/:meetingId
```

Returns transcript and recap text in addition to the summary fields above.

**Response `200`**

```json
{
  "id": "2026-05-18_18-31",
  "dateLabel": "May 18, 2026",
  "startedAt": "2026-05-18T23:31:00.000Z",
  "endedAt": "2026-05-19T01:15:00.000Z",
  "youtubeUrl": "https://youtu.be/n_fmH2eKxq4",
  "publishedAt": "2026-05-24T21:59:30.032Z",
  "agendas": [],
  "transcript": "Full meeting transcript text…",
  "recap": "# Meeting recap\n\n- Action item one\n- Action item two"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `transcript` | string | Plain-text transcript (`transcript/transcript.txt`) |
| `recap` | string | Markdown recap (`summary/recap.md`) |

**Response `404`**

```json
{
  "error": "Published meeting not found."
}
```

Returned when the meeting does not exist, is not published, or is missing transcript/recap content.

---

### Download agenda file

```
GET /api/public/meetings/:meetingId/agenda/:fileName
```

Downloads an agenda PDF (or other uploaded agenda file) for a published meeting.

- `:fileName` must match an agenda's `originalName` from the list or detail response.
- Use URL encoding for special characters in the filename (the API returns encoded paths in `downloadUrl`).

**Response `200`**

Binary file download with the original filename.

**Response `404` / `500`**

```json
{
  "error": "Published meeting not found."
}
```

or

```json
{
  "error": "Agenda file not found."
}
```

## Error format

Most errors return JSON:

```json
{
  "error": "Human-readable message"
}
```

| Status | When |
|--------|------|
| `404` | Unknown or unpublished meeting, missing agenda |
| `500` | Unexpected server error |

## Examples

List all published meetings:

```sh
curl -s https://meeting.gulfcoastmesh.org/api/public/meetings | jq .
```

Fetch one meeting (transcript + recap):

```sh
curl -s https://meeting.gulfcoastmesh.org/api/public/meetings/2026-05-18_18-31 | jq .
```

Download an agenda:

```sh
curl -LO "https://meeting.gulfcoastmesh.org/api/public/meetings/2026-05-18_18-31/agenda/2026-05-18-agenda.pdf"
```

Local development (API on port 3001):

```sh
curl -s http://127.0.0.1:3001/api/public/meetings
curl -s http://127.0.0.1:3001/api/public/meetings/2026-05-18_18-31
```

## What is not public

These require admin login (`EXPORT_APP_PASSWORD`):

- Creating or editing transcripts and recaps
- Transcribing, summarizing, or rendering video
- Publishing or unpublishing meetings
- Downloading admin-only MP4 exports under `/api/meetings/...`

Auth endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/status`) are separate from the public API and do not gate public reads.

## Publishing workflow (admin)

For a meeting to appear in the public API:

1. Recording ends (meeting has an `endedAt` timestamp).
2. Transcript is generated or saved.
3. Recap is generated or saved.
4. Admin sets a YouTube URL and clicks **Publish** in the export web UI.

After publish, `publish.json` is written under the meeting folder and the meeting becomes visible on the public endpoints.
