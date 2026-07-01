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

function parseLimit(value) {
  const parsed = Number.parseInt(value ?? "100", 10);

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.min(100, Math.max(1, parsed));
}

function normalizeSchoolFilter(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed || /<[^>]*>/u.test(trimmed) || trimmed.length > 30) {
    return null;
  }

  return trimmed;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  if (!env.DB) {
    return json({ error: "database binding is missing." }, 500);
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const school = normalizeSchoolFilter(url.searchParams.get("school"));

  const statement = school
    ? env.DB.prepare(
        `SELECT nickname, school, best_score, updated_at
         FROM scores
         WHERE school = ?
         ORDER BY best_score DESC, updated_at ASC, id ASC
         LIMIT ?`,
      ).bind(school, limit)
    : env.DB.prepare(
        `SELECT nickname, school, best_score, updated_at
         FROM scores
         ORDER BY best_score DESC, updated_at ASC, id ASC
         LIMIT ?`,
      ).bind(limit);

  const result = await statement.all();
  const rows = result.results ?? [];

  return json({
    items: rows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      school: row.school,
      best_score: row.best_score,
      updated_at: row.updated_at,
    })),
  });
}
