# tscim - A Typescript library for implementing the SCIM protocol

tscim is a library that implements the core SCIM protocol, with hooks (called "adapters") for wiring up your own User and (optional) Group data stores.  tscim handles some of the trickier parts of the SCIM protocol, in particular filtering and patching.  Some demo applications are included to show the library used in action.

SCIM RFCs:
- Core Schema: https://datatracker.ietf.org/doc/html/rfc7643
- Protocol: https://datatracker.ietf.org/doc/html/rfc7644

## Setup

<TODO: show how to install from npm>

See examples below for how to import the various classes and types, depending on what you are trying to build.

## Examples

### Example: Expose your domain model as SCIM

In order to expose Users and (optionally) Groups, you must first implement the `ResourceAdapter<TResource>` interface for each type.  Once these are implemented you can pass them into a new instance of the `ScimService` class.
```typescript
// TODO
```

### Example: Interact with a remote SCIM server

A class `ScimClient` is provided that allows an application to interact with a remote SCIM server.

```typescript
// TODO
```

### Example: Synchronize data

tscim includes some helper functions showing how to synchronize data across SCIM servers.  Generally you would have this point to a remote `ScimClient` and local `ScimService`, but there's nothing stopping you from using two `ScimClient` or two `ScimService` instances.

```typescript
// TODO
```

## Demo Applications

tscim does not directly include any utilities for adding SCIM API routes to your application, as there are any number of existing or home-grown HTTP frameworks.  Instead we include a set of demo applications in the repository which show what is involved in integrating into your own application.

Two demo applications are included in tscim, to both show examples of how to wire up tscim to multiple frameworks as well as how to synchronize data across SCIM applications.  It is recommended to run both applications together to see an example of the SCIM protocol in use between a client and server application.

To run, first make sure to build the tscim package via `pnpm build`.  Then, in separate terminal windows `cd` to the demo applications and run `pnpm start:dev`.

### Express demo

The application in demo/express shows how to wrap the tscim services to offer the SCIM API in a relatively simple Express.js application.  Initial fake data is added to make it easier to get going, particularly when also runnning the Nest.js application which uses the Express application as a SCIM server.  The Express app uses the SCIM data model directly, storing data in the in-memory resource adapter.

### Nest demo

The Nest.js application in demo/nest is a more complicated example.  The Nest application shows how to integrate tscim into an application with its own domain model backed by real storage (SQLite and Loki).  The Nest application also shows an example how to synchronize data, using the Express application as the SCIM server.

## Architecture

The tscim library is broken into 3 main sections:
- `scim`: The core SCIM API types (API, models, filter and patch DSLs, errors, etc)
- `app`: The application layer types (HTTP clients, SCIM adapters, services, etc)
- `parser`: A simple general purpose combinator parser, primarily used by the SCIM filtering DSL. Heavily inspired by Claudiu Ivan's [A Principled Approach to Querying Data
](https://www.claudiu-ivan.com/writing/search-dsl/) blog.

Every object in the SCIM data model exists as an interface.

The SCIM API is modeled as a set of nested interfaces:
- `ScimApi`: the root interface
  - `ResourcesApi`: the parent interface for interacting with SCIM resources (Users and Groups)
    - `ResourceApi<T extends Resource>`: a generic interface for managing a resource type
    - `BulkOperationsApi`: interface for generic bulk management of multiple resources
  - `ConfigApi`: the parent interface for interacting with the SCIM configuration endpoints
    - `ResourceTypeApi`: the resource types configuration API interface
    - `ServiceProvicer`: the service providers configuration API interface
    - `Schemas`: the schemas configuration API

To implement a SCIM server on top of your data model you will create a new instance of the `ScimService` class, as well as implement your own subclass of `ResourceAdapter` for Users and optionally Groups.

To interace with a remote SCIM service, you can create an instance of the `ScimClient` class.

Note that both the `ScimService` and `ScimClient` implement the same `ScimApi` interface.

## Contributing

The `pnpm` package manager is used for development, as well as Vitest for the main unit tests.

### Building

To build the library, run the `pnpm build` script in the root directly.

### Running the tests

Tests are included in the main tscim library, as well as in some of the demo applications. All of them will use the same command to run:
```bash

# Run all tests
pnpm test

# Run a single test
pnpm test filter-dsl.test

# Run all tests and watch
pnpn test-watch
```

### Type checking and linting

tscim and all demo applications include a typecheck command

```bash
# Run Typescript type checks
pnpm check
```

tscim and some demo applications include linting via eslint, which can also be run with typechecking

```bash
# Run linter
pnpm lint

# Run linter in fix mode
pnpm lint-fix

# type check and lint
pnpm lint-check
```