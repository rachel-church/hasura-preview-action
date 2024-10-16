// @ts-check

const core = require("@actions/core");

const {
  getProjectByName,
  createProject,
  deleteProject,
  updateTenantEnv,
  parseEnvVars,
  getTenantEnv,
  generateRandomAdminToken,
} = require("./hasura");

async function main() {
  const name = core.getInput("name");
  const shouldDelete = core.getInput("delete") === "true" ? true : false;
  const hasuraEnvStr = core.getInput("hasuraEnv");
  const hasuraEnv = hasuraEnvStr ? parseEnvVars(hasuraEnvStr) : [];
  let hasuraAdminSecret = core.getInput("adminSecret");

  if (hasuraAdminSecret) {
    hasuraEnv["HASURA_GRAPHQL_ADMIN_SECRET"] = hasuraAdminSecret;
  }

  // TODO: Verify that the name is a valid project name using graphql validTenantName

  let tenant = await getProjectByName(name);
  /** @type {{ hash: string; envVars: Record<string, string> } | undefined} */
  let newTenantEnvs = undefined;

  if (tenant && shouldDelete) {
    await deleteProject(tenant.id);

    console.log(`Deleted project with name ${name}.`);
  } else if (!tenant && shouldDelete) {
    console.log(
      `Project with name "${name}" does not exist. Nothing to delete.`,
    );
    return;
  } else if (tenant) {
    console.debug(
      `Project with name "${name}" already exists. Updating env...`,
    );
    try {
      newTenantEnvs = await updateTenantEnv(
        tenant.id,
        tenant.config.hash,
        hasuraEnv,
      );
      console.log(
        `Project with name ${tenant.project.name} updated successfully.`,
      );
    } catch (error) {
      if (error.message === "nothing changed in config") {
        console.debug("No config changes detected. Skipping update.");
      } else {
        throw error;
      }
    }

    if (!newTenantEnvs) {
      newTenantEnvs = await getTenantEnv(tenant.id);
    }
  } else {
    console.debug(`Project with name "${name}" does not exist. Creating...`);
    if (!hasuraEnv["HASURA_GRAPHQL_ADMIN_SECRET"]) {
      hasuraEnv["HASURA_GRAPHQL_ADMIN_SECRET"] = generateRandomAdminToken();
    }
    tenant = await createProject(name, hasuraEnv);
    newTenantEnvs = await getTenantEnv(tenant.id);

    console.log(
      `Project with name "${tenant.project.name}" created successfully.`,
    );
  }

  const secret = newTenantEnvs?.envVars["HASURA_GRAPHQL_ADMIN_SECRET"];
  if (secret) {
    core.setSecret(secret);
  }

  const outputs = {
    cloudUrl: tenant.project.endpoint,
    graphQLEndpoint: new URL("/v1/graphql", tenant.project.endpoint).href,
    consoleURL: `https://cloud.hasura.io/project/${tenant.project.id}/console`,
    adminSecret: secret,
    projectName: tenant.project.name,
    projectId: tenant.project.id,
  };

  console.log({ outputs });

  // Set outputs for other workflow steps to use
  Object.entries(outputs).forEach(([key, value]) => {
    core.setOutput(key, value);
  });
}

main().catch((error) => core.setFailed(error));
