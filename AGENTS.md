# Property Peace agent instructions

## Azure access

- Hermes and Codex access this project's Azure resources through the Azure CLI installed and already authenticated inside the WSL distribution `Ubuntu`. Native Windows `az` is not the configured route.
- Run Azure CLI commands from PowerShell as: `wsl.exe -d Ubuntu -- bash -lc 'az <command>'`.
- Before relying on the session, verify it with: `wsl.exe -d Ubuntu -- bash -lc 'az account show --query "{subscription:name,subscriptionId:id,user:user.name,tenant:tenantId}" -o json'`.
- The expected subscription is `Brownstone Hub LLC`.
- Production Application Insights is `property-peace-api` in resource group `property-peace-rg`, with application ID `051d1e4f-9c56-4fa6-8c8c-6d089f1dd76b`.
- Query production telemetry with `az monitor app-insights query --app 051d1e4f-9c56-4fa6-8c8c-6d089f1dd76b --analytics-query "<KQL>" -o json` through the WSL command form above.
- Treat Azure access as read-only unless the user explicitly requests a mutation. Never print, persist, or expose access tokens, connection strings, refresh tokens, or other secrets.
- If the WSL Azure session is no longer authenticated, report that and ask the user to run `az login` inside WSL. Do not search for or substitute credentials from application configuration.
