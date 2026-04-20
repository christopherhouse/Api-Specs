#!/usr/bin/env python3
"""
Azure API Management OpenAPI Validator

Validates OpenAPI 3.0.0 and 3.0.1 specifications against Azure API Management import restrictions.

Based on: https://learn.microsoft.com/en-us/azure/api-management/api-management-api-import-restrictions

Exit codes:
  0 - All validations passed
  1 - One or more validations failed
  2 - Invalid arguments or file errors
"""

import sys
import json
import yaml
import argparse
import re
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from collections import defaultdict


class ValidationError:
    """Represents a validation error"""
    def __init__(self, rule: str, location: str, message: str, severity: str = "error"):
        self.rule = rule
        self.location = location
        self.message = message
        self.severity = severity

    def __str__(self):
        return f"[{self.severity.upper()}] {self.rule} - {self.location}: {self.message}"


class APIMOpenAPIValidator:
    """Validates OpenAPI specs against Azure APIM import restrictions"""

    def __init__(self, spec_path: Path):
        self.spec_path = spec_path
        self.spec: Dict[str, Any] = {}
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationError] = []

    def load_spec(self) -> bool:
        """Load and parse the OpenAPI specification"""
        try:
            with open(self.spec_path, 'r', encoding='utf-8') as f:
                if self.spec_path.suffix in ['.yaml', '.yml']:
                    self.spec = yaml.safe_load(f)
                elif self.spec_path.suffix == '.json':
                    self.spec = json.load(f)
                else:
                    print(f"Error: Unsupported file format '{self.spec_path.suffix}'. Expected .json, .yaml, or .yml", file=sys.stderr)
                    return False
            return True
        except Exception as e:
            print(f"Error loading spec: {e}", file=sys.stderr)
            return False

    def validate_openapi_version(self) -> None:
        """Validate that OpenAPI version is 3.0.0 or 3.0.1 (or 3.0.x)"""
        openapi_version = self.spec.get('openapi', '')

        if not openapi_version:
            self.errors.append(ValidationError(
                "openapi-version",
                "root",
                "Missing 'openapi' field in specification"
            ))
            return

        # Azure APIM supports OpenAPI 3.0.x but not 3.1.x for full compatibility
        if not openapi_version.startswith('3.0.'):
            self.errors.append(ValidationError(
                "openapi-version",
                "root.openapi",
                f"OpenAPI version '{openapi_version}' is not supported. Azure APIM requires 3.0.x (3.0.0, 3.0.1, 3.0.2, or 3.0.3). Version 3.1.x is import-only with limited support."
            ))

    def validate_external_refs(self) -> None:
        """Validate that all $ref pointers are internal (no external files)"""
        def check_refs(obj: Any, path: str = "root") -> None:
            if isinstance(obj, dict):
                for key, value in obj.items():
                    current_path = f"{path}.{key}"
                    if key == '$ref' and isinstance(value, str):
                        # Check if ref points to external file
                        if not value.startswith('#/'):
                            self.errors.append(ValidationError(
                                "external-ref",
                                current_path,
                                f"External $ref not allowed: '{value}'. All references must be internal (start with '#/')"
                            ))
                    else:
                        check_refs(value, current_path)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_refs(item, f"{path}[{i}]")

        check_refs(self.spec)

    def validate_parameter_uniqueness(self) -> None:
        """Validate that parameter names are unique (case-insensitive) across path, query, and header"""
        paths = self.spec.get('paths', {})

        for path_url, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue

            # Check each HTTP method
            for method in ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']:
                operation = path_item.get(method)
                if not operation or not isinstance(operation, dict):
                    continue

                parameters = operation.get('parameters', [])
                # Also include path-level parameters
                path_parameters = path_item.get('parameters', [])
                all_parameters = parameters + path_parameters

                # Resolve parameter references
                resolved_params = []
                for param in all_parameters:
                    if isinstance(param, dict):
                        if '$ref' in param:
                            # For simplicity, we'll just track the ref itself
                            # In a full implementation, we'd resolve these
                            resolved_params.append(param)
                        else:
                            resolved_params.append(param)

                # Track parameter names by normalized (lowercase) name
                param_names = defaultdict(list)
                for param in resolved_params:
                    if isinstance(param, dict) and 'name' in param:
                        param_name = param.get('name', '')
                        param_in = param.get('in', '')
                        normalized_name = param_name.lower()
                        param_names[normalized_name].append({
                            'name': param_name,
                            'in': param_in,
                            'location': f"paths.{path_url}.{method}.parameters"
                        })

                # Check for duplicates (case-insensitive)
                for normalized_name, params_list in param_names.items():
                    if len(params_list) > 1:
                        locations = [f"{p['in']}" for p in params_list]
                        self.errors.append(ValidationError(
                            "parameter-uniqueness",
                            f"paths.{path_url}.{method}",
                            f"Parameter name '{params_list[0]['name']}' appears multiple times (case-insensitive) in locations: {', '.join(locations)}. "
                            f"Azure APIM requires parameter names to be unique across path, query, and header."
                        ))

    def validate_request_body_on_get_head_options(self) -> None:
        """Validate that GET, HEAD, and OPTIONS operations do not have requestBody"""
        paths = self.spec.get('paths', {})

        for path_url, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue

            for method in ['get', 'head', 'options']:
                operation = path_item.get(method)
                if not operation or not isinstance(operation, dict):
                    continue

                if 'requestBody' in operation:
                    self.errors.append(ValidationError(
                        "request-body-not-allowed",
                        f"paths.{path_url}.{method}",
                        f"{method.upper()} operation must not have a requestBody. Azure APIM discards request body parameters for GET, HEAD, and OPTIONS."
                    ))

    def validate_url_path_length(self) -> None:
        """Validate that API URL paths are under 128 characters"""
        paths = self.spec.get('paths', {})

        for path_url in paths.keys():
            if len(path_url) >= 128:
                self.errors.append(ValidationError(
                    "url-path-length",
                    f"paths.{path_url}",
                    f"Path URL is {len(path_url)} characters long, exceeds maximum of 128 characters"
                ))

    def validate_servers(self) -> None:
        """Validate server URLs and provide warnings about HTTPS preference"""
        servers = self.spec.get('servers', [])

        if not servers:
            self.warnings.append(ValidationError(
                "servers-missing",
                "root.servers",
                "No servers defined. Consider adding at least one server URL.",
                severity="warning"
            ))
            return

        has_https = False
        for i, server in enumerate(servers):
            if isinstance(server, dict):
                url = server.get('url', '')
                if url.startswith('https://'):
                    has_https = True
                    break

        if not has_https:
            self.warnings.append(ValidationError(
                "servers-no-https",
                "root.servers",
                "No HTTPS server URL found. Azure APIM prefers HTTPS URLs.",
                severity="warning"
            ))

    def validate_spec_size(self) -> None:
        """Validate specification size (should be under 4MB when imported inline)"""
        file_size = self.spec_path.stat().st_size
        max_size = 4 * 1024 * 1024  # 4 MB

        if file_size >= max_size:
            self.warnings.append(ValidationError(
                "spec-size",
                "file",
                f"Specification file is {file_size / 1024 / 1024:.2f} MB, which exceeds the 4 MB limit for inline import. Consider importing via URL instead.",
                severity="warning"
            ))

    def run_all_validations(self) -> bool:
        """Run all validation checks"""
        if not self.load_spec():
            return False

        self.validate_openapi_version()
        self.validate_external_refs()
        self.validate_parameter_uniqueness()
        self.validate_request_body_on_get_head_options()
        self.validate_url_path_length()
        self.validate_servers()
        self.validate_spec_size()

        return len(self.errors) == 0

    def print_results(self, verbose: bool = False) -> None:
        """Print validation results"""
        print(f"\n{'='*80}")
        print(f"Azure APIM OpenAPI Validation Results")
        print(f"{'='*80}")
        print(f"File: {self.spec_path}")
        print(f"{'='*80}\n")

        if self.errors:
            print(f"❌ ERRORS ({len(self.errors)}):\n")
            for error in self.errors:
                print(f"  {error}")
            print()

        if self.warnings and verbose:
            print(f"⚠️  WARNINGS ({len(self.warnings)}):\n")
            for warning in self.warnings:
                print(f"  {warning}")
            print()

        if not self.errors and not self.warnings:
            print("✅ All validations passed! Specification is compatible with Azure APIM.\n")
        elif not self.errors and self.warnings:
            print(f"✅ No errors found. {len(self.warnings)} warning(s) (use --verbose to see warnings).\n")
        else:
            print(f"❌ Validation failed with {len(self.errors)} error(s).\n")


def main():
    parser = argparse.ArgumentParser(
        description='Validate OpenAPI 3.0.x specs against Azure API Management import restrictions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate a single spec
  python validate-apim-openapi.py spec.yaml

  # Validate with verbose output (shows warnings)
  python validate-apim-openapi.py spec.json --verbose

  # Validate multiple specs
  python validate-apim-openapi.py spec1.yaml spec2.json spec3.yaml

Exit codes:
  0 - All validations passed
  1 - One or more validations failed
  2 - Invalid arguments or file errors
        """
    )

    parser.add_argument(
        'specs',
        nargs='+',
        type=Path,
        help='Path(s) to OpenAPI specification file(s) (.json, .yaml, .yml)'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Show warnings in addition to errors'
    )

    args = parser.parse_args()

    overall_success = True
    total_specs = len(args.specs)

    for spec_path in args.specs:
        if not spec_path.exists():
            print(f"Error: File not found: {spec_path}", file=sys.stderr)
            overall_success = False
            continue

        validator = APIMOpenAPIValidator(spec_path)
        success = validator.run_all_validations()
        validator.print_results(verbose=args.verbose)

        if not success:
            overall_success = False

    if total_specs > 1:
        print(f"{'='*80}")
        print(f"Summary: Validated {total_specs} specification(s)")
        print(f"{'='*80}\n")

    sys.exit(0 if overall_success else 1)


if __name__ == '__main__':
    main()
