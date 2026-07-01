# 교육용 게임 점수판

Cloudflare 무료 티어에 맞춘 단순 온라인 리더보드입니다. 게임 클라이언트나 운영자 도구가 플레이어의 닉네임, 학교, 점수를 제출하면 가장 높은 점수만 저장하고 순위를 표시합니다.

이 폴더만 Cloudflare Pages에 배포합니다. 드론 시뮬레이션 게임 본체는 Cloudflare에서 실행하지 않고 GitHub 다운로드 링크로만 제공합니다.

## 파일 구조

```text
leaderboard-v2/
  public/
    _headers
    index.html
    styles.css
    app.js
  functions/
    api/
      leaderboard.js
      submit-score.js
  migrations/
    0001_create_scores.sql
  CLOUDFLARE_GITHUB_DEPLOY.md
  package.json
  wrangler.toml.example
  .dev.vars.example
  README.md
```

## GitHub 연결 배포

Cloudflare Pages에서 GitHub 저장소를 연결할 때 아래처럼 설정합니다.

```text
Root directory: leaderboard-v2
Build command: npm run build
Build output directory: public
```

자세한 절차는 [Cloudflare GitHub 배포 가이드](./CLOUDFLARE_GITHUB_DEPLOY.md)를 보세요.

## 1. D1 데이터베이스 만들기

```bash
cd leaderboard-v2
npm install
npx wrangler login
npx wrangler d1 create educational-game-leaderboard
```

출력에 나온 `database_id`는 로컬 CLI 배포용 `wrangler.toml`을 만들 때만 사용합니다. Cloudflare Dashboard에서 GitHub 연결 배포를 쓸 때는 Pages 프로젝트의 D1 binding을 Dashboard에서 설정해도 됩니다.

## 2. SQL 마이그레이션 적용

원격 Cloudflare D1:

```bash
npx wrangler d1 migrations apply educational-game-leaderboard --remote
```

로컬 개발 DB:

```bash
npx wrangler d1 migrations apply educational-game-leaderboard --local
```

## 3. D1 Binding 설정

Cloudflare Dashboard에서 Pages 프로젝트로 이동한 뒤:

```text
Settings > Bindings > Add > D1 database
Variable name: DB
D1 database: educational-game-leaderboard
```

코드에서는 `context.env.DB`로 접근합니다. binding 이름은 반드시 `DB`여야 합니다.

## 4. API Secret 설정

로컬 개발:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars`의 `API_SECRET`을 긴 무작위 문자열로 바꿉니다. 이 파일은 GitHub에 커밋하지 않습니다.

Cloudflare Pages 배포 환경:

```bash
npx wrangler pages secret put API_SECRET
```

secret은 코드, 공개 HTML, GitHub README 예시의 실제 값으로 남기지 않습니다.

## 5. 로컬 실행

```bash
npm run dev
```

Wrangler가 출력하는 로컬 주소를 브라우저에서 엽니다.

## 6. 점수 제출 API

Endpoint:

```text
POST /api/submit-score
```

Request body:

```json
{
  "nickname": "민준",
  "school": "하늘초",
  "score": 8400
}
```

Validation:

- `nickname`: 2-20자
- `school`: 2-30자
- `score`: 0-999999 정수
- HTML 태그 거부
- `Content-Type: application/json` 필요
- `Authorization: Bearer <API_SECRET>` 필요

같은 `nickname + school` 조합은 최고 점수만 저장합니다. 새 점수가 기존 점수보다 낮거나 같으면 기존 기록을 유지하고 `updated: false`를 반환합니다.

운영자 PC나 서버에서만 테스트하세요.

```bash
curl -X POST https://YOUR_DOMAIN/api/submit-score \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"민준","school":"하늘초","score":8400}'
```

브라우저 게임 코드에 `YOUR_SECRET`을 넣으면 누구나 secret을 볼 수 있으므로 넣지 마세요.

## 7. 리더보드 API

Endpoint:

```text
GET /api/leaderboard
```

Query:

- `limit`: 기본 100, 최대 100
- `school`: 선택 학교 필터

Response:

```json
{
  "items": [
    {
      "rank": 1,
      "nickname": "민준",
      "school": "하늘초",
      "best_score": 8400,
      "updated_at": "2026-07-01T12:00:00.000Z"
    }
  ]
}
```

정렬은 `best_score DESC`, 동점이면 `updated_at ASC`, 그래도 같으면 `id ASC`입니다.

## 보안 메모

- 공개 사이트에는 점수 제출 secret이나 운영용 curl 예시를 노출하지 않습니다.
- API JSON 응답은 `no-store`, `nosniff`, `no-referrer` 헤더를 보냅니다.
- 정적 페이지는 `_headers`에서 CSP, frame-ancestors 차단, 권한 제한 헤더를 설정합니다.
- `submit-score`는 secret이 없거나 틀리면 401을 반환합니다.
- 현재 rate limiting은 Cloudflare 설정이나 추후 Durable Object/KV 기반 구현으로 추가하는 것이 좋습니다.
