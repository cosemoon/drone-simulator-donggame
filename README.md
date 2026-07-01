# Drone Simulator Donggame

브라우저에서 실행하는 3D 드론 시뮬레이션 게임입니다. PC 키보드와 태블릿 가로 모드 터치 스틱을 지원하고, PWA로 설치해 태블릿 홈 화면에서 앱처럼 실행할 수 있습니다.

온라인 점수판은 별도 저장소로 분리했습니다.

```text
https://github.com/cosemoon/drone-simulator-donggame-online-scoreboard
```

## 로컬 실행

```bash
pnpm install
pnpm dev
```

기본 주소:

```text
http://127.0.0.1:5173/
```

## 태블릿 로컬 테스트

같은 Wi-Fi에서 컴퓨터를 서버처럼 열어 테스트할 때:

```bash
pnpm dev:lan
```

컴퓨터의 로컬 IP가 `192.168.0.23`이라면 태블릿 브라우저에서 아래 주소를 엽니다.

```text
http://192.168.0.23:5173/
```

## 태블릿에서 바로 실행

컴퓨터 IP 없이 쓰려면 이 게임 저장소를 Cloudflare Pages 같은 정적 호스팅에 배포합니다. 배포 URL을 태블릿에서 연 뒤 **홈 화면에 추가**하면 PWA 앱처럼 실행할 수 있습니다.

Cloudflare Pages 설정:

```text
Repository: cosemoon/drone-simulator-donggame
Production branch: main
Root directory: /
Framework preset: React (Vite)
Build command: pnpm build
Build output directory: dist
```

게임 사이트에는 D1 binding이나 `API_SECRET`이 필요 없습니다.

## 조작

- `W / S`: 상승 / 하강
- `A / D`: 좌우 회전
- `↑ / ↓`: 전진 / 후진
- `← / →`: 좌우 이동
- `C`: 카메라 전환
- `R`: 리셋
- `Esc` 또는 `P`: 일시정지

태블릿에서는 왼쪽 스틱이 스로틀/요우, 오른쪽 스틱이 피치/롤입니다.

## 검증

```bash
pnpm test
pnpm build
```
