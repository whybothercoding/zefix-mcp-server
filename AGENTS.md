# Repository guidance

## Code map

- `src/api/`: Zefix and UID clients plus MCP input schemas.
- `src/tools/`: MCP tool handlers and descriptions.
- `src/utils/`: shared formatting, caching, logging, and response helpers.
- `tests/unit/`: unit tests; API behavior is mocked.

## Working defaults

- Keep MCP protocol output on stdout; send diagnostics through the logger.
- Keep external calls measured: the UID public service allows 20 requests per minute. Narrow Zefix searches and avoid bursts.
- Keep credentials in environment variables or the ignored local `.env` file.

## Definition of done

- For tool changes, update the input schema and tool description with the behavior.
- Add or update mocked unit tests for behavior changes.
- Run `npm test` and `npm run lint` before completing code changes.
