# Generate RAML Spec

Generate a new RAML 1.0 specification for the requested REST API domain.

## Instructions

- Place the file in `rest/raml/` named `<api-name>-<YYYY-MM-DD>.raml` (date in `YYYY-MM-DD` format).
- Use **RAML 1.0** only. Do **not** use RAML 0.8.
- Begin the file with `#%RAML 1.0` as the very first line.
- Include the following root-level properties:
  - `title` — human-readable API name.
  - `version` — e.g. `v1`.
  - `baseUri` — a realistic HTTPS URL (e.g. `https://api.example.com/v1`).
  - `mediaType` — default to `application/json`.
  - `description` — multi-sentence description of the API's purpose.
- Define reusable data types under `types` using RAML type syntax (not JSON Schema).
- Include at least 5 top-level resources, using nested sub-resources where logical (e.g. `/{id}/items`).
- Use `traits` for cross-cutting behaviour such as paging and security headers.
- Use `resourceTypes` for repeating patterns (e.g. `collection` and `item`).
- Each resource should include appropriate methods (GET, POST, PUT, DELETE) with:
  - A `description`.
  - `queryParameters` on list endpoints (e.g. `page`, `pageSize`).
  - `body` with a type reference for request payloads.
  - `responses` with status codes `200`/`201`, `400`, `401`, `404`, and `500`, each with a body type reference.
- Define a `securitySchemes` entry for Bearer Token or OAuth 2.0 and apply it to secured methods.
- Use realistic field names, types, enumerations, and constraints.

## User Input

The user will provide the API domain (e.g. "logistics", "patient scheduling"). Generate a spec that reflects that domain using enterprise-grade realism.
