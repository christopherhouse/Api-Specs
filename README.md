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

# Or grab a single spec
curl -O https://raw.githubusercontent.com/christopherhouse/Api-Specs/main/rest/openapi/banking-2026-04-18.json
```

## 🧰 Adding a New Spec

1. Pick the right directory based on format (`rest/openapi/`, `rest/raml/`, `rest/wadl/`, `soap/`, or `graphql/`)
2. Name your file following the `<api-name>-<YYYY-MM-DD>.<ext>` convention
3. Open a PR — CI will lint your spec automatically
4. Merge and a new release gets cut 🎉

Or just ask the Copilot agent to generate one for you!

## 🗂️ API Inventory

Current state of all spec files in the repository:

| API | Domain | Format | File |
|-----|--------|--------|------|
| Banking | Retail banking — customers, accounts, transactions, beneficiaries, payments | OpenAPI 3.0 (JSON) | [`rest/openapi/banking-2026-04-18.json`](rest/openapi/banking-2026-04-18.json) |
| Banking | Retail banking — customers, accounts, transactions, beneficiaries, payments | RAML 1.0 | [`rest/raml/banking-2026-04-18.raml`](rest/raml/banking-2026-04-18.raml) |
| Banking | Retail banking — customers, accounts, transactions, beneficiaries, payments | GraphQL SDL | [`graphql/banking-2026-04-19.graphql`](graphql/banking-2026-04-19.graphql) |
| Claims Management | Insurance — policyholders, policies, claims, documents, adjusters, payouts | OpenAPI 3.0 (YAML) | [`rest/openapi/claims-2026-04-18.yaml`](rest/openapi/claims-2026-04-18.yaml) |
| Claims Management | Insurance — policyholders, policies, claims, documents, adjusters, payouts | RAML 1.0 | [`rest/raml/claims-2026-04-18.raml`](rest/raml/claims-2026-04-18.raml) |
| Claims Management | Insurance — policyholders, policies, claims, documents, adjusters, payouts | GraphQL SDL | [`graphql/claims-2026-04-19.graphql`](graphql/claims-2026-04-19.graphql) |
| Supply Chain | Suppliers, products, warehouses, inventory, purchase orders, shipments | OpenAPI 3.0 (YAML) | [`rest/openapi/supply-chain-2026-04-18.yaml`](rest/openapi/supply-chain-2026-04-18.yaml) |
| Supply Chain | Suppliers, products, warehouses, inventory, purchase orders, shipments | RAML 1.0 | [`rest/raml/supply-chain-2026-04-18.raml`](rest/raml/supply-chain-2026-04-18.raml) |
| Supply Chain | Suppliers, products, warehouses, inventory, purchase orders, shipments | GraphQL SDL | [`graphql/supply-chain-2026-04-19.graphql`](graphql/supply-chain-2026-04-19.graphql) |
| HR Service | Employees, departments, leave requests | SOAP / WSDL 1.1 | [`soap/hr-2026-04-18.wsdl`](soap/hr-2026-04-18.wsdl) |
| HR Service | Employees, departments, leave requests | RAML 1.0 | [`rest/raml/hr-2026-04-18.raml`](rest/raml/hr-2026-04-18.raml) |
| HR Service | Employees, departments, leave requests | GraphQL SDL | [`graphql/hr-2026-04-19.graphql`](graphql/hr-2026-04-19.graphql) |
| Procurement | Vendors, contracts, requisitions, purchase orders, approvals, invoices | WADL | [`rest/wadl/procurement-2026-04-18.wadl`](rest/wadl/procurement-2026-04-18.wadl) |
| Procurement | Vendors, contracts, requisitions, purchase orders, approvals, invoices | RAML 1.0 | [`rest/raml/procurement-2026-04-18.raml`](rest/raml/procurement-2026-04-18.raml) |
| Procurement | Vendors, contracts, requisitions, purchase orders, approvals, invoices | GraphQL SDL | [`graphql/procurement-2026-04-19.graphql`](graphql/procurement-2026-04-19.graphql) |
| CRM | Accounts, contacts, opportunities, activities, products, quotes | OpenAPI 3.0 (YAML) | [`rest/openapi/crm-2026-04-19.yaml`](rest/openapi/crm-2026-04-19.yaml) |
| CRM | Accounts, contacts, opportunities, activities, products, quotes | WADL | [`rest/wadl/crm-2026-04-19.wadl`](rest/wadl/crm-2026-04-19.wadl) |
| CRM | Accounts, contacts, opportunities, activities, products, quotes | SOAP / WSDL 1.1 | [`soap/crm-2026-04-19.wsdl`](soap/crm-2026-04-19.wsdl) |
| CRM | Accounts, contacts, opportunities, activities, products, quotes | RAML 1.0 | [`rest/raml/crm-2026-04-19.raml`](rest/raml/crm-2026-04-19.raml) |
| CRM | Accounts, contacts, opportunities, activities, products, quotes | GraphQL SDL | [`graphql/crm-2026-04-19.graphql`](graphql/crm-2026-04-19.graphql) |
| Fleet Management | Vehicles, drivers, trips, maintenance records, fuel logs | OpenAPI 3.0 (YAML) | [`rest/openapi/fleet-management-2026-04-20.yaml`](rest/openapi/fleet-management-2026-04-20.yaml) |
| Fleet Management | Vehicles, drivers, trips, maintenance records, fuel logs | WADL | [`rest/wadl/fleet-management-2026-04-20.wadl`](rest/wadl/fleet-management-2026-04-20.wadl) |
| Fleet Management | Vehicles, drivers, trips, maintenance records, fuel logs | SOAP / WSDL 1.1 | [`soap/fleet-management-2026-04-20.wsdl`](soap/fleet-management-2026-04-20.wsdl) |
| Fleet Management | Vehicles, drivers, trips, maintenance records, fuel logs | RAML 1.0 | [`rest/raml/fleet-management-2026-04-20.raml`](rest/raml/fleet-management-2026-04-20.raml) |
| Fleet Management | Vehicles, drivers, trips, maintenance records, fuel logs | GraphQL SDL | [`graphql/fleet-management-2026-04-20.graphql`](graphql/fleet-management-2026-04-20.graphql) |
| Healthcare | Patients, providers, appointments, prescriptions, medical records | OpenAPI 3.0 (YAML) | [`rest/openapi/healthcare-2026-04-20.yaml`](rest/openapi/healthcare-2026-04-20.yaml) |
| Healthcare | Patients, providers, appointments, prescriptions, medical records | WADL | [`rest/wadl/healthcare-2026-04-20.wadl`](rest/wadl/healthcare-2026-04-20.wadl) |
| Healthcare | Patients, providers, appointments, prescriptions, medical records | SOAP / WSDL 1.1 | [`soap/healthcare-2026-04-20.wsdl`](soap/healthcare-2026-04-20.wsdl) |
| Healthcare | Patients, providers, appointments, prescriptions, medical records | RAML 1.0 | [`rest/raml/healthcare-2026-04-20.raml`](rest/raml/healthcare-2026-04-20.raml) |
| Healthcare | Patients, providers, appointments, prescriptions, medical records | GraphQL SDL | [`graphql/healthcare-2026-04-20.graphql`](graphql/healthcare-2026-04-20.graphql) |
| Asset Management | Assets, categories, locations, work orders, audits | OpenAPI 3.0 (YAML) | [`rest/openapi/asset-management-2026-04-20.yaml`](rest/openapi/asset-management-2026-04-20.yaml) |
| Asset Management | Assets, categories, locations, work orders, audits | WADL | [`rest/wadl/asset-management-2026-04-20.wadl`](rest/wadl/asset-management-2026-04-20.wadl) |
| Asset Management | Assets, categories, locations, work orders, audits | SOAP / WSDL 1.1 | [`soap/asset-management-2026-04-20.wsdl`](soap/asset-management-2026-04-20.wsdl) |
| Asset Management | Assets, categories, locations, work orders, audits | RAML 1.0 | [`rest/raml/asset-management-2026-04-20.raml`](rest/raml/asset-management-2026-04-20.raml) |
| Asset Management | Assets, categories, locations, work orders, audits | GraphQL SDL | [`graphql/asset-management-2026-04-20.graphql`](graphql/asset-management-2026-04-20.graphql) |

## 📄 License

[MIT](LICENSE)
