import { createHmac } from "crypto";

type RequestPayload = {
  request_id: string;
  target_user: string;
  permission: string;
  system: string;
  action: "GRANT_ACCESS";
  justification: string;
  access_duration_months?: 1 | 3 | 6 | 12;
  idempotency_key: string;
  actor: string;
};

function signPayload(payload: string) {
  const secret = process.env.N8N_HMAC_SECRET || "dev-hmac-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function sendRequestToN8N(payload: RequestPayload) {
  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) return { delivered: false, reason: "missing_webhook_url" };

  const body = JSON.stringify(payload);
  const signature = signPayload(body);

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`N8N webhook failed with status ${response.status}`);
  }

  return { delivered: true };
}
