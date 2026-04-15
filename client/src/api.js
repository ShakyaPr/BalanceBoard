export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "/api";

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed.");
  }

  return data;
}

export function fetchDashboard() {
  return request("/dashboard");
}

export function fetchAnalytics() {
  return request("/analytics");
}

export function fetchCardDetails(cardId) {
  return request(`/cards/${cardId}`);
}

export function recordStatementPayment(statementId, amount) {
  return request(`/statements/${statementId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}
