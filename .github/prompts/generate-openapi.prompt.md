# Generate OpenAPI Spec

Generate a new OpenAPI 3.0 specification for the requested API domain.

## Instructions

- Place the file in `rest/openapi/` named `<api-name>-<YYYY-MM-DD>.yaml` (use today's date in `YYYY-MM-DD` format).
- Use OpenAPI 3.0.0 or later.
- Include `info` with title, version (`1.0.0`), and a multi-sentence description.
- Define at least two `servers` entries (Production and Sandbox).
- Group operations with `tags`.
- Include at least 5 RESTful endpoints covering CRUD operations and list/search.
- Define all schemas under `components/schemas` and reference them via `$ref`.
- Add pagination (`page`/`pageSize` query params) to list endpoints.
- Use standard HTTP status codes and include error response schemas.
- Add a `bearerAuth` security scheme under `components/securitySchemes`.
- Use realistic field names, types, enumerations, and validation constraints.

## User Input

The user will provide the API domain (e.g. "inventory management", "patient scheduling"). If they also specify JSON format, use `.json` extension instead.
