# Local Infra

Project-local infrastructure for `iga-portal`.

## What this stack starts

- `db`: PostgreSQL for the portal
- `pgadmin`: optional DB administration UI
- `keycloak`: local SSO realm import for `iga-portal`
- `sonarqube_db`: PostgreSQL backing SonarQube
- `sonarqube`: optional local code quality service

## Why this folder exists

The workspace already had a shared `docker-compose.yml` at `C:\Users\felipe\Python\docker-compose.yml`.
This folder makes the `iga-portal` repository self-contained and easier to onboard without depending on workspace-level infra conventions.

## How to run

```powershell
cd "C:\Users\felipe\Python\iga-portal\infra"
Copy-Item .env.example .env
docker compose up -d
```

## Main local endpoints

- Postgres: `localhost:5432`
- Keycloak: `http://localhost:8080`
- pgAdmin: `http://localhost:5050`
- SonarQube: `http://localhost:9000`
