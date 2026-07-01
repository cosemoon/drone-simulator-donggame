# Cloudflare 게임 배포 가이드

이 저장소는 드론 시뮬레이터 게임 전용입니다. Cloudflare에는 정적 게임 사이트만 배포합니다.

온라인 점수판은 별도 저장소에서 배포합니다.

```text
https://github.com/cosemoon/drone-simulator-donggame-online-scoreboard
```

## 1. Pages 프로젝트 설정

Cloudflare Dashboard에서 **Workers & Pages > Create > Pages > Connect to Git**를 선택하고 아래처럼 설정합니다.

```text
Repository: cosemoon/drone-simulator-donggame
Production branch: main
Root directory: /
Framework preset: React (Vite)
Build command: pnpm build
Build output directory: dist
```

## 2. 필요한 Cloudflare 설정

게임 사이트 자체에는 아래 설정이 필요 없습니다.

```text
D1 binding: 필요 없음
API_SECRET: 필요 없음
Pages Functions: 필요 없음
```

드론 조작, 물리 계산, 3D 렌더링은 접속한 기기 안에서 처리됩니다. Cloudflare는 정적 파일을 처음 내려주는 역할만 합니다.

## 3. 온라인 점수판 연결

온라인 점수 제출을 켜려면 게임 Pages 프로젝트에 환경 변수를 추가합니다.

```text
Settings > Variables and Secrets > Add
Variable name: VITE_SCOREBOARD_API_BASE_URL
Type: Text
Value: https://YOUR_SCOREBOARD_DOMAIN
```

`YOUR_SCOREBOARD_DOMAIN`에는 점수판 저장소를 배포한 Cloudflare Pages 주소를 넣습니다. 이 값은 공개 URL이므로 Secret이 아니라 Text로 설정합니다.

게임은 완주 후 사용자가 `최고점 제출` 버튼을 누를 때만 점수판 API로 기록을 보냅니다.

## 4. 태블릿 설치

1. 태블릿에서 게임 배포 URL을 엽니다.
2. 브라우저 메뉴에서 **홈 화면에 추가**를 선택합니다.
3. 홈 화면 아이콘으로 실행합니다.

PWA manifest와 service worker가 포함되어 있어 태블릿에서 앱처럼 열 수 있습니다.
