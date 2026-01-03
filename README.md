# tscim - A Typescript library for implementing the SCIM protocol

tscim is a library that implements the core SCIM protocol, with hooks (called "adapters") for wiring up your own User and (optional) Group data stores.  tscim handles some of the trickier parts of the SCIM protocol, in particular filtering and patching.  Some demo applications are included to show the library used in action.

## Examples

<TODO: show how to install from npm>

### Example: Expose your domain model as SCIM

<TODO>

### Example: Interact with a remote SCIM server

<TODO>

### Example: Synchronize data

<TODO>

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
