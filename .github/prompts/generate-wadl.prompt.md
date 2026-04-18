# Generate WADL Spec

Generate a new WADL specification for the requested REST API domain.

## Instructions

- Place the file in `rest/wadl/` named `<api-name>-<YYYY-MM-DD>.wadl` (use today's date in `YYYY-MM-DD` format).
- Use the `http://wadl.dev.java.net/2009/02` WADL namespace.
- Include a `<doc>` element with a title and description of the API.
- Define types under `<grammars>` using inline XSD with a target namespace following `http://schemas.example.com/<domain>/<year>/<month>`.
- Include realistic simple types (enumerations, constrained strings) and complex types.
- Define a `<resources>` element with a realistic base URL.
- Include at least 5 resources with nested sub-resources where appropriate.
- Each resource should have `<method>` elements (GET, POST, PUT, DELETE as appropriate).
- Include `<request>` elements with query `<param>` definitions and `<representation>` for request bodies.
- Include `<response>` elements with status codes and `<representation>` for response bodies.
- Use `application/json` as the default media type.

## User Input

The user will provide the API domain (e.g. "procurement", "fleet management").
