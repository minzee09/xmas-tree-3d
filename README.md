# xmas-tree-3d

three.js로 만든 3D 크리스마스 트리입니다. Cloudflare Workers에 두 가지 버전으로 배포합니다.

| 폴더 | 내용 | 주소 |
| --- | --- | --- |
| `lite/` | 트리만 있는 버전 | https://xmas-tree-lite.minzee.workers.dev |
| `guestbook/` | 방명록이 있는 버전 (글 하나가 오너먼트 하나로 트리에 달림) | https://xmas-tree.minzee.workers.dev |

## 기능

- 입자 1만여 개로 그린 트리, 따라 흐르는 전구, 회전하는 별, 내리는 눈, 블룸 효과
- 드래그해서 회전, 스크롤·핀치로 확대, 빈 곳을 누르면 불꽃
- 트리 밑 선물을 누르면 뚜껑이 열리고 빛이 트리를 타고 올라감
- 오르골 BGM: 저작권이 끝난 캐럴 3곡을 Web Audio로 직접 연주 (음원 파일 없음)
- **선물 뽑기**: 선물 개수(2~20)와 당첨 개수를 정하면 선물이 떨어져 섞이고, 하나씩 열어 당첨/꽝 확인. 당첨되면 순록이 튀어나와 화면에 눈뭉치를 던짐
- **방명록** (`guestbook/`만): 이름·메시지·색을 남기면 오너먼트가 날아와 트리에 달림. 쓴 사람은 같은 브라우저에서 자기 글을 지울 수 있음

## 폴더 구조

```
shared/            두 사이트가 같이 쓰는 코드
  css/base.css
  js/
    app.js         진입점: 장면 구성, 포인터 입력, 프레임 루프
    stage.js       렌더러·카메라·조명·블룸
    tree.js        트리(잎·전구·반짝이·별·장식볼)
    ground.js      바닥과 장식 선물
    snow.js        눈
    burst.js       불꽃·색종이 입자
    wave.js        트리를 타고 오르는 빛
    music.js       BGM과 효과음, 음악 버튼
    draw.js        선물 뽑기
    ambush.js      당첨 시 눈뭉치 던지는 순록
    reindeer.js    순록 SVG
    gift.js        선물 상자 모델
    loop.js        기능끼리 연결하는 훅(프레임·탭·호버), 트리 회전
    config.js      상수
lite/              트리만 있는 사이트
guestbook/         방명록 사이트
  guestbook.js     방명록 UI와 오너먼트
  worker/index.js  /api/entries API (Cloudflare Worker + D1)
  schema.sql
scripts/build.mjs  사이트별로 dist/<사이트>/ 에 파일을 모음
```

빌드 도구 없이 브라우저의 ES 모듈을 그대로 씁니다. three.js(r147)는 CDN에서 불러옵니다. `npm run build`는 `shared/`와 사이트 파일을 `dist/lite/`, `dist/guestbook/`으로 복사만 합니다.

## 로컬에서 실행

Node.js 18 이상이 필요합니다.

```bash
npm install
npm run dev:lite        # http://localhost:8787
```

방명록 버전은 로컬 DB를 한 번 만들고 실행합니다.

```bash
npm run db:init:local
npm run dev:guestbook
```

코드를 고치면서 보려면 다른 터미널에서 `npm run watch`를 켜 두세요. 저장할 때마다 `dist/`가 다시 만들어집니다.

## 배포

### 명령어로 배포

```bash
npx wrangler login      # 처음 한 번
npm run deploy:lite
npm run deploy:guestbook
```

### GitHub에 푸시하면 자동 배포 (Cloudflare Workers Builds)

한 레포에 사이트가 둘이어도 됩니다. Cloudflare 대시보드에서 Worker마다 이 레포를 연결하고 아래처럼 설정합니다.

| 설정 | `xmas-tree-lite` | `xmas-tree` |
| --- | --- | --- |
| Root directory | `/` | `/` |
| Build command | `npm run build -- lite` | `npm run build -- guestbook` |
| Deploy command | `npx wrangler deploy -c lite/wrangler.jsonc` | `npx wrangler deploy -c guestbook/wrangler.jsonc` |
| Build watch paths | `shared/*`, `lite/*` | `shared/*`, `guestbook/*` |

Build watch paths를 설정하면 `lite/`만 바꿨을 때 방명록 사이트는 다시 배포되지 않습니다.

### 방명록 DB를 직접 만들 때 (포크한 경우)

```bash
npx wrangler d1 create xmas-guestbook
```

출력된 `database_id`를 `guestbook/wrangler.jsonc`에 넣고 테이블을 만듭니다.

```bash
npm run db:init
```

방명록 글은 D1에 저장되므로 다시 배포해도 지워지지 않습니다.

## 방명록 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/entries` | 최근 500개 |
| POST | `/api/entries` | `{ name, msg, color }` 저장. 응답의 `token`으로 나중에 삭제 |
| DELETE | `/api/entries/:id` | `x-delete-token` 헤더 필요 |

- 같은 IP에서 1분에 3개까지 쓸 수 있고, 전체 3,000개까지 저장합니다.
- IP와 삭제 토큰은 SHA-256 해시로만 저장합니다.
