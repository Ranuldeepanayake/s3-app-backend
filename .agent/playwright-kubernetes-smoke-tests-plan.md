<!-- Decision-complete plan for adding Playwright smoke tests to the Kubernetes dev deployment. -->
# Playwright Kubernetes smoke tests

## Summary

Add a small Playwright suite that checks the backend API and the real browser-to-frontend-to-backend path. Run it as a Kubernetes Job triggered by an Argo CD PostSync hook in the dev environment.

## Flow and changes

1. Add `@playwright/test` and an `e2e/` suite to the backend repository. Test `GET /`, `GET /api/version`, allowed and rejected CORS preflights, and a browser fetch from the deployed frontend to the API using an `Authorization` header. This exercises the browser preflight without logging in or changing data.
2. Build a separate, version-pinned Playwright runner image and push it to the existing backend ECR repository with a `-playwright` tag matching the backend build. Keep the browser-enabled runner separate from the application image.
3. Add a dev-only Argo CD PostSync Job to the Helm chart. After synced resources are healthy, the Job runs in namespace `s3-app-dev` and uses the deployed frontend and API ingress URLs. It needs no credentials and performs no database or S3 writes.
4. Add `https://dev.s3-app.ranul.click` to the dev `CORS_ALLOWED_ORIGINS` value. Update the build-and-deploy workflow to publish the runner image and set its tag in GitOps values.

## Acceptance and assumptions

- Run the Job after each dev Argo CD sync; leave QA and production unchanged.
- A passing Job completes the sync successfully. A failing Job fails the sync and retains its logs for diagnosis. It does not automatically roll back resources already applied.
- The dev namespace can reach `https://dev.s3-app.ranul.click` and `https://api.dev.s3-app.ranul.click` through ingress.
- The runner image and tests are versioned together.

## Resume checklist

- Add the Playwright dependency, configuration, and API/browser smoke tests in the backend repo.
- Build and publish the version-matched test-runner image from the GitHub workflow.
- Add the Argo CD PostSync Job and dev values in the Helm/GitOps repository.
- Allow the deployed dev frontend origin through the backend dev CORS configuration.
- Verify passing and intentionally failing Job behavior in the dev Argo CD sync.
