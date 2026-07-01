# 교육용 게임 점수판

Cloudflare 무료 티어에 맞춘 단순 온라인 리더보드입니다. 게임 클라이언트는 닉네임, 학교, 점수를 제출하고, 점수판 페이지는 최고 점수 순위를 보여줍니다.

## 파일 구조

```text
leaderboard-v2/
  public/
    index.html
    styles.css
    app.js
  functions/
    api/
      leaderboard.js
      submit-score.js
  migrations/
    0001_create_scores.sql
  package.json
  wrangler.toml.example
  .dev.vars.example
  README.md
```

## 1. D1 데이터베이스 만들기

```bash
cd leaderboard-v2
npm install
npx wrangler login
npx wrangler d1 create educational-game-leaderboard
```

출력에 나오는 `database_id`를 복사합니다.

## 2. Wrangler 설정

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml`의 `database_id` 값을 실제 D1 database id로 교체합니다. D1 binding 이름은 코드에서 `DB`로 사용합니다.

## 3. SQL 마이그레이션 적용

로컬 개발 DB:

```bash
npx wrangler d1 migrations apply educational-game-leaderboard --local
```

원격 Cloudflare D1:

```bash
npx wrangler d1 migrations apply educational-game-leaderboard --remote
```

## 4. API Secret 설정

로컬 개발:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars`의 `API_SECRET`을 긴 랜덤 문자열로 바꿉니다.

Cloudflare Pages 배포 환경:

```bash
npx wrangler pages secret put API_SECRET
```

비밀키는 코드나 브라우저 공개 파일에 넣지 마세요.

## 5. 로컬 실행

```bash
npx wrangler pages dev public
```

브라우저에서 Wrangler가 표시하는 로컬 주소를 엽니다.

## 6. 배포

```bash
npx wrangler pages deploy public --project-name educational-game-leaderboard
```

Cloudflare Dashboard에서 Pages 프로젝트의 D1 binding이 `DB`로 연결되어 있는지 확인하세요.

## 7. 게임 클라이언트에서 점수 보내기

```bash
curl -X POST https://YOUR_DOMAIN/api/submit-score \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"민준","school":"하늘초","score":8400}'
```

응답 예시:

```json
{
  "success": true,
  "updated": true,
  "item": {
    "nickname": "민준",
    "school": "하늘초",
    "best_score": 8400,
    "updated_at": "2026-07-01T12:00:00.000Z"
  }
}
```

동일한 `nickname + school` 조합은 최고 점수만 저장합니다. 새 점수가 기존 점수보다 낮거나 같으면 기존 기록을 유지하고 `updated: false`를 반환합니다.

## API

### `POST /api/submit-score`

요청:

```json
{
  "nickname": "민준",
  "school": "하늘초",
  "score": 8400
}
```

검증:

- `nickname`: 2-20자
- `school`: 2-30자
- `score`: 0-999999 정수
- HTML 태그는 거부
- `Authorization: Bearer <API_SECRET>` 필수

### `GET /api/leaderboard`

쿼리:

- `limit`: 기본 100, 최대 100
- `school`: 선택 학교 필터

응답:

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

이 구현은 교육용 게임에 맞춘 간단한 보호 수준입니다. API secret을 공개 브라우저 게임 코드에 넣으면 누구나 볼 수 있습니다. 공개 클라이언트에서 직접 제출해야 한다면 Cloudflare Turnstile, 서버 측 검증, replay 방지, IP 기반 rate limiting을 추가하는 것이 좋습니다. 현재 `submit-score` 함수에는 rate limiting TODO가 남아 있습니다.
