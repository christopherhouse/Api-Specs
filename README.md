# 📋 Api-Specs

A curated catalog of API specifications in multiple formats — ready to grab for demos, testing, and development.

## 🤔 What Is This?

Ever need a realistic API spec *right now*? Same. This repo is a living collection of enterprise-grade API specifications in various formats. Some are hand-crafted, others are generated with GitHub Copilot. All of them are designed to look and feel like real-world APIs.

## 📂 Repository Structure

The repository is organized by **business domain/scenario**, with each domain containing specs in all applicable formats:

```
Api-Specs/
├── scenarios/
│   ├── banking/
│   │   ├── README.md
│   │   ├── graphql/
│   │   ├── soap/
│   │   └── rest/
│   │       ├── openapi/
│   │       │   ├── json/
│   │       │   └── yaml/
│   │       ├── raml/
│   │       └── wadl/
│   ├── crm/
│   │   ├── README.md
│   │   ├── graphql/
│   │   ├── soap/
│   │   └── rest/
│   │       └── ...
│   └── [other domains...]
└── .github/
    ├── agents/           # Copilot agent for generating specs
    ├── prompts/          # Reusable prompts for spec generation
    ├── workflows/        # CI: lint on PR, lint + release on merge
    └── copilot-instructions.md
```

Each domain folder contains:
- **README.md** - Description of the domain and its API features
- **Spec files** organized by format type (REST, SOAP, GraphQL)


## 📑 Spec Formats

| Format | Style | Path Pattern | Use Case |
|--------|-------|--------------|----------|
| **OpenAPI 3.0** | REST | `scenarios/*/rest/openapi/json/` or `scenarios/*/rest/openapi/yaml/` | Modern REST API design, code generation, API gateways |
| **RAML 1.0** | REST | `scenarios/*/rest/raml/` | MuleSoft/Anypoint-based REST APIs, design-first workflows |
| **WADL** | REST (XML) | `scenarios/*/rest/wadl/` | Legacy REST service descriptions |
| **WSDL 1.1** | SOAP | `scenarios/*/soap/` | Enterprise SOAP services, WCF, Java WS |
| **GraphQL SDL** | GraphQL | `scenarios/*/graphql/` | Graph-based APIs, schema-first design, federation |


## 📛 Naming Convention

All spec files follow:

```
<api-name>-<YYYY-MM-DD>.<ext>
```

For example: `banking-2026-04-18.json`, `hr-2026-04-18.wsdl`, `procurement-2026-04-18.wadl`, `fleet-management-2026-04-20.raml`, `asset-management-2026-04-20.graphql`

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

# Or grab a single spec from a domain
curl -O https://raw.githubusercontent.com/christopherhouse/Api-Specs/main/scenarios/banking/rest/openapi/json/banking-2026-04-18.json
```

## 🧰 Adding a New Spec

1. Pick the right domain directory under `scenarios/` (e.g., `scenarios/banking/`, `scenarios/crm/`)
   - If the domain doesn't exist, create a new folder with a README.md describing the API
2. Place your spec in the appropriate format subdirectory (e.g., `rest/openapi/yaml/`, `soap/`, `graphql/`)
3. Name your file following the `<api-name>-<YYYY-MM-DD>.<ext>` convention
4. Open a PR — CI will lint your spec automatically
5. Merge and a new release gets cut 🎉

Or just ask the Copilot agent to generate one for you!

## 🗂️ Available Scenarios

Browse the domains in the `scenarios/` directory. Each domain folder contains a README with details:

| Domain | Description | Available Formats |
|--------|-------------|-------------------|
| **Asset Management** | Assets, categories, locations, work orders, audits | OpenAPI, WADL, WSDL, RAML, GraphQL |
| **Banking** | Retail banking — customers, accounts, transactions, beneficiaries, payments | OpenAPI, RAML, GraphQL |
| **Claims Management** | Insurance — policyholders, policies, claims, documents, adjusters, payouts | OpenAPI, RAML, GraphQL |
| **CRM** | Accounts, contacts, opportunities, activities, products, quotes | OpenAPI, WADL, WSDL, RAML, GraphQL |
| **Fleet Management** | Vehicles, drivers, trips, maintenance records, fuel logs | OpenAPI, WADL, WSDL, RAML, GraphQL |
| **Healthcare** | Patients, providers, appointments, prescriptions, medical records | OpenAPI, WADL, WSDL, RAML, GraphQL |
| **HR Service** | Employees, departments, leave requests | WSDL, RAML, GraphQL |
| **Procurement** | Vendors, contracts, requisitions, purchase orders, approvals, invoices | WADL, RAML, GraphQL |
| **Supply Chain** | Suppliers, products, warehouses, inventory, purchase orders, shipments | OpenAPI, RAML, GraphQL |

For detailed API features and file paths, check the README.md in each domain folder.

## 📄 License

[MIT](LICENSE)
