'use strict';

const config = require('./config');
const common = require('coinstac-common');
const DBRegistry = require('coinstac-common').services.dbRegistry.DBRegistry;
DBRegistry.Pouchy.plugin(require('pouchdb-adapter-memory'));
const path = require('path');

const pouchDBServerConfig = config['pouch-db-server'];

/**
 * Get pool configuration.
 * @private
 *
 * @description utility to generate PipelineRunnerPool inputs, used by
 * compute client and compute servers
 *
 * @param {Object} params
 * @param {string} params.computationPath
 * @param {boolean} [params.isLocal=true]
 * @returns {Promise} Resolves to a PipelineRunnerPool
 */
module.exports = function getPoolConfig(params) {
  const computationPath = params.computationPath;
  const isLocal = ('isLocal' in params && typeof params.isLocal === 'boolean') ?
    params.isLocal :
    true;
  const computationDir = path.dirname(computationPath);

  const dbRegistry = common.services.dbRegistry({
    isLocal,
    isRemote: !isLocal,
    local: {
      pouchConfig: {
        adapter: 'memory',
      },
    },
    noURLPrefix: true, // disable db pre-fixing (e.g. no `up/`, `down/`)
    path: path.join(__dirname, '..', '.tmp'),
    remote: {
      db: {
        hostname: 'localhost',
        port: pouchDBServerConfig.port,
        protocol: 'http',
      },
      pouchConfig: {
        adapter: 'memory',
      },
    },
  });

  return Promise.all([
    computationDir,
    dbRegistry,
    common.services.computationRegistry({
      dbRegistry,
      isLocal,
      path: computationDir,
      registry: [],
    }),
  ]).then(([computationDir, dbRegistry, computationRegistry]) => {
    /* eslint-disable global-require */
    const computation = require(computationPath);
    /* eslint-enable global-require */

    const { name, version } = computation;
    const url = `https://github.com/MRN-Code/${name}`;

    computationRegistry._getComputationPath = () => computationDir;
    computationRegistry.registry.push({
      name,
      tags: [version],
      url,
    });
    computationRegistry._doAdd({
      definition: computation,
      name,
      url,
      version,
    });

    return { computationRegistry, dbRegistry };
  });
};