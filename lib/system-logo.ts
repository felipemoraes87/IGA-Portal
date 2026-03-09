export function resolveSystemThumb(systemName: string) {
  const normalized = systemName.toLowerCase();

  const brandThumbs: Array<{ keywords: string[]; src: string }> = [
    { keywords: ["aws", "amazon web services"], src: "/systems/brands/amazonaws.svg" },
    { keywords: ["gcp", "google cloud"], src: "/systems/brands/googlecloud.svg" },
    { keywords: ["google workspace", "google workspaces", "g.suite"], src: "/systems/brands/googleworkspace.svg" },
    { keywords: ["google"], src: "/systems/brands/google.svg" },
    { keywords: ["github"], src: "/systems/brands/github.svg" },
    { keywords: ["jira"], src: "/systems/brands/jira.svg" },
    { keywords: ["confluence"], src: "/systems/brands/confluence.svg" },
    { keywords: ["slack"], src: "/systems/brands/slack.svg" },
    { keywords: ["argocd"], src: "/systems/brands/argo.svg" },
    { keywords: ["atlassian"], src: "/systems/brands/atlassian.svg" },
    { keywords: ["launchdarkly"], src: "/systems/brands/launchdarkly.svg" },
    { keywords: ["new relic", "newrelic"], src: "/systems/brands/newrelic.svg" },
    { keywords: ["miro"], src: "/systems/brands/miro.svg" },
    { keywords: ["zendesk"], src: "/systems/brands/zendesk.svg" },
    { keywords: ["mongodb"], src: "/systems/brands/mongodb.svg" },
    { keywords: ["databricks"], src: "/systems/brands/databricks.svg" },
    { keywords: ["docker"], src: "/systems/brands/docker.svg" },
    { keywords: ["postman"], src: "/systems/brands/postman.svg" },
    { keywords: ["notion"], src: "/systems/brands/notion.svg" },
    { keywords: ["sonarqube"], src: "/systems/brands/sonarqube.svg" },
    { keywords: ["zabbix"], src: "/systems/brands/zabbix.svg" },
    { keywords: ["cloudflare", "waf"], src: "/systems/brands/cloudflare.svg" },
    { keywords: ["keycloak"], src: "/systems/brands/keycloak.svg" },
    { keywords: ["jenkins"], src: "/systems/brands/jenkins.svg" },
    { keywords: ["zapier"], src: "/systems/brands/zapier.svg" },
    { keywords: ["twilio"], src: "/systems/brands/twilio.svg" },
    { keywords: ["splunk"], src: "/systems/brands/splunk.svg" },
    { keywords: ["sentry"], src: "/systems/brands/sentry.svg" },
    { keywords: ["figma"], src: "/systems/brands/figma.svg" },
    { keywords: ["salesforce", "crm salesforce"], src: "/systems/brands/salesforce.svg" },
    { keywords: ["hubspot"], src: "/systems/brands/hubspot.svg" },
    { keywords: ["office 365", "microsoft"], src: "/systems/brands/microsoft.svg" },
    { keywords: ["visual studio code"], src: "/systems/brands/visualstudiocode.svg" },
    { keywords: ["jumpcloud"], src: "/systems/brands/jumpcloud.svg" },
  ];

  const matched = brandThumbs.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  if (matched) return matched.src;

  if (normalized.includes("gcp") || normalized.includes("google")) return "/systems/gcp.svg";
  if (normalized.includes("slack")) return "/systems/slack.svg";
  if (normalized.includes("github")) return "/systems/github.svg";
  if (normalized.includes("jira")) return "/systems/jira.svg";
  return "/systems/default.svg";
}
