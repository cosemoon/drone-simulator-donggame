import assert from "node:assert/strict";

import { onRequest as leaderboard } from "../functions/api/leaderboard.js";
import { onRequest as submitScore } from "../functions/api/submit-score.js";

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    const [nickname, school] = this.args;
    return (
      this.database.rows.find(
        (row) => row.nickname === nickname && row.school === school,
      ) ?? null
    );
  }

  async run() {
    if (this.sql.startsWith("INSERT")) {
      const [nickname, school, bestScore, updatedAt] = this.args;
      this.database.rows.push({
        id: this.database.nextId,
        nickname,
        school,
        best_score: bestScore,
        updated_at: updatedAt,
      });
      this.database.nextId += 1;
      return {};
    }

    if (this.sql.startsWith("UPDATE")) {
      const [bestScore, updatedAt, id] = this.args;
      const row = this.database.rows.find((item) => item.id === id);

      if (row) {
        row.best_score = bestScore;
        row.updated_at = updatedAt;
      }

      return {};
    }

    throw new Error(`Unsupported statement: ${this.sql}`);
  }

  async all() {
    const hasSchoolFilter = this.sql.includes("WHERE school = ?");
    const [school, limit] = hasSchoolFilter ? this.args : [null, this.args[0]];
    const rows = this.database.rows.filter((row) => !school || row.school === school);
    const sortedRows = [...rows]
      .sort((left, right) => {
        if (right.best_score !== left.best_score) {
          return right.best_score - left.best_score;
        }

        return left.updated_at.localeCompare(right.updated_at) || left.id - right.id;
      })
      .slice(0, limit);

    return { results: sortedRows };
  }
}

class FakeDatabase {
  rows = [];
  nextId = 1;

  prepare(sql) {
    return new FakeStatement(this, sql.trim());
  }
}

function postScore(body, headers = {}) {
  return new Request("https://scores.example/api/submit-score", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function readJson(response) {
  return response.json();
}

const env = {
  API_SECRET: "local-test-secret",
  DB: new FakeDatabase(),
};

let response = await submitScore({
  request: postScore({ nickname: "민준", school: "하늘초", score: 8400 }),
  env,
});
assert.equal(response.status, 401);

response = await submitScore({
  request: postScore(
    { nickname: "민준", school: "하늘초", score: 8400 },
    { authorization: "Bearer local-test-secret" },
  ),
  env,
});
assert.equal(response.status, 415);

response = await submitScore({
  request: postScore(
    { nickname: "민준", school: "하늘초", score: 8400 },
    {
      authorization: "Bearer local-test-secret",
      "content-type": "application/json",
    },
  ),
  env,
});
assert.equal(response.status, 200);
assert.equal((await readJson(response)).updated, true);

response = await submitScore({
  request: postScore(
    { nickname: "민준", school: "하늘초", score: 100 },
    {
      authorization: "Bearer local-test-secret",
      "content-type": "application/json",
    },
  ),
  env,
});
const lowerScore = await readJson(response);
assert.equal(lowerScore.updated, false);
assert.equal(lowerScore.item.best_score, 8400);

response = await leaderboard({
  request: new Request("https://scores.example/api/leaderboard"),
  env,
});
const leaderboardResult = await readJson(response);
assert.equal(response.status, 200);
assert.equal(leaderboardResult.items[0].rank, 1);
assert.equal(leaderboardResult.items[0].best_score, 8400);

console.log("leaderboard API smoke ok");
