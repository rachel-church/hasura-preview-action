# hasura-preview-action
A GitHub action to create a Hasura preview app.

## Create or update a preview app

When the action runs it uses the [Hasura Cloud API](https://hasura.io/docs/2.0/api-reference/cloud-api-reference/) 
to attempt to retrieve an existing hasura app with the provided name. If an app does not exist, one is created.

If the app already exists, the environment variables are updated.

This action does not apply the migrations or metadata, it only creates the preview app.

```yml
on:
  pull_request

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
          hasuraEnv: |                        # env vars exposed to the Hasura instance
            HASURA_GRAPHQL_UNAUTHORIZED_ROLE=logged_out
            PG_DATABASE_URL=${{ secrets.DB_URL }}
        env:
          # Hasura Cloud access token to contact Hasura Cloud APIs
          HASURA_CLOUD_ACCESS_TOKEN: ${{ secrets.HASURA_CLOUD_ACCESS_TOKEN }}
```

## Delete an existing preview app

```yml
on:
  pull_request

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