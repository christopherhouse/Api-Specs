# Generate WSDL Spec

Generate a new WSDL 1.1 specification for the requested SOAP service domain.

## Instructions

- Place the file in `soap/` named `<service-name>-<YYYY-MM-DD>.wsdl` (use today's date).
- Use WSDL 1.1 with SOAP 1.1 document/literal binding.
- Use a target namespace following the pattern `http://schemas.example.com/<domain>/<year>/<month>`.
- Define all types inline under `<wsdl:types>` using XSD.
- Include realistic complex types with proper XSD constraints (`minOccurs`, `maxOccurs`, enumerations, length restrictions).
- Define at least 5 operations covering typical service actions (Get, Search/List, Create, Update, Delete or domain-specific equivalents).
- Create proper `<wsdl:message>`, `<wsdl:portType>`, `<wsdl:binding>`, and `<wsdl:service>` elements.
- Include an `Error` complex type for fault responses.
- Use a realistic `<soap:address>` location URL (e.g. `https://api.contoso.com/<domain>/soap`).

## User Input

The user will provide the service domain (e.g. "order management", "human resources").
