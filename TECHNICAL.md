# COINSTAC Technical Documentation

* [The Pieces](#the-pieces)
* [Consortia](#consortia)
* [Computations](#computations)
* [Database Structure](#database-structure)
* [Computation Lifecycle](#computation-lifecycle)
* [Authentication](#authentication)
* [Coding Standards](#coding-standards])

## The Pieces

COINSTAC is composed of many pieces stored in GitHub repositories. Here’s an overview:

### [coinstac-common](https://github.com/MRN-Code/coinstac-common)

* **Uses:**
* **Used by:** [coinstac-client-core](#coinstac-client-core), [coinstac-server-core](#coinstac-server-core)

Reusable pieces of COINSTAC shared by both the client and server.

* Models: contains shared structures for interacting with data. These also facilitate computations.
    * `Consortium`: Backs consortium documents in the “consortium” database
    * `LocalComputation`: Run a local computation on a client and save the result to a consortium’s “up” database
    * `RemoteComputation`: Run a remote computation on a server and save the result to a consortium’s “down” database:

        ```js
        // This retrieves an existing one
        const remoteComp = new RemoteComputation({
            consortium: 'my-consortium-id',
            runId: 100,
        });

        remoteComp.run();
        // Uses the DistributedComputation's `local`
        // => saves the result of myFunc to remoteComp._data

        const newRemoteComp = new RemoteComputation({ /* ... */
            computation: new DistributedComputation(/* huh */),
        });

        // Or, feed the `RemoteComputation` the doc from db?
        myPouchy.all()
            .then(docs => docs.map(d => new RemoteComputation(d)))
            .then(remoteComps => Promise.all(remoteComps.map(r => r.run())))
            .then(remoteComps => Promise.all(remoteComps.map(r => r.save())))
            .catch(console.error.bind(console));
        ```
    * `DistributedComputation`: Backs computation documents in the “computations” database
* Listeners: contains event emitters that listen to CouchDB databases for changes, and emit appropriate events. There's both remote and local stores. All clients (remote and local) will listen to databases for changes and make computations based on these changes.
* DB Registry: holds databases. This should keep PouchDB memory footprint low as there's only ever 1 reference to a database.
* Listener registry: similar idea to DB registry

### [coinstac-client-core](https://github.com/MRN-Code/coinstac-client-core)

* **Uses:** [coinstac-common](#coinstac-common)
* **Used by:** [coinstac-ui](#coinstac-ui)

Core library for running local computations on a client.

### [coinstac-distributed-algorithm-set](https://github.com/MRN-Code/coinstac-distributed-algorithm-set)

* **Uses:**
* **Used by:**

A set of useful functions for algorithms.

### [coinstac-server-core](https://github.com/MRN-Code/coinstac-server-core)

* **Uses:** [coinstac-common](#coinstac-common)
* **Used by:**

Core library for running remote computations on a server. It has two modes:

* **daemon:** Runs in the background on a server and manages the remote side of the [computation lifecycle](#computation-lifecycle).
* **require-able:** Runs the computation lifecycle programmatically.

### [coinstac-storage-proxy](https://github.com/MRN-Code/coinstac-storage-proxy)

* **Uses:** [coinstac-common](#coinstac-common)
* **Used by:** [nodeapi](#nodeapi)

Authentication plugin for [hapi](http://hapijs.com/) server. This ensures COINSTAC’s CouchDB databases are secure.

### [coinstac-ui](https://github.com/MRN-Code/coinstac-ui)

* **Uses:** [coinstac-client-core](#coinstac-client-core)
* **Used by:**

This is the Electron-based application that runs on OS X, Windows and Linux. It consumes coinstac-client-core and coinstac-common.

### [nodeapi](https://github.com/MRN-Code/nodeapi)

* **Uses:** [coinstac-storage-proxy](#coinstac-storage-proxy)
* **Used by:**

## Consortia

Consortia are COINSTAC’s high-level groups composed of researchers, scientists, analysts, etc. A consortium is centered around a particular interest.

## Computations

Computations are instructions for client-server interaction. Clients are referred to as “local” and the the server is referred to as “remote” in a computation. Researchers author computations in a specified format, and they are hosted as repositories on GitHub. Here’s an example:

```js
{
    name: 'barebones-multishot',
    version: '1.0.0',
    repository: {
        url: 'https://github.com/MRN-Code/barebones-multishot',
    },
    label: 'Barebones Multi-shot',
    description: 'This is a simple, iterative computation.',
    local: {
        type: 'function',
        fn: function(previousLocalResult, remoteResult, next) {
            if (typeof previousLocalResult === 'undefined') {
                previousLocalResult = Math.round(Math.random() * 10);
            }
            // Average previous and remote results
            return (previousLocalResult + remoteResult) / 2;
        },
    },
    remote: {
        type: 'function',
        fn: function(previousRemoteResult, localResults, next) {
            if (typeof previousRemoteResult === 'undefined') {
                previousRemoteResult = 0;
            }

            // Move on to next task if the remote value exceeds 30
            if (previousRemoteResult >= 30) {
                return next();
            }

            // Add all the local results
            return localResults.reduce((sum, n) => sum + n);
        },
    },
};
```

## Database Structure

A running COINSTAC system relies on [CouchDB](http://couchdb.apache.org/) for data storage and [Pouchy](https://www.npmjs.com/package/pouchy) for data reads and writes. CouchDB serves as a document store, and every document is backed by a model from [coinstac-common](#coinstac-common). There are **four** key databases:

### consortiameta

Contains “meta” documents for every consortium. Each document's `id` is the consortium ID, a key used to match “local” and “remote” database names. Each document in the database is backed by `Consortium` models.

```js
[
    // Consortium instance:
    {
        id: 'consortium1',
        usernames: ['user-1', 'user-2', 'user-3', /* ... */],
    },

    // Consortium instance:
    {
        id: 'consortium2',
        usernames: ['user-14', 'user-15', /* ... */],
    },

    // Consortium instance:
    {
        id: 'consortium3',
        // ...
    },

    // ...
```

### local

Contains local computation results. Database name follows `local-consortium-${consortiumId}`, where `consortiumId` is a consortium's unique numeric identifier. This database is backed by `LocalComputation` models. Calling `LocalComputation#save` (on an instance) synchronizes the computation's result to this database.

Saved local computation result documents have a few important items:

* **_id:** an identifier of the form `${runId}-${username}`. `runId` is a unique number that signifies a decentralized computation “run.” The `runId` is used as a key to match several local documents and a single remote document.
* **data:** an object/primitive that is the result of the computation.
* **timestamp** entry of when the data was saved
* **name:** name of the computation. UsedRequired for finding a particular computation’s local results when filtering
* **username:** The local computation’s client’s username. (This is also maintained in RemoteComputation’s `usernames` array.)
* **version:** version of the computation. Used in conjunction with **name** to look up a decentralized computation.

* local-consortium-1
    ```js
    // LocalComputation instance:
    {
        _id: '100-user-1',
        data: { /* ... */ },
        name: 'simple-computation',
        timestamp: // ...
        username: 'user-1',
        version: '1.0.0',
    }

    // LocalComputation instance:
    {
        _id: '100-user-2',
        data: { /* ... */ },
        name: 'simple-computation',
        timestamp: // ...
        username: 'user-2',
        version: '1.0.0',
    }

    // LocalComputation instance:
    {
        _id: '100-user-3',
        data: { /* ... */ },
        name: 'simple-computation',
        timestamp: // ...
        username: 'user-3',
        version: '1.0.0',
    }

    // LocalComputation instance:
    {
        _id: '101-user-4'
        data: { /* ... */ },
        name: 'other-computation',
        timestamp: // ...
        username: 'user-4',
        version: '0.5.1',
    }

    // ...
    ```
* local-consortium-2
    ```js
    // LocalComputation instance:
    {
        _id: '102-user-14',
        data: { /* ... */ },
        name: 'advanced-computation',
        timestamp: // ...
        username: 'user-15',
        version: '2.15.1',
    }

    // ...
    ```

### remote

Contains remote computation results. Database name follows `remote-consortium-${consortiumId}`, where `consortiumId` is a consortium's unique numeric identifier. This database is backed by `RemoteComputation` models. Calling `RemoteComputation#save` (on an instance) synchronizes the computation's results to this database.

Saved `RemoteComputation`s have a few important values:

* **_id:** This _is_ a computation instance’s `runId`. This links a remote document to clients’ local documents.
* **data:** result of running a remote computation
* **name:** name of the computation.
* **usernames:** Collection of all user names involved in computation instance.
* **version:** semver version number of computation.

* remote-consortium-1
    ```js
    // RemoteComputation instance:
    {
        _id: '100',
        data: { /* ... */ },
        name: 'simple-computation',
        usernames: ['user-1', 'user-2', 'user-3']
        version: '1.0.0',
    }

    // RemoteComputation instance:
    {
        _id: '101',
        data: { /* ... */ },
        name: 'other-computation',
        usernames: ['user-4', 'user-5']
        version: '1.0.0',
    }
    ```
* remote-consortium-2
    ```js
    // RemoteComputation instance:
    {
        _id: '102',
        data: { /* ... */ },
        name: 'advanced-computation',
        usernames: ['user-14', 'user-15', /* ... */ ],
        version: '2.0.1',
    }

    // ...
    ```

### computations

This database contains definitions for computations which are backed by `DistributedComputation` models. Computation documents look something like this:

* computations/[\_id]

    ```js
    // DistributedComputation instance:
    {
        name: 'simple-computation',
        version: '1.0.0',
        label: 'My Simple Computation',
        description: 'This is a really dumb, iterative computation.',
    }
    ```

    It’s important to note that CouchDB uses a `_id` attribute as a unique identifier. There can be several versions of the `simple-computation` computation: their `version` properties will be different.

## Computation Lifecycle

### Basic Example

Here’s how a basic computation work:

1. A consortium selects a computation from the list of computations in the _computations_ database. The consortium configures the computation with the usernames of clients that will run the computation.
2. The server seeds the remote computation document
3. All clients running the computation seed their local computation documents:

    ```
    +----------+                           +------------------+
    | Client 1 | - LocalComputation -----> |                  |
    +----------+        (async)            |                  |
                                           |       LOCAL      |
    +----------+                           |                  |
    | Client 2 | --- LocalComputation ---> |   Consortium’s   |
    +----------+          (async)          | “local” database |
                                           |                  |
    +----------+                           |                  |
    | Client 3 | ----- LocalComputation -> |                  |
    +----------+            (async)        +------------------+
    ```

4. The server sees when all the client’s `LocalComputation` documents have been uploaded. It then runs a remote computation:

    ```
    +------------------+
    |                  |                       +-------------+
    |       LOCAL      | - LocalComputation -> |   Server’s  |
    |                  | - LocalComputation -> |    remote   |
    |   Consortium’s   | - LocalComputation -> | computation |
    | “local” database |                       |   function  |
    |                  |                       +-------------+
    +------------------+                              |
                                              RemoteComputation
                                                      |
                                                      v
                                            +-------------------+
                                            |                   |
                                            |       REMOTE      |
                                            |                   |
                                            |    Consortium’s   |
                                            | “remote” database |
                                            |                   |
                                            +-------------------+
    ```

5. The clients see when the remote server adds a document to the “remote” database. Each client then runs its local computation:

    ```
              +-------------------+   
              |                   |
              |       REMOTE      |
              |                   |
              |    Consortium’s   |
              | “remote” database |
              |                   |
              +-------------------+
                        |
                RemoteComputation
              (clients get same doc)
                        |
         +--------------+--------------+
         |              |              |                   
         v              v              v
    +----------+   +----------+   +----------+
    | Client 1 |   | Client 2 |   | Client 3 |
    +----------+   +----------+   +----------+
    ```

6. The local and remote computers iterate between steps 3 through 5 until the remote machine deems the computation is done. Data flows in one direction, in a circular manner:

    ```
        +---------+                        +----------------+
        | Clients | - LocalComputations -> | LOCAL database |
        +---------+                        +----------------+
             ^                                      |
             |                              LocalComputations
     RemoteComputation                              |
             |                                      V
    +-----------------+                        +--------+
    | REMOTE database | <- RemoteComputation - | Server |
    +-----------------+                        +--------+
    ```

### Pipelines

Computations are pipelines. The basic example above has one pipeline element for both remote and client computers. In more robust cases, computations may contain multiple sub-computation functions that iterate and yield to the next sub-computation.

## Authentication

## Coding Standards

Each COINSTAC project uses [coins-validate](https://github.com/MRN-Code/coins-validate) to ensure consistent code style