# Drone Simulator Donggame

브라우저에서 실행하는 3D 드론 시뮬레이션 게임입니다. PC 키보드와 태블릿 가로 모드 터치 스틱을 지원하고, PWA로 설치해 태블릿 홈 화면에서 바로 실행할 수 있습니다.

온라인 점수판은 별도 저장소에서 배포합니다.

```text
https://github.com/cosemoon/drone-simulator-donggame-online-scoreboard
```

## Local Run

```bash
pnpm install
pnpm dev
```

기본 주소:

```text
http://127.0.0.1:5173/
```

## Tablet Local Test

같은 Wi-Fi에서 컴퓨터를 서버처럼 열어 테스트하려면:

```bash
pnpm dev:lan
```

컴퓨터 IP가 `192.168.0.23`이면 태블릿 브라우저에서 아래 주소를 엽니다.

```text
http://192.168.0.23:5173/
```

## Tablet Without Computer IP

컴퓨터 IP 없이 바로 실행하려면 게임 저장소를 Cloudflare Pages 같은 정적 호스팅에 배포합니다. 배포 URL을 태블릿에서 열고 브라우저 메뉴의 **홈 화면에 추가**를 누르면 PWA처럼 실행할 수 있습니다.

Cloudflare Pages 설정:

```text
Repository: cosemoon/drone-simulator-donggame
Production branch: main
Root directory: /
Framework preset: React (Vite)
Build command: pnpm build
Build output directory: dist
```

## Online Scoreboard Connection

완주 후 사용자가 `최고점 제출` 버튼을 눌렀을 때만 온라인 점수판으로 최고 기록을 보냅니다. 게임 사이트에는 D1 binding이나 `API_SECRET`이 필요 없습니다.

게임 사이트 Cloudflare Pages 환경 변수:

```text
Variable name: VITE_SCOREBOARD_API_BASE_URL
Type: Text
Value: https://YOUR_SCOREBOARD_DOMAIN
```

이 값이 없으면 게임은 로컬 기록만 저장하고 온라인 제출 버튼은 비활성 상태로 보입니다.

## Controls

- `W / S`: 상승 / 하강
- `A / D`: 기수 좌우 회전
- `↑ / ↓`: 전진 / 후진
- `← / →`: 좌우 이동
- `C`: 카메라 전환
- `R`: 리셋
- `Esc` 또는 `P`: 일시정지

태블릿에서는 왼쪽 스틱이 스로틀/요우, 오른쪽 스틱이 피치/롤입니다.

## Verification

```bash
pnpm test
pnpm build
```
