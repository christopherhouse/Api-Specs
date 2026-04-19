# Generate GraphQL Spec

Generate a new GraphQL Schema Definition Language (SDL) specification for the requested API domain.

## Instructions

- Place the file in `graphql/` named `<api-name>-<YYYY-MM-DD>.graphql` (date in `YYYY-MM-DD` format).
- Use **GraphQL SDL** format only — no resolver implementations, no server boilerplate.
- Open the file with a `schema` block declaring the root operation types:
  ```graphql
  schema {
    query: Query
    mutation: Mutation
  }
  ```
  Add `subscription: Subscription` only when the domain warrants real-time events.
- Declare all custom scalars at the top of the file (e.g. `scalar DateTime`, `scalar UUID`, `scalar JSON`).
- Define a `Query` type with at least 5 fields:
  - At least two paginated list queries using connection/edge pattern (see below).
  - At least two single-item lookup queries (by ID or natural key).
  - At least one filtered or search query with meaningful arguments.
- Define a `Mutation` type with at minimum:
  - A `create` mutation accepting a typed `input` argument.
  - An `update` mutation accepting an ID and a typed `input` argument.
  - A `delete` mutation returning a confirmation payload.
- Use `"""triple-quoted docstrings"""` on every type, field, argument, input type, and enum value.
- Use `input` types for all mutation arguments and any complex query filters.
- Use `enum` types for fields with a bounded set of string values.
- Use `interface` or `union` types where multiple object types share common structure.
- Apply `@deprecated(reason: "Use <alternative> instead.")` on any superseded fields.
- Use non-null `!` deliberately:
  - Fields that are always present should be non-null.
  - Optional / nullable fields should omit `!`.
  - List fields should use `[Type!]!` for a non-null list of non-null items when appropriate.

## Pagination (Connection Pattern)

For every paginated list query, follow the Relay connection spec:

```graphql
type XxxConnection {
  edges: [XxxEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type XxxEdge {
  node: Xxx!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

Paginated queries should accept `first: Int`, `after: String`, `last: Int`, and `before: String` arguments.

## Quality Standards

- Generate **enterprise-grade** schemas — not toy examples.
- Use realistic field names, types, and enum values that reflect the domain.
- Include at least 6 object types beyond `Query`, `Mutation`, and connection/edge types.
- Every type and field must have a `"""docstring"""`.
- Include at least one `interface` or `union`.
- Include at least one `enum` with 3+ values.

## User Input

The user will provide the API domain (e.g. "inventory management", "patient scheduling", "financial transactions"). Generate a schema that reflects that domain with enterprise-grade realism.
