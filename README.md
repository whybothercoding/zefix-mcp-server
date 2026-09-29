# Zefix MCP Server

Search the Swiss commercial register, retrieve company and publication data, and validate Swiss UID and VAT numbers through the Model Context Protocol (MCP).

This is an independent, unofficial project. It is not operated by or affiliated with the Swiss Confederation, the Federal Office of Justice, or the Federal Statistical Office.

## What it does

The server exposes nine tools over MCP's standard input/output (stdio) transport. It combines the authenticated Zefix Public REST API with the public functions of the Swiss UID Webservice.

| Tool | Data source | Purpose |
| --- | --- | --- |
| `search_companies` | Zefix | Search by company name; optionally filter by canton, legal form, and active status. |
| `get_company_by_uid` | Zefix, optional UID enrichment | Retrieve a company's register record and optionally enrich it with UID data. |
| `get_company_publications` | Zefix | Retrieve a company's SOGC publications, newest first. |
| `get_daily_registrations` | Zefix | Browse SOGC publications for a date, with canton and mutation filters. |
| `advanced_search` | UID Webservice | Search by organization or person name, canton, and legal form. |
| `get_company_details_uid` | UID Webservice | Retrieve company details directly by UID. |
| `validate_uid` | UID Webservice | Check whether a UID exists in the register. |
| `validate_vat_number` | UID Webservice | Check whether a Swiss VAT number is valid and active. |
| `generate_due_diligence_report` | Zefix and UID Webservice | Combine company, registry, VAT, and optionally publication data into a report. |

The tools return registry data; they do not provide legal, financial, or compliance advice.

## Requirements

- Node.js and npm
- Zefix API credentials for Zefix-backed tools
- An MCP client that supports local stdio servers

Request Zefix API credentials from the Federal Office of Justice at [zefix@bj.admin.ch](mailto:zefix@bj.admin.ch). UID Public Services do not require credentials.

## Install

```bash
git clone https://github.com/whybothercoding/zefix-mcp-server.git
cd zefix-mcp-server
npm install
cp .env.example .env
```

Edit `.env` and set `ZEFIX_USERNAME` and `ZEFIX_PASSWORD`:

```dotenv
ZEFIX_USERNAME=your_zefix_username
ZEFIX_PASSWORD=your_zefix_password
```

The `.env` file is excluded from Git. Keep credentials out of source files and never commit them.

Optional settings:

| Variable | Default | Description |
| --- | --- | --- |
| `ZEFIX_BASE_URL` | `https://www.zefix.admin.ch/ZefixPublicREST/api/v1` | Zefix REST API base URL. |
| `UID_PUBLIC_URL` | `https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl` | UID Public Services WSDL. |
| `CACHE_ENABLED` | `false` | Set to `true` to enable the in-memory response cache. |
| `CACHE_TTL` | `3600` | Default cache lifetime in seconds; some API methods use their own TTL. |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal`. |

## Connect an MCP client

Use absolute paths in your MCP configuration. For direct local runs, start the process from the repository root so it loads `.env`. For MCP clients, pass the Zefix credentials through the client configuration as shown below, or use a local wrapper that loads your environment.

### Claude Code

Add this server to your Claude Code MCP configuration. Replace the path with your local path:

```json
{
  "mcpServers": {
    "zefix": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/zefix-mcp-server/src/index.js"],
      "env": {
        "ZEFIX_USERNAME": "${ZEFIX_USERNAME}",
        "ZEFIX_PASSWORD": "${ZEFIX_PASSWORD}"
      }
    }
  }
}
```

### Codex

Add this entry to `~/.codex/config.toml`. Replace the path with your local path:

```toml
[mcp_servers.zefix]
enabled = true
command = "node"
args = ["/absolute/path/to/zefix-mcp-server/src/index.js"]
cwd = "/absolute/path/to/zefix-mcp-server"
```

The `cwd` setting lets the server load credentials from `.env` in the repository. Alternatively, remove `cwd` and add `env_vars = ["ZEFIX_USERNAME", "ZEFIX_PASSWORD"]` to forward variables already present in the environment that launched Codex. In Codex TOML, `env` values are literal strings; `${VARIABLE}` is not expanded.

Restart the MCP client after saving its configuration. The server communicates over stdio, so run it through the MCP client rather than as a standalone interactive command.

## Tool reference

All inputs are JSON objects. UID and VAT numbers use the format `CHE-123.456.789` (spaces and unformatted digits are also accepted by the server). Results are returned as text content, usually containing JSON; `generate_due_diligence_report` returns a Markdown report and raw JSON data.

### `search_companies`

Search Zefix by name. Names match by prefix; start the name with `*` for a contains-style match. Broad wildcard searches can be rejected by Zefix, so narrow them with a canton or legal form.

```json
{
  "name": "Migros",
  "canton": "ZH",
  "activeOnly": true,
  "maxResults": 10
}
```

`name` is required and must contain at least three characters. Optional inputs: `canton`, `legalFormUid` (for example, `0106` for an AG), `activeOnly` (default `true`), and `maxResults` (default `30`, maximum `200`). `maxResults` limits returned results; it does not reduce the number of matches Zefix evaluates.

### `get_company_by_uid`

Retrieve a company's Zefix record. `uid` is required. `enrichWithUidData` defaults to `true`; set it to `false` for a Zefix-only lookup. Publication text is returned separately by `get_company_publications`.

```json
{
  "uid": "CHE-106.052.527",
  "enrichWithUidData": true
}
```

### `advanced_search`

Search the UID Webservice. Provide at least one criterion: `organisationName`, `personName`, `canton`, or `legalForms`. `personName` takes `officialName` (required) and optional `firstName`. Other optional inputs are `activeOnly` (default `true`) and `maxResults` (default `30`, maximum `200`).

```json
{
  "organisationName": "Novartis",
  "canton": "BS",
  "legalForms": ["0106"],
  "maxResults": 10
}
```

### `get_company_details_uid`, `validate_uid`, and `validate_vat_number`

Each takes one identifier:

```json
{"uid": "CHE-106.052.527"}
```

For VAT validation, use the company's VAT UID, which can differ from its company UID:

```json
{"vatNumber": "CHE-116.268.023"}
```

### `get_company_publications`

Retrieve a company's SOGC publications, newest first. Inputs: required `uid`; optional `maxResults` (default `20`, maximum `200`) and `offset` (default `0`).

```json
{
  "uid": "CHE-106.052.527",
  "maxResults": 10,
  "offset": 0
}
```

### `get_daily_registrations`

Retrieve compact SOGC publication summaries for a date. Inputs: required `date` in `YYYY-MM-DD` format; optional `canton`, `mutationType`, `maxResults` (default `50`, maximum `200`), `offset` (default `0`), and `includeText` (default `false`). A day may contain around 1,000 publications; filter before paging. `mutationType` accepts keys such as `status.neu`, `status.loeschung`, `adressaenderung`, and `aenderungorgane`; a parent key such as `status` matches its subtypes. Full publication text can be large, so keep pages small when `includeText` is enabled.

```json
{
  "date": "2026-09-29",
  "canton": "ZH",
  "mutationType": "status.neu",
  "maxResults": 20
}
```

### `generate_due_diligence_report`

Combine Zefix and UID data for a company. `uid` is required. `includePublications` defaults to `true`; set it to `false` to omit publication data.

```json
{
  "uid": "CHE-106.052.527",
  "includePublications": false
}
```

## Request limits and caching

The UID Webservice's public functions are limited to **20 requests per minute**; exceeding the limit can temporarily block the caller. Avoid bursts and keep batch lookups below that ceiling. See the [official UID Webservice information](https://www.bk.admin.ch/de/uid-webservice).

The Zefix REST API requires authentication and can return `429` when requests are throttled. The server retries selected transient HTTP errors, including `429`, up to three times. Use specific searches, page through publication results, and avoid unnecessary concurrent calls. The [Zefix REST API documentation](https://www.zefix.admin.ch/ZefixPublicREST/swagger-ui/index.html) describes the available endpoints.

Caching is disabled by default. When enabled with `CACHE_ENABLED=true`, responses are cached in memory for the lifetime configured by the method or `CACHE_TTL`. The cache is per server process and clears when the process restarts.

## Development

```bash
npm test
npm run lint
```

The tests use mocked API responses and do not require live Zefix credentials. To run the MCP server directly during development:

```bash
npm start
```

The process speaks MCP over stdio; starting it directly is mainly useful for client integration and diagnostics.

## Data sources

- [Zefix Public REST API](https://www.zefix.admin.ch/ZefixPublicREST/swagger-ui/index.html) — Swiss commercial register data and SOGC publications. API credentials are required.
- [UID Webservice](https://www.bk.admin.ch/de/uid-webservice) — Swiss UID register public services, including UID and VAT validation. No authentication is required for the public services.

## Support

- Zefix API access: [zefix@bj.admin.ch](mailto:zefix@bj.admin.ch)
- UID Webservice: [uid@bfs.admin.ch](mailto:uid@bfs.admin.ch)
- Server bugs and feature requests: [GitHub Issues](https://github.com/whybothercoding/zefix-mcp-server/issues)

## License

MIT. Copyright (c) 2026 IndieGoWeb Ltd and (c) 2025 ishumilin. See [LICENSE](LICENSE).
