export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string | null;
};

type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "Can’t reach WasteWise right now. Check that the backend is running, then try again.",
        0,
      );
    }
    throw error;
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message =
      response.status >= 500
        ? `WasteWise encountered a server error (HTTP ${response.status}). Check the backend logs and database health.`
        : `Request failed (HTTP ${response.status}).`;
    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body
    ) {
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        const details = body.detail.flatMap((item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          "msg" in item &&
          typeof item.msg === "string"
            ? [item.msg]
            : [],
        );
        if (details.length > 0) {
          message = details.join("; ");
        }
      }
    }
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export const authApi = {
  register(input: { name: string; email: string; password: string }) {
    return request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me(token: string) {
    return request<AuthUser>("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
