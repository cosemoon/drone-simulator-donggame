# Drone Simulator Donggame

브라우저에서 실행되는 3D 드론 시뮬레이션 게임입니다. PC 키보드와 태블릿 가로 모드 터치 스틱을 지원합니다.

## 로컬 실행

```bash
pnpm install
pnpm dev
```

기본 주소:

```text
http://127.0.0.1:5173/
```

## 주요 조작

- `W / S`: 상승 / 하강
- `A / D`: 좌우 회전
- `↑ / ↓`: 전진 / 후진
- `← / →`: 좌우 이동
- `C`: 카메라 전환
- `R`: 리셋
- `Esc` 또는 `P`: 일시정지

일시정지 메뉴에서 테마, 카메라, 호버링 보조를 변경할 수 있습니다.

## v2 온라인 점수판

Cloudflare Pages Functions + D1 기반 점수판은 [`leaderboard-v2`](./leaderboard-v2) 폴더에 있습니다.

자세한 배포 방법은 [`leaderboard-v2/README.md`](./leaderboard-v2/README.md)를 참고하세요.

## 검증

```bash
pnpm test
pnpm build
```
