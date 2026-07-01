# Cloudflare 게임 배포 가이드

이 저장소는 드론 시뮬레이션 게임 전용입니다. Cloudflare에는 정적 게임 사이트만 배포합니다.

온라인 점수판은 별도 저장소에서 배포합니다.

```text
https://github.com/cosemoon/drone-simulator-donggame-online-scoreboard
```

## Pages 프로젝트 설정

Cloudflare Dashboard에서 **Workers & Pages > Create > Pages > Connect to Git**을 선택하고 아래처럼 설정합니다.

```text
Repository: cosemoon/drone-simulator-donggame
Production branch: main
Root directory: /
Framework preset: React (Vite)
Build command: pnpm build
Build output directory: dist
```

## 필요한 Cloudflare 설정

게임 사이트에는 아래 설정이 필요 없습니다.

```text
D1 binding: 필요 없음
API_SECRET: 필요 없음
Pages Functions: 필요 없음
```

게임 플레이 중 키보드/터치 입력, 드론 물리 계산, 3D 렌더링은 사용자 기기 안에서 처리됩니다. Cloudflare는 처음 접속할 때 정적 파일을 내려주는 역할만 합니다.

## 태블릿 설치

1. 태블릿에서 배포 URL을 엽니다.
2. 브라우저 메뉴에서 **홈 화면에 추가**를 선택합니다.
3. 홈 화면 아이콘으로 실행합니다.

PWA manifest와 service worker가 포함되어 있어 앱처럼 열 수 있습니다.
