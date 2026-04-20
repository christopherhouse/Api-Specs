# Azure APIM OpenAPI Validator

A Python tool that validates OpenAPI 3.0.x specifications against [Azure API Management import restrictions](https://learn.microsoft.com/en-us/azure/api-management/api-management-api-import-restrictions).

## Overview

This validator helps ensure your OpenAPI specifications are compatible with Azure API Management before attempting to import them. It checks for common issues that would cause import failures or unexpected behavior.

## Validation Rules

The tool validates the following Azure APIM restrictions:

### ✅ Errors (will cause import to fail)

1. **OpenAPI Version** - Must be 3.0.x (3.0.0, 3.0.1, 3.0.2, or 3.0.3). Version 3.1.x has limited support.
2. **External References** - All `$ref` pointers must be internal (starting with `#/`). External file references are not allowed.
3. **Parameter Uniqueness** - Parameter names must be unique (case-insensitive) across path, query, and header parameters within the same operation.
4. **Request Body on GET/HEAD/OPTIONS** - These HTTP methods must not define a `requestBody` (Azure APIM discards them).
5. **URL Path Length** - API paths must be less than 128 characters.

### ⚠️ Warnings (best practices)

6. **HTTPS Server URLs** - Azure APIM prefers HTTPS URLs. If multiple servers are defined, it uses the first HTTPS URL found.
7. **Specification Size** - Specs over 4MB should be imported via URL rather than inline.

## Installation

### Prerequisites

- Python 3.7 or higher
- pip

### Install Dependencies

```bash
cd tools
pip install -r requirements.txt
```

## Usage

### Basic Usage

Validate a single OpenAPI specification:

```bash
python validate-apim-openapi.py ../scenarios/banking/rest/openapi/json/banking-2026-04-18.json
```

### Verbose Mode

Show warnings in addition to errors:

```bash
python validate-apim-openapi.py spec.yaml --verbose
```

### Validate Multiple Specs

```bash
python validate-apim-openapi.py spec1.yaml spec2.json spec3.yaml
```

### Validate All OpenAPI Specs in Repository

```bash
# JSON specs
python validate-apim-openapi.py ../scenarios/*/rest/openapi/json/*.json

# YAML specs
python validate-apim-openapi.py ../scenarios/*/rest/openapi/yaml/*.yaml

# All specs
python validate-apim-openapi.py ../scenarios/*/rest/openapi/**/*.{json,yaml,yml}
```

## Exit Codes

- `0` - All validations passed
- `1` - One or more validations failed
- `2` - Invalid arguments or file errors

This makes it easy to integrate into CI/CD pipelines:

```bash
python validate-apim-openapi.py spec.yaml
if [ $? -ne 0 ]; then
  echo "Validation failed!"
  exit 1
fi
```

## Example Output

### ✅ Successful Validation

```
================================================================================
Azure APIM OpenAPI Validation Results
================================================================================
File: banking-2026-04-18.json
================================================================================

✅ All validations passed! Specification is compatible with Azure APIM.
```

### ❌ Failed Validation

```
================================================================================
Azure APIM OpenAPI Validation Results
================================================================================
File: example-api.yaml
================================================================================

❌ ERRORS (3):

  [ERROR] parameter-uniqueness - paths./users/{id}.get: Parameter name 'userId' appears multiple times (case-insensitive) in locations: path, query. Azure APIM requires parameter names to be unique across path, query, and header.
  [ERROR] request-body-not-allowed - paths./search.get: GET operation must not have a requestBody. Azure APIM discards request body parameters for GET, HEAD, and OPTIONS.
  [ERROR] external-ref - paths./users.post.requestBody.content.application/json.schema.$ref: External $ref not allowed: './schemas/user.yaml#/User'. All references must be internal (start with '#/')

❌ Validation failed with 3 error(s).
```

## Integration with CI/CD

### GitHub Actions

Add a step to your workflow to validate OpenAPI specs:

```yaml
- name: Validate OpenAPI specs for Azure APIM compatibility
  run: |
    cd tools
    pip install -r requirements.txt
    python validate-apim-openapi.py ../scenarios/*/rest/openapi/**/*.{json,yaml,yml}
```

### Azure DevOps

```yaml
- script: |
    cd tools
    pip install -r requirements.txt
    python validate-apim-openapi.py ../scenarios/**/openapi/**/*.json
  displayName: 'Validate OpenAPI Specs'
```

## Development

### Running Tests

Test against the existing specs in the repository:

```bash
python validate-apim-openapi.py ../scenarios/banking/rest/openapi/json/banking-2026-04-18.json --verbose
```

### Making the Script Executable

```bash
chmod +x validate-apim-openapi.py
./validate-apim-openapi.py spec.yaml
```

## References

- [Azure APIM OpenAPI Import Restrictions](https://learn.microsoft.com/en-us/azure/api-management/api-management-api-import-restrictions)
- [OpenAPI 3.0.3 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Azure API Management Documentation](https://learn.microsoft.com/en-us/azure/api-management/)

## License

MIT
