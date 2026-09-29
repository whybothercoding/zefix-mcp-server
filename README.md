# Zefix MCP Server

MCP (Model Context Protocol) server providing access to Swiss Company Registry data through Zefix REST API and UID Webservice.

This is an unofficial project and not an official implementation by the Swiss government.

## Features

### Dual API Integration
- **Zefix REST API**: Fast company searches and SOGC (Official Gazette) tracking
- **UID Webservice**: VAT registration, commercial register status, LEI and address data. The schema defines NOGA industry codes, but the public service does not populate them; use a company's registered purpose (`get_company_by_uid`) to tell what it does.

### Available Tools (9 tools)

#### Zefix API Tools
1. **search_companies** - Search for Swiss companies by name using the Zefix API. A name matches by prefix; start it with `*` to match anywhere (`*software*`). `activeOnly` (default) also excludes companies in liquidation. Zefix rejects searches that match too many companies (e.g. `*ab*`, `*Liquidation*`); add `canton` or `legalFormUid`, or use a more specific name. Returns `{ totalMatches, returned, companies }`; `maxResults` (default 30, max 200) caps the list.
2. **get_company_by_uid** - Get detailed company information from Zefix by UID, with optional UID Webservice enrichment. SOGC publication texts are left out (see `sogcPublicationCount`); use `get_company_publications`.
3. **get_daily_registrations** - Get SOGC publications for a specific date as compact summaries. A day holds ~1,000 publications, so filter by `canton` and `mutationType` (e.g. `status.neu` = new registration), page with `maxResults` (default 50) / `offset`, and set `includeText` for the full publication text. Zefix sends these texts double-encoded and wrapped in markup; the server returns plain, correctly encoded text.
4. **get_company_publications** - Get SOGC publications for a specific company by UID, most recent first; page with `maxResults` (default 20) / `offset`.

#### UID Webservice Tools
5. **advanced_search** - Advanced company search using the UID Webservice.
6. **validate_uid** - Validate a Swiss UID.
7. **validate_vat_number** - Validate a Swiss VAT number.
8. **get_company_details_uid** - Get detailed company information using only the UID Webservice.

#### Combined API Tools
9. **generate_due_diligence_report** - Generate a comprehensive due diligence report combining data from both Zefix and UID Webservice.

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Zefix REST API Credentials (required for Zefix tools)
# Note: Credentials must be requested from Federal Registry of Commerce
ZEFIX_USERNAME=your_username
ZEFIX_PASSWORD=your_password

# UID Webservice (no auth needed for Public Services)
UID_PUBLIC_URL=https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl

# Optional settings
CACHE_ENABLED=true
CACHE_TTL=3600
LOG_LEVEL=info
```

## Usage

### Running the Server

```bash
npm start
```

### Example Tool Calls

#### Search for companies (Zefix)
```javascript
{
  "name": "search_companies",
  "arguments": {
    "name": "Migros",
    "canton": "ZH",
    "activeOnly": true
  }
}
```

#### Get company details (Zefix + UID)
```javascript
{
  "name": "get_company_by_uid",
  "arguments": {
    "uid": "CHE-123.456.789",
    "enrichWithUidData": true
  }
}
```

#### Validate UID (UID Webservice)
```javascript
{
  "name": "validate_uid",
  "arguments": {
    "uid": "CHE-123.456.789"
  }
}
```

#### Generate due diligence report (Zefix + UID)
```javascript
{
  "name": "generate_due_diligence_report",
  "arguments": {
    "uid": "CHE-123.456.789",
    "includePublications": true
  }
}
```

#### Get daily registrations (Zefix)
```javascript
{
  "name": "get_daily_registrations",
  "arguments": {
    "date": "2025-11-15",
    "canton": "ZH",
    "mutationType": "status.neu"
  }
}
```

## API Documentation

### Zefix REST API
- Base URL: `https://www.zefix.admin.ch/ZefixPublicREST/api/v1`
- Authentication: Basic Auth
- SOGC publications:
  - Per-company publications are returned via `GET /api/v1/company/uid/{uid}` in the `sogcPub[]` field of the company payload (there is no `GET /api/v1/sogc/uid/{uid}` endpoint).
  - Daily publications are available via `GET /api/v1/sogc/bydate/{date}`.

### UID Webservice
- Public Services URL: `https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl`
- Protocol: SOAP
- Authentication: None required for Public Services

## Data Sources

- **Zefix**: Federal Commercial Register (Handelsregister)
- **UID Register**: Federal Business and Enterprise Register
- **SOGC/SHAB**: Swiss Official Gazette of Commerce

## Caching

The server implements intelligent caching:
- Search results: 30 minutes
- Company details: 1 hour
- SOGC data: 6 hours
- UID/VAT validation: 1-24 hours
- Reference data: 24 hours

## Error Handling

All tools include comprehensive error handling:
- Input validation with Zod schemas
- API error handling with retries
- Graceful fallbacks when enrichment fails
- Detailed error messages in responses

## Development

### Project Structure
```
zefix-mcp-server/
├── src/
│   ├── index.js              # MCP server entry point
│   ├── config.js             # Configuration
│   ├── api/
│   │   ├── zefix-client.js   # Zefix REST client
│   │   ├── uid-client.js     # UID SOAP client
│   │   └── schemas.js        # Validation schemas
│   ├── tools/
│   │   ├── company-search.js # Search tools
│   │   ├── validation.js     # Validation tools
│   │   ├── sogc.js          # SOGC tools
│   │   └── due-diligence.js # Due diligence tool
│   └── utils/
│       ├── logger.js         # Logging
│       ├── cache.js          # Caching
│       ├── json-schema.js    # Zod → JSON Schema for MCP tool inputs
│       └── formatting.js     # Formatting utilities
├── .env                      # Environment variables
├── package.json
└── README.md
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Scripts

Helper scripts (for local development and manual checks):

- `scripts/describe-wsdl.mjs` — Inspect/describe UID Webservice WSDL structure
- `scripts/test-uid-search.mjs` — Exercise UID search endpoints with sample queries
- `scripts/test-uid-search-variants.mjs` — Try multiple UID search variants

Run examples:
```bash
node scripts/describe-wsdl.mjs
node scripts/test-uid-search.mjs "CHE-123.456.789"
node scripts/test-uid-search-variants.mjs "Migros"
```

## License

MIT, see [LICENSE](LICENSE).

## Support

For issues with:
- **Zefix API**: Contact Zefix support zefix@bj.admin.ch
- **UID Webservice**: Contact uid@bfs.admin.ch
- **This MCP Server**: Open an issue on GitHub
