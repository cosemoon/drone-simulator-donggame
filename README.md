# Drone Simulator Donggame

브라우저에서 실행하는 3D 드론 시뮬레이션 게임과 Cloudflare용 온라인 점수판 프로젝트입니다.

## 구성

- `src/`: 로컬에서 실행하는 3D 드론 시뮬레이터
- `leaderboard-v2/`: Cloudflare Pages + Pages Functions + D1 온라인 점수판

Cloudflare에는 `leaderboard-v2`만 배포합니다. 시뮬레이터 본체는 GitHub 다운로드 링크로만 제공하고, 점수판 사이트에서는 플레이 가능한 게임을 호스팅하지 않습니다.

## 로컬 시뮬레이터 실행

```bash
pnpm install
pnpm dev
```

기본 주소:

```text
http://127.0.0.1:5173/
```

## Cloudflare 온라인 점수판

GitHub 연결 배포 시 Pages 설정의 root directory를 반드시 `leaderboard-v2`로 지정하세요.

자세한 배포 순서:

- [Cloudflare GitHub 배포 가이드](./leaderboard-v2/CLOUDFLARE_GITHUB_DEPLOY.md)
- [점수판 README](./leaderboard-v2/README.md)

## 보안 원칙

- `API_SECRET`은 Cloudflare Pages secret/environment variable로만 설정합니다.
- `.dev.vars`, 실제 `wrangler.toml`, Cloudflare API token은 GitHub에 커밋하지 않습니다.
- 브라우저에서 실행되는 시뮬레이터 코드에는 점수 제출 secret을 넣지 않습니다.

## 검증

```bash
pnpm test
pnpm build
cd leaderboard-v2
npm run check
```
