export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const form = body instanceof FormData;
  const file = body instanceof Blob;
  const response = await fetch("/api/v1" + path, {
    method,
    headers:
      method === "GET"
        ? {}
        : {
            "X-PersonalHub-Client": "1",
            ...(!form
              ? { "Content-Type": file ? body.type : "application/json" }
              : {}),
          },
    body:
      method === "GET"
        ? undefined
        : form || file
          ? body
          : JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ title: response.statusText }));
    throw new ApiError(response.status, problem.title);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function safeUrl(url: string | null | undefined): boolean {
  try {
    return !!url && ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
export function dateInZone(zone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
