const API_BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export function get(path) {
  return request(path);
}

export function post(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patch(path, body) {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function put(path, body) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function del(path) {
  return request(path, {
    method: "DELETE",
  });
}
