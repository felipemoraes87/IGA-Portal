# SESSION_KEY_POINTS.md

Key cross-project notes from the session relevant to `iga-portal`.

## Role in the ecosystem

- `iga-portal` remains the main source-of-truth candidate for IAM and IGA operational data.
- It was treated as the domain reference for any real IAM page inside the Security Tribe dashboards.

## Why it matters to the dashboards

- The Streamlit dashboard IAM page was designed to read data aligned with `IGA Portal`.
- The newer web dashboard also treats IAM as the first candidate for real integration, again using `iga-portal` as the reference.

## Practical implication

- If live IAM dashboards are prioritized, the first integration path should likely reuse:
  - existing domain concepts in `iga-portal`
  - BigQuery extracts or views aligned with `iga-portal`
  - existing operational ownership and audit semantics from this project

## Infra note from the session

- The shared workspace compose was reviewed and confirmed to contain:
  - `db`
  - `pgadmin`
  - `keycloak`
  - `sonarqube_db`
  - `sonarqube`
- A project-local infra copy was added under `iga-portal/infra` so the repository is easier to onboard and easier to find.
