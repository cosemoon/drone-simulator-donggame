# Cloudflare GitHub 배포 가이드

이 프로젝트는 Cloudflare에 **온라인 점수판만** 배포합니다. 드론 시뮬레이터 본체는 GitHub 다운로드 링크로만 제공하고, Cloudflare Pages에는 플레이 가능한 시뮬레이터를 올리지 않습니다.

## 배포 구조

- GitHub 저장소: `cosemoon/drone-simulator-donggame`
- Cloudflare Pages 루트 디렉터리: `leaderboard-v2`
- 공개 정적 파일: `leaderboard-v2/public`
- API Functions: `leaderboard-v2/functions`
- D1 마이그레이션: `leaderboard-v2/migrations`
- 시뮬레이터 다운로드: GitHub ZIP 또는 GitHub Releases

## Cloudflare Pages 설정

Cloudflare Dashboard에서 Pages 프로젝트를 만들 때 GitHub 저장소를 연결하고 아래처럼 설정합니다.

```text
Production branch: main
Root directory: leaderboard-v2
Framework preset: None
Build command: npm run build
Build output directory: public
```

빌드 명령은 실제 번들링을 하지 않고 설정 확인용으로만 성공합니다. 이 점수판은 `public` 폴더의 정적 파일과 Pages Functions로 동작합니다.

Cloudflare 공식 문서 기준으로, monorepo처럼 저장소 안에 여러 프로젝트가 있을 때는 Pages의 root directory를 지정해야 합니다. 여기서는 반드시 `leaderboard-v2`로 지정하세요.

## D1 데이터베이스

로컬에서 Wrangler로 D1을 만들고 마이그레이션을 적용합니다.

```bash
cd leaderboard-v2
npm install
npx wrangler login
npx wrangler d1 create educational-game-leaderboard
npx wrangler d1 migrations apply educational-game-leaderboard --remote
```

Cloudflare Dashboard에서 Pages 프로젝트로 이동한 뒤:

```text
Settings > Bindings > Add > D1 database
Variable name: DB
D1 database: educational-game-leaderboard
```

변경 후 Pages 프로젝트를 다시 배포해야 binding이 적용됩니다.

## API Secret

`API_SECRET`은 GitHub 저장소, 브라우저 코드, `wrangler.toml`에 넣지 않습니다. Cloudflare Pages 환경 변수/secret으로만 설정합니다.

```bash
cd leaderboard-v2
npx wrangler pages secret put API_SECRET
```

권장값은 32자 이상의 무작위 문자열입니다.

PowerShell 예시:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## 보안 체크리스트

- Cloudflare Pages root directory가 `leaderboard-v2`인지 확인합니다.
- `API_SECRET`은 Cloudflare에만 저장하고 GitHub에는 커밋하지 않습니다.
- `.dev.vars`, `.wrangler`, 실제 `wrangler.toml`은 커밋하지 않습니다.
- D1 binding 이름은 코드와 동일하게 `DB`를 사용합니다.
- 공개 점수판 페이지에는 제출 secret이나 운영용 curl 예시를 노출하지 않습니다.
- 게임 클라이언트가 브라우저에서 직접 `POST /api/submit-score`를 호출해야 한다면 `API_SECRET`이 노출되므로, 별도 서버 프록시나 Turnstile 같은 추가 검증을 붙인 뒤 공개 제출 구조로 바꿔야 합니다.

## 점수 제출 테스트

운영자 PC나 서버에서만 아래처럼 테스트합니다.

```bash
curl -X POST https://YOUR_DOMAIN/api/submit-score \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"민준","school":"하늘초","score":8400}'
```

브라우저에 공개되는 시뮬레이터 코드에는 `YOUR_SECRET`을 넣지 마세요.
