const MAX_BODY_BYTES = 4096;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function unauthorized() {
  return json({ success: false, error: "unauthorized" }, 401);
}

function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function isAuthorized(request, env) {
  const secret = typeof env.API_SECRET === "string" ? env.API_SECRET.trim() : "";
  const header = request.headers.get("authorization") ?? "";

  if (!secret || !header.startsWith("Bearer ")) {
    return false;
  }

  return timingSafeEqual(header.slice("Bearer ".length).trim(), secret);
}

function isJsonRequest(request) {
  const type = request.headers.get("content-type") ?? "";
  return type.toLowerCase().split(";")[0].trim() === "application/json";
}

function normalizeText(value, minLength, maxLength, fieldName) {
  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string.` };
  }

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (/<[^>]*>/u.test(trimmed)) {
    return { error: `${fieldName} must not contain HTML tags.` };
  }

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return {
      error: `${fieldName} must be ${minLength}-${maxLength} characters.`,
    };
  }

  return { value: trimmed };
}

function normalizeScore(value) {
  if (!Number.isInteger(value) || value < 0 || value > 999999) {
    return { error: "score must be an integer between 0 and 999999." };
  }

  return { value };
}

async function parseBody(request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { error: "request body is too large." };
  }

  const bodyText = await request.text();

  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return { error: "request body is too large." };
  }

  try {
    return { value: JSON.parse(bodyText) };
  } catch {
    return { error: "request body must be valid JSON." };
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ success: false, error: "method not allowed" }, 405);
  }

  if (!isAuthorized(request, env)) {
    return unauthorized();
  }

  if (!isJsonRequest(request)) {
    return json(
      { success: false, error: "content-type must be application/json" },
      415,
    );
  }

  if (!env.DB) {
    return json({ success: false, error: "database binding is missing." }, 500);
  }

  // TODO: Add durable per-IP rate limiting if score submissions become public.
  const body = await parseBody(request);

  if (body.error) {
    return json({ success: false, error: body.error }, 400);
  }

  const nickname = normalizeText(body.value.nickname, 2, 20, "nickname");
  const school = normalizeText(body.value.school, 2, 30, "school");
  const score = normalizeScore(body.value.score);

  if (nickname.error || school.error || score.error) {
    return json(
      {
        success: false,
        error: nickname.error ?? school.error ?? score.error,
      },
      400,
    );
  }

  const existing = await env.DB.prepare(
    "SELECT id, best_score, updated_at FROM scores WHERE nickname = ? AND school = ?",
  )
    .bind(nickname.value, school.value)
    .first();

  if (!existing) {
    const updatedAt = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO scores (nickname, school, best_score, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(nickname.value, school.value, score.value, updatedAt)
      .run();

    return json({
      success: true,
      updated: true,
      item: {
        nickname: nickname.value,
        school: school.value,
        best_score: score.value,
        updated_at: updatedAt,
      },
    });
  }

  if (score.value <= existing.best_score) {
    return json({
      success: true,
      updated: false,
      item: {
        nickname: nickname.value,
        school: school.value,
        best_score: existing.best_score,
        updated_at: existing.updated_at,
      },
    });
  }

  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE scores SET best_score = ?, updated_at = ? WHERE id = ?",
  )
    .bind(score.value, updatedAt, existing.id)
    .run();

  return json({
    success: true,
    updated: true,
    item: {
      nickname: nickname.value,
      school: school.value,
      best_score: score.value,
      updated_at: updatedAt,
    },
  });
}
