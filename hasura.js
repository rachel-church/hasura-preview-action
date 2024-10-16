// @ts-check

/**
 * @typedef {Object} GraphQLError
 * @property {string} message - The error message returned from the GraphQL query.
 * @property {Array<{ line: number; column: number }>} [locations] - The locations of the errors in the GraphQL query.
 * @property {Array<string | number>} [path] - The path to the field that caused the error.
 * @example
 * {
 *   "message": "Name for character with ID 1002 could not be fetched.",
 *   "locations": [ { "line": 6, "column": 7 } ],
 *   "path": [ "hero", "heroFriends", 1, "name" ]
 * }
 */
/**
 * @typedef {Object} HasuraTenant
 * @property {string} id - The unique identifier of the tenant.
 * @property {string} slug - The slug of the tenant.
 * @property {Object} config - The configuration object of the tenant.
 * @property {string} config.hash - The hash of the tenant's configuration.
 * @property {Object} project - The project associated with the tenant.
 * @property {string} project.id - The unique identifier of the project.
 * @property {string} project.name - The project name.
 * @property {string} project.endpoint - The endpoint of the project.
 */

/**
 * Makes a GraphQL request to the Hasura endpoint.
 *
 * @param {string} query - The GraphQL query string.
 * @param {Object} variables - The variables for the GraphQL query.
 * @returns {Promise<Object>} The data returned from the GraphQL request.
 * @throws {Error | GraphQLError} If the HASURA_CLOUD_ACCESS_TOKEN is not set or if the request fails.
 */
async function makeHasuraGraphqlRequest(query, variables) {
  const accessToken = process.env.HASURA_CLOUD_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("HASURA_CLOUD_ACCESS_TOKEN is not set");
  }

  // Dynamically import node-fetch
  const fetch = (await import("node-fetch")).default;
  const response = await fetch("https://data.pro.hasura.io/v1/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `pat ${accessToken}`,
    },
    body: JSON.stringify({
      query,
      variables: variables || {},
    }),
  });

  /**
   * @typedef {Object} GraphQLResponse
   * @property {Record<string, unknown>} [data] - The data returned from the GraphQL query.
   * @property {unknown} [errors] - Any errors returned from the GraphQL query.
   */
  // Destructure the JSON response from the GraphQL endpoint.
  const { data, errors } = /** @type {GraphQLResponse} */ (
    await response.json()
  );

  if (errors) {
    console.error("Failed to send graphql request to hasura", query, {
      variables,
      errors,
    });

    throw errors[0];
  }

  return data;
}

/**
 * @param {string} name
 * @returns {Promise<undefined | HasuraTenant>}>}
 */
async function getProjectByName(name) {
  const getProjectByNameQuery = `
    query getProjectByName($name: String!) {
      tenant(where: {project: {name: {_eq: $name}}}, limit: 1) {
        id
        slug
        config {
          hash
        }
        project {
          id
          name
          endpoint
        }
      }
    }
  `;

  const { tenant: [tenant] = [] } = await makeHasuraGraphqlRequest(
    getProjectByNameQuery,
    { name },
  );

  return tenant;
}

/**
 * Get the environment variables of a hasura tenant/project.
 * @param {string} tenantId
 * @returns {Promise<{ hash: string; envVars: Record<string, string> }>}
 */
async function getTenantEnv(tenantId) {
  const getTenantEnvQuery = `
    query getTenantEnv($tenantId: uuid!) {
      getTenantEnv(tenantId: $tenantId) {
        hash
        envVars
      }
    }
  `;

  const { getTenantEnv: tenantEnvResults } = await makeHasuraGraphqlRequest(
    getTenantEnvQuery,
    { tenantId },
  );

  return tenantEnvResults;
}

/**
 * Update the environment variables of a hasura tenant/project.
 * @param {string} tenantId
 * @param {string} hash
 * @param {Array<{key: string; value: string;}>} envs
 * @returns {Promise<{ hash: string; envVars: Record<string, string> }>}
 */
async function updateTenantEnv(tenantId, hash, envs) {
  const updateTenantEnvQuery = `
    mutation updateTenantEnv($tenantId: uuid!, $hash: String!, $envs: [UpdateEnvObject!]!) {
      updateTenantEnv(tenantId: $tenantId, currentHash: $hash, envs: $envs) {
        hash
        envVars
      }
    }
  `;

  const { updateTenantEnv: tenantEnvResults } = await makeHasuraGraphqlRequest(
    updateTenantEnvQuery,
    {
      tenantId,
      hash,
      envs,
    },
  );

  return tenantEnvResults;
}

/**
 * @param {string} name
 * @param {undefined | Array<{key: string; value: string;}>} envs
 * @returns {Promise<HasuraTenant>}>}
 */
async function createProject(name, envs) {
  const createProjectQuery = `
    mutation createProject($name: String!, $envs: [UpdateEnvsObject]) {
      createTenant(name: $name, envs: $envs, cloud: "aws", region: "us-west-1") {
        tenant {
          id
          slug
          config {
            hash
          }
          project {
            id
            name
            endpoint
          }
        }
      }
    }
    `;
  const { createTenant: { tenant } = {} } = await makeHasuraGraphqlRequest(
    createProjectQuery,
    {
      name,
      envs,
    },
  );

  // hasura's createTenant mutation does not set the project name correctly
  const setProjectNameQuery = `
    mutation setProjectName($name: String!, $projectId: uuid!) {
      update_projects_by_pk(pk_columns: { id: $projectId }, _set: { name: $name }) {
        id
        name
        endpoint
      }
    }
    `;
  const { update_projects_by_pk: project } = await makeHasuraGraphqlRequest(
    setProjectNameQuery,
    {
      name,
      projectId: tenant.project.id,
    },
  );

  return {
    ...tenant,
    project,
  };
}

/**
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
async function deleteProject(tenantId) {
  const createProjectQuery = `
    mutation deleteProject($tenantId: uuid!) {
      deleteTenant(tenantId: $tenantId) {
        status
      }
    }
    `;
  await makeHasuraGraphqlRequest(createProjectQuery, { tenantId });
}

/**
 * Generate a random admin token.
 */
async function generateRandomAdminToken() {
  return require("crypto")
    .randomBytes(30)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 30);
}

/**
 * Parse the raw environment variables string and return an array of key-value pairs.
 * Copied from https://github.com/hasura/hasura-cloud-preview-apps/blob/2a4cf135eaee71f3c5a17f0c29e42d459b6349d3/src/parameters.ts#L25-L44
 * @param {string} rawEnvVars
 * @returns {Array<{key: string; value: string;}>}
 */
const parseEnvVars = (rawEnvVars) =>
  rawEnvVars
    .trim()
    .split("\n")
    .map((rawEnvVar) => {
      const envMetadata = rawEnvVar.trim().split(";");
      if (envMetadata.length > 0) {
        const [key, value = "", ...rest] = envMetadata[0].trim().split("=");
        return {
          key,
          value: value + (rest.length > 0 ? `=${rest.join("=")}` : ""),
        };
      }
      return {
        key: "",
        value: "",
      };
    })
    .filter((env) => !!env.key);

module.exports = {
  makeHasuraGraphqlRequest,
  getProjectByName,
  updateTenantEnv,
  createProject,
  deleteProject,
  generateRandomAdminToken,
  parseEnvVars,
  getTenantEnv,
};
