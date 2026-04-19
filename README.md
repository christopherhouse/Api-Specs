# 📋 Api-Specs

A curated catalog of API specifications in multiple formats — ready to grab for demos, testing, and development.

## 🤔 What Is This?

Ever need a realistic API spec *right now*? Same. This repo is a living collection of enterprise-grade API specifications in various formats. Some are hand-crafted, others are generated with GitHub Copilot. All of them are designed to look and feel like real-world APIs.

## 📂 Repository Structure

```
Api-Specs/
├── rest/
│   ├── openapi/          # OpenAPI 3.0 specs (.json, .yaml)
│   ├── wadl/             # WADL specs (.wadl)
│   └── raml/             # RAML 1.0 specs (.raml)
├── soap/
│   └── *.wsdl            # WSDL 1.1 specs
├── graphql/
│   └── *.graphql         # GraphQL SDL specs
└── .github/
    ├── agents/           # Copilot agent for generating specs
    ├── prompts/          # Reusable prompts for spec generation
    ├── workflows/        # CI: lint on PR, lint + release on merge
    └── copilot-instructions.md
```

## 📑 Spec Formats

| Format | Style | Location | Use Case |
|--------|-------|----------|----------|
| **OpenAPI 3.0** | REST | `rest/openapi/` | Modern REST API design, code generation, API gateways |
| **RAML 1.0** | REST | `rest/raml/` | MuleSoft/Anypoint-based REST APIs, design-first workflows |
| **WADL** | REST (XML) | `rest/wadl/` | Legacy REST service descriptions |
| **WSDL 1.1** | SOAP | `soap/` | Enterprise SOAP services, WCF, Java WS |
| **GraphQL SDL** | GraphQL | `graphql/` | Graph-based APIs, schema-first design, federation |

## 📛 Naming Convention

All spec files follow:

```
<api-name>-<YYYY-MM-DD>.<ext>
```

For example: `banking-2026-04-18.json`, `hr-2026-04-18.wsdl`, `procurement-2026-04-18.wadl`, `logistics-2026-04-18.raml`, `inventory-2026-04-19.graphql`

## 🤖 Generating Specs with Copilot

This repo is set up with Copilot agents and prompts to make generating new specs easy:

- **Agent** — `spec-generator` knows the repo conventions and can produce specs in any supported format
- **Prompts** — use the reusable prompts in `.github/prompts/` to quickly generate OpenAPI, WSDL, WADL, RAML, or GraphQL specs

Just tell Copilot what domain you want (e.g. *"Generate an OpenAPI spec for a patient scheduling API"* or *"Generate a GraphQL spec for an inventory management API"*) and it'll handle the rest.

## ✅ CI Pipeline

Every change goes through automated validation:

| Trigger | What Happens |
|---------|-------------|
| **Pull Request** | 🔍 Lints all specs — OpenAPI via [Spectral](https://github.com/stoplightio/spectral), RAML via [raml-cop](https://github.com/raml-org/raml-cop), GraphQL via [graphql-schema-linter](https://github.com/cjoudrey/graphql-schema-linter), WADL/WSDL via `xmllint` |
| **Merge to `main`** | 🔍 Lint + 📦 Package & publish a GitHub Release |

## 🚀 Using the Specs

**Grab individual files** directly from the repo, or **download a release** from the [Releases](../../releases) page to get everything packaged up.

```bash
# Clone the whole catalog
git clone https://github.com/christopherhouse/Api-Specs.git

# Or grab a single spec
curl -O https://raw.githubusercontent.com/christopherhouse/Api-Specs/main/rest/openapi/banking-2026-04-18.json
```

## 🧰 Adding a New Spec

1. Pick the right directory based on format (`rest/openapi/`, `rest/raml/`, `rest/wadl/`, `soap/`, or `graphql/`)
2. Name your file following the `<api-name>-<YYYY-MM-DD>.<ext>` convention
3. Open a PR — CI will lint your spec automatically
4. Merge and a new release gets cut 🎉

Or just ask the Copilot agent to generate one for you!

## 📄 License

[MIT](LICENSE)
