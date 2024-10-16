# hasura-preview-action

A GitHub action to create a Hasura preview app.

## Inputs

| Name          | Description                                                                                                                                                           | Required | Default |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `name`        | Name of the preview app.                                                                                                                                              | `true`   |         |
| `hasuraEnv`   | Set of environment variables to provide to the created preview app. Example: `HASURA_GRAPHQL_JWT_SECRET`, `PG_DATABASE_URL`. These differ from the action's env vars. | `false`  |         |
| `delete`      | Set to `true` when using this action on a pull request close event to delete the preview app with the given name.                                                     | `false`  | `false` |
| `adminSecret` | The admin secret for the Hasura GraphQL Engine. If not provided, one will be created.                                                                                 | `false`  |         |

## Outputs

| Name              | Description                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `cloudUrl`        | Cloud URL of the created preview app. Example: `https://my-preview-app.hasura.app`                   |
| `graphQLEndpoint` | GraphQL endpoint of the created preview app. Example: `https://my-preview-app.hasura.app/v1/graphql` |
| `consoleURL`      | Console URL of the created preview app. Example: `https://cloud.hasura.io/projects/my-preview-app`   |
| `projectName`     | Name of the created preview app                                                                      |
| `projectId`       | Project ID of the created preview app                                                                |
| `adminSecret`     | The admin secret for the Hasura GraphQL Engine                                                       |

## Authenticating with Hasura Cloud

The action expects a [Hasura cloud personal access token](https://hasura.io/docs/2.0/api-reference/cloud-api-reference/#authentication) 
to be available as a `HASURA_CLOUD_ACCESS_TOKEN` environment variable.

## Create or update a preview app

When the action runs it uses the [Hasura Cloud API](https://hasura.io/docs/2.0/api-reference/cloud-api-reference/)
to attempt to retrieve an existing hasura app with the provided name. If an app does not exist, one is created.

If the app already exists, the environment variables are updated.

This action does not apply the migrations or metadata, it only creates the preview app.

```yml
on: pull_request

jobs:
  create_hasura_preview:
    name: Create Hasura Preview App
    outputs:
      # Cloud URL of the created preview app. ex: https://my-preview-app.hasura.app
      hasura_cloud_url: ${{ steps.create_preview_app.outputs.cloudUrl }}
      # Console URL of the created preview app. ex: https://cloud.hasura.io/projects/my-preview-app
      hasura_console_url: ${{ steps.create_preview_app.outputs.consoleURL }}
      # Project ID of the created preview app
      hasura_project_id: ${{ steps.create_preview_app.outputs.projectId }}
    if: |
      github.event_name == 'pull_request' &&
      (github.event.action == 'synchronize' || github.event.action == 'opened' || github.event.action == 'reopened')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rachel-church/hasura-preview-action@main
        id: create_preview_app
        with:
          name: pr-${{ github.event.number }} # name of the preview app to created
          hasuraEnv: | # env vars exposed to the Hasura instance
            HASURA_GRAPHQL_UNAUTHORIZED_ROLE=logged_out
            PG_DATABASE_URL=${{ secrets.DB_URL }}
        env:
          # Hasura Cloud access token to contact Hasura Cloud APIs
          HASURA_CLOUD_ACCESS_TOKEN: ${{ secrets.HASURA_CLOUD_ACCESS_TOKEN }}
```

## Delete an existing preview app

```yml
on: pull_request

jobs:
  delete_hasura_preview:
    name: Delete Hasura Preview App
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rachel-church/hasura-preview-action@main
        id: create_preview_app
        with:
          name: pr-${{ github.event.number }} # name of the preview app to delete
          delete: true
        env:
          HASURA_CLOUD_ACCESS_TOKEN: ${{ secrets.HASURA_CLOUD_ACCESS_TOKEN }}
```

## Usage with NeonDB and applying migrations

This example shows how to create a Neon DB branch and uses the hasura CLI to apply metadata and migrations.

```yml
on: pull_request

jobs:
  create_hasura_preview:
    name: Create Hasura Preview App
    outputs:
      # Cloud URL of the created preview app. ex: https://my-preview-app.hasura.app
      hasura_cloud_url: ${{ steps.create_preview_app.outputs.cloudUrl }}
      # Console URL of the created preview app. ex: https://cloud.hasura.io/projects/my-preview-app
      hasura_console_url: ${{ steps.create_preview_app.outputs.consoleURL }}
      # Project ID of the created preview app
      hasura_project_id: ${{ steps.create_preview_app.outputs.projectId }}
    if: |
      github.event_name == 'pull_request' &&
      (github.event.action == 'synchronize' || github.event.action == 'opened' || github.event.action == 'reopened')
    runs-on: ubuntu-latest
    env:
      PREVIEW_APP_NAME: pr-${{ github.event.number }}
    steps:
      - uses: actions/checkout@v4
      - name: Create Neon Branch
        id: create_neon_branch
        uses: neondatabase/create-branch-action@v5
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          username: ${{ vars.NEON_USERNAME }}
          database: ${{ vars.NEON_DATABASE_NAME }}
          branch_name: ${{ env.PREVIEW_APP_NAME}}
          api_key: ${{ secrets.NEON_API_KEY }}
      - name: Reset Neon Branch
        # Run when there is a new commit pushed to an existing pull request.
        if: github.event_name == 'pull_request' && github.event.action == 'synchronize'
        uses: neondatabase/reset-branch-action@v1
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          parent: true
          branch: ${{ env.PREVIEW_APP_NAME }}
          api_key: ${{ secrets.NEON_API_KEY }}
      - uses: rachel-church/hasura-preview-action@main
        id: create_preview_app
        with:
          name: ${{ env.PREVIEW_APP_NAME}}
          # NOTE: The PG_DATABASE_URL will not be used to connect to the database until after the metadata is applied.
          hasuraEnv: |
            HASURA_GRAPHQL_UNAUTHORIZED_ROLE=logged_out
            PG_DATABASE_URL=${{ steps.create_neon_branch.outputs.db_url }}
        env:
          HASURA_CLOUD_ACCESS_TOKEN: ${{ secrets.HASURA_CLOUD_ACCESS_TOKEN }}
      - name: Install Hasura CLI
        run: curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
      - name: Apply Hasura Metadata
        working-directory: ./apps/hasura
        env:
          HASURA_GRAPHQL_ENDPOINT: ${{ steps.create_preview_app.outputs.cloudUrl }}
          HASURA_GRAPHQL_ADMIN_SECRET: ${{ steps.create_preview_app.outputs.adminSecret }}
        run: hasura metadata apply --endpoint $HASURA_GRAPHQL_ENDPOINT --admin-secret $HASURA_GRAPHQL_ADMIN_SECRET
      # NOTE: At this point we have a clean branch of our Neon DB and a Hasura Cloud instance pointing to it.
      # Ideally, we could now just run the migrations and be done. However, unlike a hasura-engine instance we self-host,
      # the Hasura Cloud stores the DB migration tracking in its own internal dedicated databases. If you look at the neon branch,
      # the hdb_catalog.schema_migrations does not exist. This mean that if we try and apply the migrations, ones that have already
      # applied will be re-applied and will fail. The next few steps are a workaround to this issue.
      # See https://github.com/hasura/graphql-engine/issues/7610 for the related GitHub issue.
      - name: Checkout the base ref of the pull request
        uses: actions/checkout@v4
        with:
          ref: ${{ github.base_ref || github.ref }}
      - name: Mark Existing Migrations as Applied
        working-directory: ./apps/hasura
        env:
          HASURA_GRAPHQL_ENDPOINT: ${{ steps.create_preview_app.outputs.cloudUrl }}
          HASURA_GRAPHQL_ADMIN_SECRET: ${{ steps.create_preview_app.outputs.adminSecret }}
        # Inform Hasura Cloud that the migrations have already been applied to the DB.
        # First, clear any existing migration history. Then mark migrations that existed at the time of the PR creation as already applied.
        run: |
          hasura migrate delete --all --server --endpoint $HASURA_GRAPHQL_ENDPOINT --admin-secret $HASURA_GRAPHQL_ADMIN_SECRET --database-name greenline
          hasura migrate apply --skip-execution --up all --endpoint $HASURA_GRAPHQL_ENDPOINT --admin-secret $HASURA_GRAPHQL_ADMIN_SECRET --database-name greenline
      # Now we attempt to apply any of the latest changes from the current PR.
      - uses: actions/checkout@v4
      - name: Apply Hasura Migrations
        uses: "./.github/actions/hasura-migration-apply"
        with:
          hasura_endpoint: ${{ steps.create_preview_app.outputs.cloudUrl }}
          hasura_graphql_admin_secret: ${{ steps.create_preview_app.outputs.adminSecret }}
```
