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

## Architecture

<TODO>

## Demo Applications

Two demo applications are included in tscim, to both show examples of how to wire up tscim to multiple frameworks as well as how to synchronize data across SCIM applications.  It is recommended to run both applications together to see an example of the SCIM protocol in use between a client and server application.

To run, first make sure to build the tscim package via `pnpm build`.  Then, in separate terminal windows `cd` to the demo applications and run `pnpm start:dev`.

### Express demo

The application in demo/express shows how to wrap the tscim services to offer the SCIM API in a relatively simple Express.js application.  Initial fake data is added to make it easier to get going, particularly when also runnning the Nest.js application which uses the Express application as a SCIM server.  The Express app uses the SCIM data model directly, storing data in the in-memory resource adapter.

### Nest demo

The Nest.js application in demo/nest is a more complicated example.  The Nest application shows how to integrate tscim into an application with its own domain model backed by real storage (SQLite and Loki).  The Nest application also shows an example how to synchronize data, using the Express application as the SCIM server.

## Contributing

<TODO>

### Running the tests

<TODO>
