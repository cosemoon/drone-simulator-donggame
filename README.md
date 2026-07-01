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

## 태블릿에서 바로 실행

태블릿 자체에서 Vite 개발 서버를 실행하는 방식은 아닙니다. 한 번 웹 주소로 접속한 뒤 홈 화면에 추가하면 PWA 앱처럼 실행할 수 있습니다.

같은 Wi-Fi에서 컴퓨터를 서버처럼 열어 테스트:

```bash
pnpm dev:lan
```

컴퓨터의 로컬 IP가 `192.168.0.23`이라면 태블릿 브라우저에서 아래 주소를 엽니다.

```text
http://192.168.0.23:5173/
```

실제 배포에서는 `pnpm build` 결과물을 정적 호스팅에 올린 뒤 태블릿에서 그 URL을 열고 **홈 화면에 추가**하세요. 앱은 설치형 PWA 설정과 서비스워커를 포함하므로, 최초 접속 후에는 홈 화면 아이콘에서 앱처럼 실행할 수 있습니다.

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
