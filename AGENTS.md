# 제주 중국인 관광객 수하물 플랫폼 — Codex 메인 오케스트레이션

문서 버전: 2.1 · 수정일: 2026-09-30 · 상태: 제품 코드 구현·로컬 검증, 원격 연동 검증 대기

## 1. 확정된 범위

- 이 프로젝트는 **중국인 개별 관광객 대상 제주 수하물 예약·배송 플랫폼** 한 가지를 만든다.
- 고객이 예약할 수 있는 수하물 노선은 숙소→공항, 공항→숙소, 숙소→숙소다. 판매 가능 노선·시간·호텔은 운영 설정으로 제어한다.
- 하나의 브랜드·도메인에서 고객 예약, 기사 배송, 호텔 인계, 운영 관리를 제공한다. 처음부터 다른 사업 영역의 사이트나 메뉴를 추가하지 않는다.
- 중국어 간체가 고객 기본 언어다. 한국어는 현장 직원·운영자와 국내 고객을 위해, 영어는 고객 대체 언어로 제공한다. 중국어 번체·일본어는 구조만 열어 둔다.
- 라이트/다크 토글과 시스템 설정 따르기를 제공한다.
- Vercel·Supabase 기반 웹앱 하나로 고객·직원 화면을 모두 제공한다. 직원은 PWA로 설치해 쓰고, 고객 채널은 위챗 미니프로그램(하이브리드)으로 확장한다. 네이티브 앱은 만들지 않는다.
- 사업자·운송 자격·보험·호텔 제휴·결제 계약은 준비됐다고 **개발상 가정**한다. 계약 번호나 실제 API 키를 임의 생성하지 않는다. 이 가정을 재확인하느라 기능 개발을 중단하지 않는다.
- 예산·인력·달력 기준 일정을 개발 선행 조건으로 두지 않는다. 기능의 의존성에 따라 단계별로 개발한다.
- 브랜드 고유명은 설정값이다. 임시 표시명 ‘제주 커넥트’를 사용해 개발하며 상표 확보를 주장하지 않는다.
- 이 디렉터리는 독립된 새 프로젝트다. 상위 `launchops-site`, `outputs`, `work`는 코드 변경 대상이 아니다.

## 2. 고객에게 제공할 가치

핵심 약속은 ‘짐을 맡긴 뒤 제주를 편하게 여행하고, 약속한 곳에서 정확한 짐을 돌려받는다’이다. 제품은 가격보다 먼저 이용 가능 여부·인계 마감·공항 수령 장소·분실/지연 대응을 이해할 수 있게 해야 한다.

모든 개발 판단은 다음 질문으로 확인한다: 중국인 관광객이 한국 전화번호 없이 예약 가능한가? 호텔 직원과 기사가 짐 하나하나를 정확히 인계할 수 있는가? 비행기 탑승에 맞춘 수령 시각을 지킬 수 있는가? 문제가 생기면 고객과 운영자가 현재 상태를 알 수 있는가?

## 3. 문서 지도

| 문서 | 기준 책임 | 관련 작업 |
|---|---|---|
| [01 제품·시장·범위](docs/01-product-brand-benchmark.md) | 경쟁 관찰, 고객 가치, 기능 ID, 단계 경계 | 새 기능의 범위 판단 |
| [02 화면·사용자 흐름](docs/02-information-architecture-journeys.md) | URL, 고객·호텔·기사·운영자 화면 | UI·예약 여정 |
| [03 디자인·다국어·테마](docs/03-design-i18n-theme-accessibility.md) | 중국어 우선 UX, 번역, 색·접근성 | 고객 노출 화면 |
| [04 시스템·연동](docs/04-architecture-integrations.md) | Vercel·Supabase·API·어댑터 | 서버·연동·앱 경계 |
| [05 데이터·권한](docs/05-data-auth-security.md) | 테이블, RLS, 비회원 소유권, 보존 | DB·인증·파일 |
| [06 예약·결제·정산](docs/06-booking-payments-settlement.md) | 견적, 슬롯, 결제·환불, 호텔 수수료 | 금액·용량·거래 |
| [07 물류·추적·운영](docs/07-logistics-tracking-operations.md) | QR, 인계, 배차, 사고·고객지원 | 현장 업무 |
| [08 중국 고객 유입·지표](docs/08-china-acquisition-analytics.md) | 호텔 QR, 중국어 검색·콘텐츠, 실험·분석 | 유입·성장 |
| [09 검증·배포·앱](docs/09-quality-deployment-mobile-release.md) | 테스트, 운영, PWA·위챗 미니프로그램 | 각 단계 완료 판정 |
| [10 시각 디자인 시안](docs/10-visual-design-reference.md) | 모바일 시안 기반 화면·토큰·문구 | 고객 화면 구현·검수 |
| [11 기능 구현 감사](docs/11-implementation-audit.md) | 구현·mock·실사용 검증 상태 구분 | 완료 주장·우선순위 판단 |

문서의 기준 충돌은 해당 책임 문서를 먼저 수정한다. 상태·데이터는 05~07, API는 04가 기준이다. URL·고객 행동은 02가 기준이다.

## 4. 구현 대상 구조

현재는 문서만 존재한다. 아래 경로는 코드 개발 때 생성한다.

```text
jeju-unified-platform/
  AGENTS.md
  docs/                         # 상세 구현 문서 9개
  apps/
    web/                        # 공개 예약 + 기사·호텔·운영 화면(PWA)
    wechat/                     # WeChat Mini Program 하이브리드 셸 (web-view + 결제 페이지)
  packages/
    contracts/                  # API 스키마·오류 코드
    domain/                     # 가격·예약·배송 상태
    integrations/               # PG·알림·지도·위치 어댑터
    ui/                         # 공통 화면 구성 요소
    i18n/                       # ko, zh-CN, en
  supabase/
    migrations/
    tests/
    seed.sql                    # 합성 데이터만
  tests/e2e/
```

초기에는 웹앱과 필요한 공통 패키지만 만든다. 네이티브 앱(`apps/mobile`)은 만들지 않는다.

**모바일 우선 원칙:** 웹으로 배포하지만 기준 화면은 360–430px 세로 모바일이다. 고객(위챗 내장 브라우저)·기사·호텔(PWA) 화면은 모바일에서 먼저 완성·검수하고 데스크톱은 확장으로 다룬다. 운영자 `/admin`만 데스크톱 중심이며 긴급 업무는 모바일에서도 가능해야 한다([03 문서 2절](docs/03-design-i18n-theme-accessibility.md), [10 문서 5절](docs/10-visual-design-reference.md)).

**고객 채널 원칙:** 고객 기본 채널은 위챗·알리페이 내장 브라우저에서 동작하는 모바일 웹이고, 결제는 위챗페이·알리페이다. 위챗 미니프로그램은 웹을 `web-view`로 재사용하고 로그인·결제·알림 동의만 네이티브 페이지로 만드는 하이브리드 구조다([04 문서 8절](docs/04-architecture-integrations.md)). 그래서 A단계부터 실행 환경 감지·토큰 세션·결제 페이지 위임 경로를 웹에 넣는다.

**앱 원칙:** 고객용 네이티브 앱은 만들지 않는다(설치 거부감, 중국 안드로이드의 구글 플레이·FCM 부재, 중국 앱스토어 인허가, 위챗이 이미 알림·로그인·결제·재방문을 제공). 기사·호텔·운영 화면도 같은 웹앱의 `/driver`, `/partner`, `/admin`를 PWA로 설치해 쓴다. QR 스캔·사진 촬영·오프라인 작업 큐·웹 푸시는 브라우저 기능으로 구현한다. 차량 위치는 기사 폰의 백그라운드 수집 대신 차량 GPS 단말 연동이나 작업 중 화면이 열린 동안의 위치로 제공한다. 네이티브 앱은 현장 검증에서 PWA로 해결되지 않는 문제가 확인될 때만 검토한다.

## 5. 기능 개발 순서

| 단계 | 작업 ID | 구현 | 완료 조건 |
|---|---|---|---|
| A 기반 | A01–A05 | 웹앱, DB, 인증, 3언어, 테마, 수하물 공개 페이지, 호텔·노선 관리 | 중국어 고객 화면·한국어 업무 화면 접근, 권한·빌드 검증 |
| B 예약 | B01–B05 | 견적, 슬롯·용량, 비회원 주문, 결제·환불, 예약증 | 동시 마지막 슬롯·결제 중복·복구 E2E 통과 |
| C 배송 | C01–C05 | 호텔 보관, 기사 작업, QR·사진, 공항 인계, 사고·지원 | 짐별 소지자·부분 인계·반환 추적 가능 |
| D 고도화 | D01–D05 | 숙소↔숙소·공항→숙소 설정, 호텔 제휴·정산, 중국어 콘텐츠·유입, 운영 지표, WeChat Mini Program 하이브리드 | 노선별 통제, 유입·배송 성과, 미니프로그램 로그인·결제·알림 실기기 증거 |
| E 확장 | E01–E02 | 현장용 PWA 설치·웹 푸시·오프라인 강화, 검증된 차량 위치 | 실제 기기·네트워크·위치 테스트 증거 |

숙소→공항은 초기 주요 여정이다. 같은 주문·인계 모델로 다른 수하물 노선을 확장한다. 자동 배차·개별 GPS 태그는 앞 단계의 주문·현장 데이터가 안정된 후 선택적으로 구현한다.

## 6. Codex 실행 규칙

1. 현재 단계와 관련 문서를 읽고 연결된 작업 ID를 선택한다.
2. DB 제약·상태 전이·권한·실패시 처리부터 확정한다.
3. 마이그레이션 → 업무 로직/API → 화면 → 필요한 자동 검증 순으로 구현한다.
4. 타입 검사·린트·관련 테스트·빌드를 실행하고 결과를 기록한다.
5. 외부 키가 없으면 `mock` 어댑터로 업무 흐름을 구현한다. 실제 연동 상태는 `mock / sandbox / live`로 별도 기록한다.
6. 실제 고객 결제·알림·공개 배포를 합성 데이터 테스트와 혼동하지 않는다.
7. 변경 파일, 마이그레이션, 실행한 검증, 미검증 사항, 다음 작업 ID를 이 문서의 진행 기록에 적는다.
8. **페이지를 하나라도 새로 만들거나 수정할 때마다 그 페이지의 시각 디자인을 독립된 작업으로 취급한다.** 공통 컴포넌트를 붙인 뒤 끝내지 말고, 해당 화면의 목적에 맞는 정보 위계·타이포그래피·여백·색·버튼·이미지·아이콘·상태 표현을 직접 조정한다. 같은 사진이나 동일한 카드 레이아웃을 여러 화면에 무분별하게 반복하지 않는다.
9. **페이지별 완료 조건:** 360–430px 모바일과 데스크톱에서 실제 화면을 열어 라이트·다크 테마, 중국어 간체·한국어·영어 문구, 긴 문장, 빈 상태·오류·로딩·실제 데이터 상태를 확인한다. 버튼과 링크는 목적지와 동작을 직접 눌러 본다. 잘림·겹침·가로 스크롤·낮은 대비·어색한 줄바꿈·임시 문구·무관한 이미지가 있으면 수정한 뒤 다시 캡처한다. 인증이 필요한 화면은 권한별 상태도 확인하고, 검증하지 못한 상태는 완료로 적지 않는다.
10. 새 페이지의 디자인을 기존 페이지의 완성도보다 낮게 방치하지 않는다. 기능 테스트나 빌드 통과만으로 UI 완료를 선언하지 말고, 페이지별 시각 검수 결과와 남은 결함을 진행 기록에 남긴다. 화면에 ‘오픈 예정’, 내용 없는 카드, 동작하지 않는 CTA를 임시로 넣고 완료 처리하지 않는다.

A01에서 `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` 스크립트를 실제로 만든다. 생성 전에는 실행 가능 명령이라고 보고하지 않는다. 로컬 DB 테스트가 운영 DB에 연결되면 실패하도록 보호한다.

## 7. 변하지 않는 업무 규칙

- 예약·결제·짐·배송·환불·정산은 서로 다른 상태를 가진다.
- 견적·할인·세금·최종 금액은 서버가 계산한다. 통화 최소 단위 정수를 사용한다.
- 브라우저의 결제 성공 화면만으로 예약을 확정하지 않는다. PG 서버 조회·웹훅 검증이 필요하다.
- 용량은 DB에서 원자적으로 확보한다. 중복 클릭·웹훅·스캔은 멱등 처리한다.
- 수하물 QR에 개인정보·고객 주문 접근 권한을 넣지 않는다.
- 비회원 주문도 소유 검증 없이 번호만으로 조회하지 않는다.
- 기사·호텔은 배정된 업무에 필요한 정보만 본다. 서버 비밀키는 클라이언트에 넣지 않는다.
- 인계 사진은 비공개다. 주문별 접근·보존·삭제 정책을 적용한다.
- 알림 발송 실패가 이미 기록된 수거·인계를 취소하지 않는다.
- DB 이벤트는 UTC, 영업 마감은 Asia/Seoul로 계산하고 고객에게 한국 시간임을 표시한다.
- 네트워크가 없을 때 결제나 최종 인계를 성공 확정하지 않는다.
- 차량 위치를 제공할 때 ‘수하물 자체 GPS’라고 표시하지 않는다.

## 8. 진행 기록

| 단계 | 상태 | 다음 작업 |
|---|---|---|
| 문서 | 중국인 대상 수하물 플랫폼으로 재정리·검증 완료 | 메인 1개 + 상세 9개, 상대 링크 40개와 범위·코드 블록·문자 인코딩 검사 통과 |
| A | A01–A05 코드·로컬 검증 완료 (2026-09-29). 원격 Supabase 적용·실로그인 검증 대기 | B01 서버 견적 |
| B | B01–B05 코드·로컬 검증 완료 (2026-09-29). 원격 Supabase 적용·실결제 흐름 검증 대기 | C01 호텔 보관 |
| C | C01–C05 코드·로컬 검증 완료 (2026-09-29). 실기기(카메라·사진 업로드·오프라인) 검증 대기 | D01 노선 확장 설정 |
| D | D01–D05 코드·로컬 검증 완료 (2026-09-29). 미니프로그램 개발자 도구·실기기·실결제 검증 대기 | E01 현장용 PWA 강화 |
| E | E01·E02 코드·자동 검증 완료 (2026-09-29). 실기기 검증·관제 업체 선정 대기 | 실기기 검증표(09 문서 12절) 작성, 운영 전환 준비 |

**완료 판정 주의 (2026-09-30):** 위 표의 “코드·로컬 검증 완료”는 기능 전체가 실서비스에서 동작한다는 뜻이 아니다. [기능 구현 감사](docs/11-implementation-audit.md)에서 15개 기능 ID를 재분류했으며, `TODO.md`의 30개 항목과 실제 PG·알림·위챗·차량 위치 연동 및 실기기 검증이 남아 있다. 공개 배포의 상태 API는 네 연동을 모두 `mock`으로 보고한다. 호텔 API 503은 원격 DB 미적용이 원인이었으며 아래 복구 기록대로 해결했다. 고객에게 전체 기능 완료라고 말하지 않는다.

**원격 데이터 연결 복구 (2026-09-30)**
- 변경 파일: `supabase/migrations/20260930000200_function_execute_grants.sql`, 예약 차단 시 견적 문의 경로를 제공하는 `apps/web/src/app/[locale]/(customer)/luggage/book/page.tsx`, 미등록 숙소의 수기 견적 요청과 선택 초기화를 추가한 `apps/web/src/components/stay-search.tsx`, `tests/e2e/hotels.spec.ts`, `docs/11-implementation-audit.md`.
- 마이그레이션: 연결된 Supabase 프로젝트 `kvlgalqqfdupcoyijdvy`는 기존 적용 기록 0건·공개 테이블 0개였다. 저장소의 기존 마이그레이션 20개를 순서대로 적용하고 `supabase/seed.sql`의 **합성 개발 데이터**를 넣었다. 추가 보안 마이그레이션으로 SECURITY DEFINER 함수 61개 중 비로그인 실행 권한을 3개 공개 기능으로 제한했다.
- 검증: 공개 배포와 로컬 `/api/v1/hotels`가 503에서 HTTP 200으로 바뀌고 예시 숙소 2곳을 반환했다. 원격 DB 함수 권한 조회에서 비로그인 실행 가능 함수 3/61개를 확인했다. 타입 검사·린트·단위 테스트 87개와 모바일 숙소 검색 E2E 9개 통과. DB 테스트는 Windows 실행 환경의 `uv_os_get_passwd` ENOMEM으로 완료하지 못했다. 실제 예약·실결제 성공 증거는 아니다.
- 인증·문의 후속 검증: 사용자의 명시적 승인 후 Supabase 프로젝트에서 익명 로그인을 활성화하고 페이지 새로고침으로 설정 지속을 확인했다. 공개 테스트 배포에서 관광공사 숙소 선택→합성 견적 문의 제출→고객 문의 내역 표시를 확인했다. 로컬 `:3400`은 외부 연결 가능한 production 빌드 테스트 서버로 다시 띄웠고 비회원 세션 201, 미등록 숙소 문의 저장 201, 고객 문의 화면 200, 비회원의 관리자 회원 API 접근 403을 확인했다. 두 합성 문의는 DB에 `open`으로 저장됐다. 실제 고객 요청이나 배송 예약이 아니다. 최종 빌드·린트·타입 검사 통과.
- 미검증·차단: 필수 짐 규격·금지 품목의 승인 문구가 DB에 없어서 실제 예약은 계속 차단한다. 실제 PG·알림은 mock 상태다. 직원 계정·관리자 문의 처리, 실주문·Storage는 별도 검증해야 한다.
- 다음 작업: 승인된 필수 정책 게시, 운영자 계정 발급과 문의 처리 검증, 실계정으로 주문·인계 확인.

### 구현 기록

**A01 웹앱·로컬 환경**
- 변경 파일: pnpm 모노레포(`package.json`, `pnpm-workspace.yaml`), `apps/web`(Next.js 16 App Router, `/{locale}` 라우팅, 고객 홈·하단 탭, `/driver`·`/partner`·`/admin` 자리, `/api/v1/health`), `packages/i18n`(zh-CN·ko·en, ICU 메시지, KST·금액 포맷), `packages/domain`(실행 환경 감지·환경별 결제 수단), `packages/contracts`(응답·오류 계약), `packages/integrations`(연동 모드 검증), `scripts/test-db.mjs`, `tests/e2e`.
- 마이그레이션: `20260929000100_foundation.sql` — `set_updated_at`, `app_env`·`integration_mode` 타입, `feature_settings`(RLS, 운영 mock 금지·live는 운영 전용 제약). 원격 개발 프로젝트에는 아직 미적용.
- 검사와 결과: `pnpm lint` 통과, `pnpm typecheck` 통과, `pnpm test` 22개 통과, `pnpm test:db` 7개 통과(원격 DB 주소면 실행 거부 확인), `pnpm test:e2e` 20개 통과(360px 모바일 + 데스크톱 레이아웃, 위챗·미니프로그램·알리페이 UA 감지, 구글 요청 0건), `pnpm build` 통과.
- 연동 모드: payment·notification·maps·wechat 모두 mock. Supabase 원격 개발 프로젝트 URL·publishable key는 `apps/web/.env.local`(git 제외)에 설정, 아직 코드에서 호출하지 않음.
- 미해결: Docker·Supabase CLI 미설치 → DB 테스트는 embedded Postgres + Supabase 역할/auth 흉내(`supabase/tests/support/supabase-shim.sql`)로 실행. 실제 Supabase auth·storage 동작은 A02에서 원격 개발 프로젝트로 검증 필요. 원격 프로젝트는 연결된 Supabase MCP 계정에 없어 마이그레이션 적용 경로(DB 비밀번호 또는 CLI 링크) 결정 필요. 고객 문구는 승인 전 초안.
- 다음 ID: A02.

**A02 DB·인증**
- 변경 파일: `supabase/migrations/20260929000200_profiles_roles.sql`, `apps/web/src/server/{supabase,auth,api}.ts`, `apps/web/src/proxy.ts`(세션 쿠키 갱신), `/api/v1/sessions/guest`·`/api/v1/sessions`·`/api/v1/me`, `components/staff-{gate,login}.tsx`, 업무 화면 3개, `packages/domain/src/access.ts`, i18n 업무 문구, 05 문서 7절 결정 기록.
- 마이그레이션: `profiles`(가입 시 자동 생성, 본인만 조회, display_name·locale·theme 열만 수정), `role_assignments`(서버만 부여, 본인만 조회, 호텔 직원=호텔 범위·그 외=전역, anonymous 사용자 금지, 중복 금지), `audit_events`(역할 부여·회수 자동 기록, 추가 전용), `has_role()`. 원격 개발 프로젝트에는 아직 미적용.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 27개, `pnpm test:db` 23개(타인 프로필 차단, 자기 역할 부여 차단, guest 역할 금지, 감사 기록, 계정 삭제 시 정리), `pnpm test:e2e` 24개(업무 화면 3곳 로그인 요구·고객 탭 미노출, `/me` 401, 위조 Bearer 401, 교차 출처 guest 생성 403), build 통과.
- 연동 모드: 인증은 Supabase(원격 개발 프로젝트) 연결 코드 준비, 실제 로그인·guest 생성은 마이그레이션 적용과 anonymous sign-in 활성화 후 확인 필요. 결제·알림 mock.
- 미해결: 운영자 MFA, 업무 계정 발급 화면, guest 생성 남용 방지(CAPTCHA/rate limit), 다른 기기 주문 복구(B단계 연락 채널과 함께), 연락 채널 암호화 저장.
- 다음 ID: A03.

**A03 다국어 콘텐츠·설정 동기화**
- 변경 파일: `supabase/migrations/20260929000300_content_translations.sql`, `packages/i18n/src/content.ts`(대체 언어 규칙), `/api/v1/me/preferences`, `lib/preferences-client.ts`, 테마·언어 선택기·업무 로그인의 계정 동기화, `lib/request-context.ts`(테마 우선순위), `server/api.ts`(동일 출처 검사를 Host 헤더 기준으로 수정 — A02 guest 생성에도 적용).
- 마이그레이션: `content_items`·`content_translations`(언어별 게시 상태 draft/review/published/archived, 원문 수정 시 원문 버전 증가·타 언어 needs_review 및 게시 중단, 최신 원문 기준 없이 검토 해제 금지, 게시는 admin만, 공개는 게시본만). zh-TW·ja 행 저장 가능(라우팅 미개방).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 31개(critical 문구 대체 금지 포함), `pnpm test:db` 33개, `pnpm test:e2e` 25개(선호 API 403/400/401), build 통과.
- 연동 모드: mock. 계정 선호 저장은 원격 마이그레이션 적용 후 실사용 확인 필요.
- 미해결: 콘텐츠 편집 화면(운영자용), 예약 당시 약관 스냅샷(B단계), 고객 문의·기사 메모 원문/번역 구분(C단계).
- 다음 ID: A04.

**A04 수하물 공개 페이지**
- 변경 파일: `/{locale}/luggage`(노선·이용 방법·필수 안내·예약 진입), `/{locale}/guide/[slug]`, `/{locale}/legal/[slug]`, `/{locale}/help`(FAQ), `components/{content-view,route-list}.tsx`, `server/content.ts`(supabase/fixture 저장소), `server/content-fixtures.ts`(‘예시’ 표시 합성 콘텐츠), `lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts`, 업무·계정 화면 noindex.
- 마이그레이션: 없음 (A03 콘텐츠 테이블 사용).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 31개, `pnpm test:e2e` 36개(필수 안내 미승인 언어 예약 차단, 대체 언어 안내·lang 표시, 잘못된 slug·종류 404, canonical·hreflang, noindex, 비운영 robots 차단), build 통과.
- 연동 모드: 콘텐츠 `PUBLIC_DATA_SOURCE=supabase` 기본, E2E는 `fixture`. 원격 DB에 게시 콘텐츠가 없으면 안내 ‘불러오지 못함/없음’과 예약 차단이 표시된다(의도된 동작). fixture는 production에서 기동 실패.
- 미해결: 실제 승인 문구(짐 규격·금지 품목·보상·취소) 작성과 DB 게시, 공유 이미지(OG), 호텔별 공개 페이지는 A05에서.
- 다음 ID: A05.

**A05 호텔·권역·노선·인계 장소 관리**
- 변경 파일: `supabase/migrations/20260929000400_hotels_zones_routes.sql`, `supabase/seed.sql`(합성 권역·호텔·노선), `server/{catalog,catalog-fixtures,admin}.ts`, `/{locale}/hotels`(검색)·`/{locale}/hotels/[slug]`, 홈 숙소 검색 활성화, 노선 판매 표시를 운영 설정에서 읽도록 변경, `/api/v1/hotels`, `/api/v1/admin/hotels`(POST)·`/api/v1/admin/hotels/[id]`(PATCH 상태)·`/api/v1/admin/route-offerings/[id]`(PATCH 판매), `/admin`·`/admin/hotels`·`/admin/routes`(한국어 업무 화면), `PUBLIC_DATA_SOURCE`(구 CONTENT_SOURCE).
- 마이그레이션: `service_zones`(area/airport), `hotel_partners`(비공개 계약 참조), `hotels`(+`hotel_translations` 별칭), `handoff_locations`(+번역, 같은 코드 유효기간 겹침 금지), `route_offerings`(노선 방향·권역 종류 일치 검사), 공통 `audit_row_change`(변경 필드 전후 기록), 호텔 범위 역할의 호텔 존재 검사, `is_operations_staff()`. 공개는 활성 데이터만, 쓰기는 admin만, 삭제 권한 없음(보관 상태 사용).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 36개, `pnpm test:db` 47개(비활성 호텔 비공개, 계약정보 비공개, 호텔 직원 자기 지점만, dispatcher 쓰기 불가, 감사 기록, 노선 방향 검사, 인계 장소 기간 겹침·미래 버전 비공개, 호텔 범위 역할 검사), `pnpm test:e2e` 48개(중국어 별칭 검색→호텔 페이지·한국 시간, 번역 없으면 한국어 원명, 404, 공개 DTO 필드 제한, 관리 화면 로그인 요구, 관리 API 401/403), build 통과.
- 연동 모드: 공개 카탈로그 `PUBLIC_DATA_SOURCE=supabase` 기본, E2E는 fixture. 관리자 로그인 후 등록·상태 변경·노선 전환은 **원격 마이그레이션 적용 + 업무 계정 발급 후 실기 확인 필요**(자동 E2E는 비로그인 경로만 검증).
- 미해결: 권역·인계 장소 관리 화면(DB·RLS는 준비), 호텔 번역 수정 화면, 인계 장소 사진 업로드(비공개 Storage), 업무 계정 발급·MFA.
- 다음 ID: B01.

**B01·B02 서버 견적·슬롯·용량**
- 변경 파일: `supabase/migrations/20260929000500_slots_pricing.sql`, `20260929000600_quotes.sql`, `supabase/seed.sql`(예시 요금 15,000/20,000원·14일치 슬롯), `server/{slots,api}.ts`, `/api/v1/service-slots`, `/api/v1/quotes`.
- 마이그레이션: `booking_settings`(견적 15분·홀드 10분·항공 여유 120분·최대 8개·부가세 10%), `bag_size_rules`(보통 1·대형 2단위), `price_rules`(노선·규격별, 유효기간 겹침 금지), `service_slots`(수거·인계 창, 마감), `capacity_buckets`(held+committed≤max 제약), `available_slots()`(공개, 남은 단위만), `quotes` + `create_quote()`(security definer, 소유 세션·판매 여부·마감·호텔 권역·항공편 여유·짐 수량·요금 규칙·용량 검사, 정수 KRW·부가세 포함 세액 half-up), `luggage_error()`. 감사 트리거가 UUID가 아닌 id도 기록하도록 보강.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 39개(DB 오류→API 매핑), `pnpm test:db` 70개(가격·세액, 견적 소유자만 조회, 직접 insert로 금액 위조 차단, 11가지 입력 거부, 마감·판매중지·용량부족·요금없음, 용량 불변식, 요금 기간 겹침), `pnpm test:e2e` 슬롯·견적 API 6개(fixture 슬롯, 미판매 노선 빈 결과, 400/404, 견적 401·금액 필드 거부·교차출처 403).
- 연동 모드: 결제 없음. 견적은 로그인(guest 포함) 세션 + 원격 DB 필요 → 원격 마이그레이션 적용 전에는 실제 견적 생성 E2E 불가. DB 수준 테스트로 검증.
- 미해결: 쿠폰·호텔 제휴 할인(D단계), 슬롯·요금 관리 화면, 항공편 조회 API(현재 수기 입력).
- 다음 ID: B03.

**B03 비회원 주문**
- 변경 파일: `supabase/migrations/20260929000700_orders.sql`, `server/orders.ts`, `/api/v1/orders`(POST, Idempotency-Key 필수)·`/api/v1/orders/[id]`(GET), `components/booking/booking-flow.tsx`, `/{locale}/luggage/book`(호텔 선택·필수 안내 게시 확인), `/{locale}/orders/[id]`, i18n `messages/booking.*.ts`.
- 마이그레이션: `idempotency_keys`(actor+operation+key, 요청 해시), `outbox_events`, `orders`(예약 상태·홀드 만료·금액·연락처 스냅샷, 참조 번호 JC+8자), `order_bags`(규격별 가격·세액 배분 스냅샷, 잔여는 최대 금액 행), `capacity_holds`, `policy_acceptances`(동의 당시 제목·본문·버전), 예약 상태 전이 가드, `create_order()`(멱등→견적 소유·만료·재사용→연락처(한국 번호 강제 없음, 국제 형식·위챗 허용)→고객 언어 게시 정책 동의→슬롯 재검사→버킷 FOR UPDATE 홀드→주문·짐·홀드·동의·outbox), `expire_holds()`(service_role, SKIP LOCKED, 재실행 안전).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 39개, `pnpm test:db` 89개(스냅샷·세액 합계, **동시 중복 클릭 같은 주문**, 같은 키 다른 본문 409, 견적 재사용·타인 견적·만료 거부, 연락처 규칙, 정책 언어 게시 필수, 실패 시 키 재사용, **마지막 용량 동시 주문 1건만 성공**, 홀드 만료 1회 해제, 소유자·운영자만 조회, 고객 직접 수정 불가, 잘못된 상태 전이 거부), `pnpm test:e2e` 62개(호텔 미선택 안내, 필수 안내 미승인 언어 예약 차단, 슬롯·짐·항공편 입력 후 요금 버튼 활성, 주문 페이지 소유 세션 없으면 비공개, 주문 API 400/401), build 통과.
- 연동 모드: 결제 없음. 브라우저에서 견적→주문까지 실제 진행은 원격 DB·익명 로그인 설정 후 확인 필요(자동 E2E는 요금 계산 전까지).
- 미해결: 홀드 만료 스케줄러 연결(B04에서 cron 경로와 함께), 다른 기기 주문 복구, 계정 삭제 시 주문 보존·익명화 정책(orders.owner_id는 삭제 제한).
- 다음 ID: B04.

**B04 결제·환불 (mock PG)**
- 변경 파일: `supabase/migrations/20260929000800_payments_refunds.sql`, `packages/integrations/src/payment.ts`(PG 어댑터 계약 + `MockPaymentAdapter`: HMAC 서명·5분 재전송 차단), `server/{payments,service-client,jobs}.ts`, API `/orders/[id]/payment-attempts`·`/payments/webhooks/[provider]`·`/payments/mock/[attemptId]`(비운영 전용)·`/orders/[id]/cancellation-requests`·`/refunds/[id]/approve`·`/jobs/expire-holds`·`/jobs/reconcile-payments`, `apps/web/vercel.json`(cron 5분·10분), 주문 화면 결제·취소·환불 상태(`order-actions.tsx`), 모의 결제창 `/{locale}/mock-pay/[attemptId]`, env `SUPABASE_SERVER_SECRET`·`CRON_SECRET`·`MOCK_PAYMENT_SECRET`(빈 값은 미설정 처리).
- 마이그레이션: `payment_attempts`(상점 주문 ID 유일, 클라이언트 키 멱등), `payment_events`(provider+event_id 유일), `refund_requests`(주문당 대기 1건), `refunds`, `ledger_entries`(추가 전용 트리거·부호 제약·중복 기록 금지), `start_payment()`(소유자·홀드 유효), `record_payment_result()`(service_role 전용: 중복 이벤트, 늦은 실패 무시, 금액·통화 불일치→needs_review, 두 결제창 성공→1회 확정+초과수납 검토, 만료 후 성공→용량 재확보 또는 needs_review), `request_cancellation()`(미결제 즉시 취소, 결제 주문은 예약 마감 전 전액 환불 요청), `approve_refund()`(finance, 결제 행 잠금·총액 초과 방지, 전액이면 취소·용량 해제), `record_refund_result()`(unknown→재조회, 원장 1회), `order_payment_summary()`.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 46개(mock 서명 위조·재전송·만료 거부), `pnpm test:db` 106개, `pnpm test:e2e` 73개(위조 서명 403, 서버 DB 권한 없으면 확정하지 않고 503, 위챗 밖 JSAPI 422, 결제·취소·환불·모의결제 권한, cron 비밀 없으면 403), build 통과.
- 연동 모드: payment **mock**. 실제 PG(sandbox/live) 어댑터 없음 — 계약 공급사 결정 후 같은 계약으로 추가. mock 결제 확정은 `SUPABASE_SERVER_SECRET`(service role)이 있어야 동작.
- 미해결: 실제 PG 어댑터·위챗 JSAPI 파라미터·미니프로그램 결제 위임, 환불 승인 화면(finance), 초과 수납·needs_review 운영 큐 화면, 알림 발송(outbox 소비자), Vercel Hobby 플랜은 cron이 하루 1회로 제한되므로 Pro 또는 외부 스케줄러 필요.
- 다음 ID: B05.

**B05 예약증**
- 변경 파일: `supabase/migrations/20260929000900_bags_voucher.sql`, `components/booking/{voucher,print-button}.tsx`, 주문 화면(확정 시 예약증), 인쇄 시 헤더·하단 탭 숨김, `voucher.test.tsx`, i18n `voucher.*`, vitest TSX 설정(oxc automatic JSX).
- 마이그레이션: `bags`(짐 1개당 1행, 무작위 태그 `T`+10자, 짐 상태 enum), 예약 확정 시 짐 생성·취소 시 수거 전 짐 `cancelled_before_pickup`(트리거, 1회), 고객은 자기 주문 짐만 조회.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 50개(QR에 참조 번호만, 연락처 미노출, 한국어 직원 카드·한국 시간, 짐별 태그·서버 확인 시각), `pnpm test:db` 110개(확정 시에만 짐 생성·태그 유일, 취소 시 짐 상태, 소유자만 조회), `pnpm test:e2e` 73개, build 통과.
- 연동 모드: 결제 mock. 예약증 화면 실기 확인은 원격 DB + service role 키 + mock 결제 흐름 필요.
- 미해결: PWA 오프라인 예약증 캐시(E01), 짐 태그 인쇄·부착(C단계), 고객 수령 코드(C04).
- 다음 ID: C01.

**C01–C05 호텔 보관·기사 작업·QR·사진·공항 인계·사고·지원**
- 변경 파일: 마이그레이션 `20260929001000_logistics_core.sql`·`001100_evidence_incidents_support.sql`·`001200_staff_directory.sql`; API `/bags/events`·`/delivery-jobs/[id]/assignment`·`/uploads/intents`·`/evidence/[id]/url`·`/orders/[id]/handoff-challenges`·`/handoffs/verify`·`/incidents`·`/support/tickets`(+`/[id]/messages`); 화면 `/driver`(작업 목록)·`/driver/jobs/[id]`(태그 스캔·사진·수거·적재·인계 준비·수령 코드 인계·사고 보고)·`/partner`(지점별 오늘·내일 예약, 태그 확인 후 보관)·`/admin/dispatch`(배차·인계 n/m·미해결 사고·운영 확인 주문·열린 문의)·`/admin/support/[id]`(내부 메모 분리); 고객 주문 화면 짐별 상태·마지막 확인 시각·수령 코드·문의, `/help` 문의 양식, `/help/requests/[id]`; `lib/field-client.ts`(오프라인 재전송 큐·사진 재인코딩으로 EXIF 제거·서명 URL 업로드), `components/field/*`, 예약 기본 날짜 자동 이동.
- 마이그레이션: `delivery_jobs`(확정 시 생성, 수거 후 취소면 유지), `job_assignments`(작업당 현재 1명), `bag_events`(추가 전용), `handoff_challenges`(해시, 15분, 5회 잠금), `record_bag_event()`, `assign_driver()`, `issue_handoff_challenge()`, `verify_handoff()`, `recompute_job_status()`, `driver_jobs()`/`partner_jobs()`(최소 정보, 전화·이메일 없음), `evidence_files`+`create_evidence_intent()`+비공개 `evidence` 버킷, 이벤트 증빙 같은 작업 검사, `incidents`/`report_incident()`, `compensation_claims`(PG 환불과 분리), `support_tickets`/`support_messages`(내부 메모 고객 비공개)+`create_support_ticket()`/`add_support_message()`, `list_drivers()`.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 54개(오프라인 큐: 같은 ID 1건·성공 시 제거·네트워크 없으면 유지·서버 거절 시 보고), `pnpm test:db` 136개(LOG-01 다른 주문 태그 거부, LOG-02 부분 인계는 완료 아님, LOG-03 재전송 1건, LOG-04 재배정 후 이전 기사 권한 종료, LOG-06 환불 후 수거 짐·작업 유지, LOG-08 동시 검증 1회 완료, 코드 5회 잠금, 호텔 지점 범위, 증빙 경로 개인정보 없음·형식·크기, 내부 메모 비공개, 문의 멱등), `pnpm test:e2e` 89개(현장 API 401/403, 업무 화면 로그인 요구, 문의 스레드 비공개), build 통과.
- 연동 모드: 사진 저장은 Supabase Storage 서명 URL(서버 키 필요), 알림 발송 없음(outbox 기록만).
- 미해결: 카메라 QR·사진 업로드·오프라인 큐의 **실기기 검증**, 오프라인 큐 IndexedDB 전환·로그아웃 시 정리 연결(E01), 짐 태그 인쇄물, 반환 작업 화면, 정정(correction) 이벤트 화면, 차량 위치(E02), 보존기간 만료 파일 삭제 작업, 알림 발송(outbox 소비자·템플릿), LOG-05·07·09 중 위치·공유 링크 관련 항목(E단계).
- 다음 ID: D01.

**D01 노선 확장 (공항→숙소, 숙소→숙소)**
- 변경 파일: `supabase/migrations/20260929001300_route_expansion.sql`, `supabase/seed.sql`(세 노선 예시 요금·슬롯), 슬롯·견적 API(`destinationHotel`, `flightArrivesAt`), `server/slots.ts`(`findOffering` 노선별 권역 규칙, `routeChoicesForHotel`), 예약 화면 노선 선택·도착 호텔 선택·항공편 도착 시각, 주문·예약증·기사·호텔·배차 화면 노선별 문구, 호텔 화면 맡김/도착 구분.
- 마이그레이션: `booking_settings.arrival_buffer_minutes`(60분), `quotes/orders.flight_arrives_at`, `create_quote()`에 도착 시각 인자(공항→숙소는 도착 시각 필수·공항 수거 창 종료 60분 전까지, 숙소→숙소는 항공편 없음), `record_bag_event()`에 도착 호텔 직원 인수(`delivered`) 추가(공항 인계는 계속 수령 코드 전용), `issue_handoff_challenge()` 공항 노선 전용, 작업 조회 RLS·`partner_jobs()`(pickup/dropoff)·`driver_jobs()`(도착 호텔) 확장.
- 검사와 결과: lint·typecheck 통과, `pnpm test` 58개, `pnpm test:db` 140개(도착 시각 필수·늦음 거부, 공항→숙소 수령 코드 불가·기사/타 호텔 인수 불가·도착 호텔 인수로 완료, 숙소→숙소 같은 호텔·권역 불일치 거부·출발 접수/도착 인수 역할 분리), `pnpm test:e2e` 93개(노선 선택, 도착 시각 입력, 도착 호텔 선택·항공편 없음, 노선별 슬롯 API), build 통과.
- 연동 모드: 변경 없음 (결제 mock).
- 미해결: 노선별 요금·슬롯 관리 화면, 도착 호텔 보관 후 고객 수령 확인(호텔 운영 영역), 공항 수거 장소 안내(인계 장소 버전 표시).
- 다음 ID: D02.

**D02 호텔 제휴·정산**
- 변경 파일: `supabase/migrations/20260929001400_partner_settlement.sql`, `supabase/seed.sql`(예시 제휴사·코드 SAMPLE01·10% 예시 규칙), `server/attribution.ts`(유입 쿠키 검증), 주문 API가 `create_order_with_attribution` 사용, `/api/v1/settlements`(초안)·`/api/v1/settlements/[id]/(confirm|paid)`, `/admin/settlements`(재무), API 오류 코드 보강(누락됐던 `FLIGHT_TOO_LATE`·`HANDOFF_NOT_APPLICABLE` 포함).
- 마이그레이션: `partner_codes`(공개 코드→호텔, 유효기간·적용 노선), `commission_rules`(정액/비율, 기간 겹침 금지, 재무 전용), `order_attributions`(주문 생성 트랜잭션에서 1회 확정·추가 전용), `hotel_commissions`(확정 시 규칙 스냅샷 계산·비율은 원 단위 내림, 배송 완료 시 적격, 미지급 취소는 reversed, 지급 후 취소는 환수 항목), `settlement_batches/items`(항목 이중 정산 방지, 지급은 증빙 참조 필수), `resolve_partner_code()`(공개), `create_settlement_draft()`/`confirm_settlement()`/`mark_settlement_paid()`(재무), 규칙이 없으면 0원+`missing_rule` 표시(임의 금액 금지).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 61개(유입 쿠키 변조·개인정보 필드 거부), `pnpm test:db` 148개(귀속 1회 확정·재요청에도 유지·수정 불가, 알 수 없는 코드 무시, 확정→적격→정산→확정→지급 흐름, 이중 정산 방지, 지급 후 취소 환수, 미지급 취소 reversed, 규칙 없음 처리, 호텔 직원 자기 지점만·규칙 비공개), `pnpm test:e2e` 정산 API·화면 권한, build 통과.
- 연동 모드: 지급은 수동 기록(증빙 참조). 자동 송금 없음.
- 미해결: 부분 환불 시 수수료 재계산 규칙(현재 전액 취소만 반영), 제휴 코드·계약 규칙 관리 화면, 호텔용 정산 내역서 PDF.
- 다음 ID: D03.

**D03 유입·호텔 QR·상황별 콘텐츠**
- 변경 파일: `supabase/migrations/20260929001500_acquisition.sql`, `/{locale}/h/[code]`(호텔 QR 랜딩: 제휴 코드 확인→유입 쿠키(httpOnly)→지점 선택 호텔 화면), `proxy.ts`(캠페인 `?cid=&ch=` 기록, 기존 호텔 QR 귀속 유지), `server/partner-codes.ts`, 상황별 안내 3종(출국일 체크아웃·도착 직후·숙소 이동, 관련 노선 연결), 서비스 화면 상황별 링크, 안내 화면 예약 CTA, 호텔 화면 노선별 예약 버튼, `/partner/qr`(QR 포스터: 중국어 고객용+한국어 직원용·생성일·최신 운영 설정 안내, 지점 QR 유입·수수료 실적), `/admin/campaigns`+`/api/v1/campaigns`(캠페인 기록·링크·예약/확정 건수).
- 마이그레이션: `content_items.related_route`, `marketing_campaigns`(content_editor 기록, https 게시 URL·절대 랜딩 경로 제약, 고객 비공개).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 61개, `pnpm test:db` 151개, `pnpm test:e2e` 103개(QR→지점 선택·httpOnly 유입 쿠키, 잘못된 코드는 귀속 없음, 캠페인 링크가 호텔 QR 귀속 유지, 캠페인 단독 채널 기록, 상황별 링크 3개, 안내→예약 연결, 직원 도구 로그인 요구), build 통과.
- 연동 모드: 샤오홍슈 자동 게시·수집 없음(수동 기록).
- 미해결: 실제 승인 중국어 콘텐츠 작성·게시, OG 공유 이미지, 인쇄 자료의 공항 수령 장소 버전 표기(인계 장소 관리 화면과 함께), 중국망 접속 품질 실측(미검증).
- 다음 ID: D04.

**D04 운영 지표**
- 변경 파일: `supabase/migrations/20260929001600_analytics.sql`, `/api/v1/analytics`(공개 조회 기록, 항상 204), `components/page-view.tsx`(홈·서비스·호텔·안내 화면), `/admin/metrics`(기간·기준별 표, 분자/분모 표기, 20건 미만 비율 생략), `scripts/test-db.mjs`(남은 임베디드 Postgres 정리 — Windows 공유 메모리 충돌 재발 방지).
- 마이그레이션: `analytics_events`(개인정보 키 금지 제약, 주문은 해시 참조만, 고객·업무자 직접 조회 불가), 서버 트리거로 `quote_created`·`order_held`(유입 채널·캠페인)·`payment_confirmed`·`order_cancelled`·`bag_collected`(수거 창 정시)·`handoff_ready`/`bag_delivered`(약속 창 정시, 준비와 실제 인계 분리)·`support_created` 기록, `track_public_event()`(공개는 조회·호텔 선택만), `ops_metrics()`(운영·재무, 전체/언어/노선/호텔/채널/캠페인).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 61개, `pnpm test:db` 157개(견적→인계 퍼널 서버 기록·개인정보 없음, 개인정보 키 거부, 직접 조회 불가, 공개는 조회 이벤트만, 차원별 집계·권한), `pnpm test:e2e` 105개, build 통과.
- 연동 모드: 외부 분석 도구 없음 (1차 데이터만).
- 미해결: 개선 실험(문구·버튼 버전 기록), 기사·호텔별 누락·증빙률 지표, 알림 실패 지표(알림 발송 구현 후), 지표 기간이 길 때의 집계 성능(필요 시 일별 요약 테이블).
- 다음 ID: D05.

**D05 위챗 미니프로그램 (하이브리드)**
- 변경 파일: `supabase/migrations/20260929001700_miniprogram_pay.sql`, `packages/integrations/src/wechat.ts`(WeChatIdentity·미니프로그램 결제 어댑터 계약 + mock), `server/wechat.ts`, 결제 시도 API의 미니프로그램 위임(1회용 티켓 → `wx.miniProgram.navigateTo`), `/api/v1/wechat/pay-tickets/redeem`(티켓+wx.login code → 결제 파라미터), `/api/v1/wechat/mock-complete`(비운영), `lib/miniprogram-bridge.ts`(위챗 JS-SDK는 미니프로그램 실행 환경에서만 로드), `apps/wechat/`(web-view 첫 화면·결제 페이지·설정·README 출시 체크리스트), lint·vitest 설정.
- 마이그레이션: `miniprogram_pay_tickets`(해시 저장, 5분, 1회), `create_miniprogram_pay_ticket()`(주문 소유자·미니프로그램 결제 방식만), `redeem_miniprogram_pay_ticket()`(서버 전용, 행 잠금 1회 소비).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 70개(mock openid 안정성·잘못된 code 거부·mock 결제 파라미터 표시, web-view 주소 같은 출처만·결제 쿼리 검증), `pnpm test:db` 161개(티켓 소유자만 발급·해시 저장·서버만 소비·동시 소비 1회·만료·다른 결제 방식 거부), `pnpm test:e2e` 108개(미니프로그램 밖 위임 거부 422, 서버 키 없으면 결제 파라미터 미발급 503, 모의 완료 토큰 검증 403), build 통과.
- 연동 모드: wechat **mock**(openid 가짜), 미니프로그램 결제 **mock**. AppID·AppSecret·업무 도메인·위챗페이 가맹·구독 템플릿은 미설정.
- 미해결: 위챗 개발자 도구·실기기 실행, 실제 WeChatIdentity(code2session)·위챗페이 prepay 어댑터, 구독 메시지 발송(outbox 소비자), openid↔계정 명시적 연결(재방문 시 이전 주문 복구), 위챗 내장 브라우저 JSAPI 결제, 심사 제출.
- 다음 ID: E01.

**E01 현장용 PWA·알림**
- 변경 파일: `app/manifest.ts`(standalone·아이콘·기사/호텔/운영 바로가기), `public/icons/*`(SVG→PNG 192·512·maskable·apple), `public/sw.js`(정적 자원만 캐시·API/페이지 미캐시·오프라인 안내·푸시 표시·알림 클릭), `public/offline.html`(3개 언어, IndexedDB의 예약증 사본·대기 기록 수), `components/service-worker.tsx`(운영 빌드만 등록, 강제 새로고침 없음), `lib/local-store.ts`(IndexedDB `luggage-local`: queue·vouchers·jobs), 오프라인 큐 localStorage→IndexedDB, 예약증 오프라인 사본 저장, `server/notify.ts`(outbox→업무자 알림 규칙·알림함·웹 푸시, 만료 구독 삭제), `/api/v1/push/subscriptions`, `/api/v1/jobs/dispatch-outbox`(cron 매분), 업무 화면 도구(알림함·이 기기 알림 켜기·로그아웃 시 기기 데이터·푸시 구독 정리), `/{locale}/notifications`, env `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`·`WEB_PUSH_PRIVATE_KEY`·`WEB_PUSH_SUBJECT`(로컬 키는 `.env.local`에 생성, 운영은 별도 생성).
- 마이그레이션: `20260929001800_notifications.sql` — `notifications`(본인만, read_at만 수정, 이벤트당 1건), `push_subscriptions`(본인, https만), `claim_outbox()`(lease·SKIP LOCKED·만료 lease 재수거), `complete_outbox()`(지수 백오프, 5회 후 dead).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 77개(알림 규칙·연락처 미포함, IndexedDB 큐·로그아웃 정리), `pnpm test:db` 166개(outbox 1회 lease·백오프·dead·만료 lease 재수거·고객 차단, 알림·구독 소유권), `pnpm test:e2e` 115개(manifest·아이콘, 서비스 워커 제어 후 **오프라인 전환 시 안내 화면**, 오프라인 예약증 사본·마지막 확인 시각·대기 기록 수, API 미캐시, 푸시·outbox 권한), build 통과.
- 연동 모드: 웹 푸시 VAPID(로컬 키). 고객 알림 채널(이메일·위챗 구독 메시지)은 공급사 미정으로 미발송.
- 미해결(실기기): iOS 홈 화면 설치 후 푸시 수신, Android 설치·푸시, 카메라 QR·사진, 비행기 모드 재전송. 기사 배정 작업 오프라인 사본(jobs 스토어) 표시는 미구현. Vercel Hobby는 매분 cron 불가(Pro 또는 외부 스케줄러).
- 다음 ID: E02.

**E02 검증된 차량 위치**
- 변경 파일: `supabase/migrations/20260929001900_vehicle_tracking.sql`, `packages/integrations/src/tracking.ts`(업체 중립 표준 서명 웹훅: HMAC·5분 재전송 차단·좌표 검증, 고덕·바이두·애플 지도 링크 WGS84), `/api/v1/tracking/driver-location`, `/api/v1/tracking/webhooks/telematics`, `/api/v1/delivery-jobs/[id]/vehicle`, `/api/v1/vehicles`, `/api/v1/jobs/purge-locations`(cron 매일), 기사 작업 화면 ‘차량 위치 공유’(화면이 열린 동안 30초 간격, 권한 거부해도 작업 계속), 고객 주문 화면 ‘배송 차량 위치’(짐 자체 GPS 아님 명시, stale 표시, 지도 앱 링크), 배차 화면 차량 지정·차량/단말 등록, env `TRACKING_WEBHOOK_SECRET`, 04·07 문서 반영.
- 마이그레이션: `vehicles`(관제 단말 ID), `job_assignments.vehicle_id`, `vehicle_locations`(운영자만 원시 조회), `record_driver_location()`(배정 기사·활성 작업·기기 시각 ±·정확도 1km·15초 제한), `ingest_telematics_location()`(서버 전용, 차량의 활성 작업에만), `latest_vehicle_location()`(소유자, 수거~운송 중만, 좌표 반올림, 5분 stale), `set_job_vehicle()`, `purge_vehicle_locations()`(7일).
- 검사와 결과: lint·typecheck 통과, `pnpm test` 85개(웹훅 서명·변조·재전송·좌표 범위, 지도 링크 구글 없음, 차량 위치 카드 문구·stale·빈 상태), `pnpm test:db` 172개(배정 기사만·전송 제한·오래된/미래/부정확 거부, 단말→활성 작업만·서버 전용, 고객 요약만·타인 불가·원시 비공개·인계 준비 후 숨김, stale, 보존 삭제), `pnpm test:e2e` 119개(위조·재전송 웹훅 403, 서버 키 없으면 기록 안 함, 위치 API 권한, 정리 작업 cron 비밀), build 통과.
- 연동 모드: 관제 업체 **미선정** — 표준 웹훅으로 어느 업체든 연결 가능(업체 형식이 다르면 매핑 어댑터 추가). 기사 기기 위치는 실기기 미검증.
- 미해결: 관제 업체 선정·단말 설치·웹훅 설정, 업무 화면 지도 표시(카카오·네이버 키 필요), 실기기 위치 정확도·배터리 확인, LOG-05(연결 끊김 시 stale) 실측.
- 다음: 실기기 검증표 작성과 운영 전환(원격 DB 적용·계정·도메인·PG·위챗 계정).

남은 기능 목록은 [TODO.md](TODO.md)에서 관리한다 (작업 ID: OPS·CUS·FLD·PAY·GRW).

**UI01 고객 웹 디자인 적용 (2026-09-29)**
- 변경 파일: `apps/web/public/images/user-*.jpg`(사용자 제공 실제 제주 사진 4장), 고객 레이아웃·홈·서비스·호텔 검색/상세·예약·주문·도움말, `bottom-nav`·`route-list`·`booking-flow`·`voucher`·`support-form`, `globals.css`, `docs/10-visual-design-reference.md`. 생성 풍경 자산과 이전 생성 시안 파일은 제거.
- 마이그레이션: 없음. 가격·예약·배송 상태 로직은 변경하지 않음.
- 검사와 결과: lint·typecheck·build 통과, 관련 E2E 50개 통과(모바일 360px·데스크톱 넘침, 검색·노선·예약 UI), 생산 빌드 390px/1440px 스크린샷 육안 확인(`docs/design-preview-*.png`).
- 연동 모드: 변경 없음. 스크린샷은 합성 fixture의 테스트 모드이며 실제 결제·알림 증거가 아님.
- 미검증: 실주문 소유 세션에서 예약증·부분 인계 카드 시각 검수, 위챗 내장 브라우저 실기기.
- 다음 ID: 실기기 검증표 및 운영 전환 준비.

**UI02 최종 레퍼런스에 맞춘 고객 화면 재디자인 (2026-09-29)**
- 변경 파일: 고객 홈·레이아웃·예약 헤더, `globals.css`, 3언어 홈 문구, 실제 제주 사진 2장 추가, 화면 레퍼런스 문서 03·10, `layout.spec.ts`(현재 뷰포트에서 보이는 탐색 대상만 터치 크기 검사). 기존 주문·결제·배송 로직은 유지.
- 마이그레이션: 없음.
- 검사와 결과: lint·typecheck·build 통과. 전체 E2E 첫 실행 119개 중 116개 통과; 히어로 문구 기대값 1개와 수동 미리보기 서버에 추적 서명 키가 없어서 생긴 2개를 바로잡고 해당 고객·추적 E2E 17개 통과. 레이아웃 20개도 재실행 통과. 정식 전체 E2E 재실행은 119개 테스트 출력 후 종료 단계에서 응답이 멈춰 중단했으므로 단일 실행의 최종 통과 집계로 기록하지 않는다. 390px·1440px 전체 화면과 상단 화면 스크린샷을 `docs/design-preview-*.png`로 확인.
- 연동 모드: 변경 없음. 스크린샷은 fixture 테스트 모드이며 실제 결제·알림 증거가 아님.
- 미검증: 실제 위챗 웹뷰·실주문 예약증 화면, 고객 정책 승인본 게시 후 예약 전체 여정.
- 다음 ID: 실기기 검증표 및 운영 전환 준비.

**UI03 고객·업무 전체 화면 시각 정리 (2026-09-30)**
- 변경 파일: 숙소 목록·상세, 수하물 서비스, 예약 진입·입력, 도움말, 계정, 가이드·약관, 주문·문의 빈 상태, 직원 로그인·알림함, 공통 CSS, `scripts/visual-audit.mjs`, `docs/visual-audit/*`, 디자인 기준 문서. 사용자 제공 제주 사진을 화면별로 재사용하며 숙소 실물 사진으로 오인되지 않도록 지역 풍경 표시를 붙였다. 홈 히어로 상단 CTA는 투명 블루 유리 배경으로 조정했다.
- 마이그레이션: 없음. 예약·결제·배송·권한 로직은 변경하지 않음.
- 검사와 결과: lint·typecheck·build 통과, 단위 테스트 85개 통과, 전체 E2E 119개 통과. 25개 화면 경로 × 모바일 390px/데스크톱 1280px × 라이트/다크 = 100개 최종 캡처 모두 HTTP 200·가로 넘침 0건. 제목과 겹친 패널, 다크 예약 카드의 글자 대비를 캡처로 찾아 수정했고 `docs/visual-audit/results.json`에 각 경로 결과를 기록했다.
- 연동 모드: fixture 기반 로컬 미리보기. 실제 결제·알림·원격 DB 사용 증거가 아님.
- 미검증: 로그인한 직원 작업 화면과 소유 세션의 실제 주문·예약증·모의 결제 화면은 개발 DB·업무 계정 연결 후 시각 검수 필요. 위챗 내장 브라우저·현장 PWA 실기기 검수도 남음.
- 다음 ID: 실기기 검증표 및 운영 전환 준비.

**UI04 여행 편집형 전체 화면 재디자인 (2026-09-30)**
- 변경 파일: `apps/web/src/app/editorial-theme.css`와 고객 홈·숙소·서비스·예약·도움말·계정·가이드·상세 페이지, 자체 호스팅 `PretendardVariable.woff2` 및 `OFL.txt`, `apps/web/public/images/editorial-*.jpg`, `docs/03`·`docs/10`. 사용자 제공 사진의 프로젝트 복사본 `user-*.jpg`는 사용하지 않고 제거했다. 숙소별 실제 사진이 없는 카드에서는 스톡 사진도 제거했다.
- 마이그레이션: 없음. 견적·예약·결제·배송·권한·테마·다국어 기능은 유지.
- 검사와 결과: lint·typecheck·build 통과, 단위 테스트 85개 통과. E2E 119개 항목 모두 통과 출력이 있었으나 실행 프로세스가 종료 단계에서 멈춰 종료 코드는 확보하지 못했다. 25개 URL × 모바일·데스크톱 × 라이트·다크 100개 화면을 재캡처해 HTTP 오류·가로 넘침 0건 확인(`docs/visual-audit/results.json`). 마지막 타이포·CTA 조정 후 레이아웃 E2E 20개도 모두 통과 출력까지 확인했으며 같은 종료 단계 문제로 종료 코드는 확보하지 못했다.
- 연동 모드: fixture 기반 로컬 미리보기. Unsplash 편집용 사진은 실제 제주 장소·제휴 숙소의 증거가 아니다. 실제 결제·알림·원격 DB 실증과 구분한다.
- 미검증: 실제 소유 세션 예약증·결제창, 로그인한 기사·호텔·운영 작업 화면, 위챗 브라우저·현장 PWA 실기기.
- 다음 ID: 실기기 검증표 및 운영 전환 준비.

**CUS 관광공사 제주 숙소 전체 검색·견적 문의 (2026-09-30)**
- 변경 파일: `server/tour-stays.ts`(한국관광공사 국문 `searchStay2`, 제주 필터·1시간 캐시·전체 페이지 조회), `/api/v1/tour-stays`, `components/stay-search.tsx`(홈·숙소 페이지 펼침목록, 이름·주소 검색, 등록 숙소는 기존 예약으로 이동, 관광공사 숙소는 픽업 방식·날짜·짐 개수·연락처를 받는 견적 문의), 고객 홈·숙소 페이지, CSS, 서버 전용 `TOUR_API_SERVICE_KEY` 환경값. 키는 git 제외된 `.env.local`에만 저장하고 클라이언트에는 전달하지 않는다.
- 마이그레이션: 없음. 미등록 숙소 견적 문의는 기존 `support_tickets` 접수 경로를 사용하며, 즉시 확정 견적·결제는 등록 숙소 흐름을 유지한다.
- 검사와 결과: 실제 승인 키로 제주 숙소 212건(`resultCode=0000`) 조회, 로컬 `/api/v1/tour-stays` 200·212건, 모바일 390px에서 이름 검색·목록 선택·견적 문의 폼 표시 확인. lint·typecheck·build 통과, 단위 테스트 87개 통과, 관련 호텔 E2E 9개 통과.
- 연동 모드: 관광공사 숙박 목록은 실제 API, 견적 문의 접수는 기존 Supabase 지원 티켓 경로. 원격 Supabase 세션·지원 티켓 쓰기는 이 작업에서 실증하지 않음.
- 미검증: 운영 배포 환경의 API 키 설정, 실제 고객 세션에서 견적 문의 접수·운영자 답변, 현장 수거 가능 여부 및 개별 견적의 운영 확인.
- 다음 ID: 원격 Supabase 적용 후 관광공사 숙소 견적 문의 실접수·운영 답변 검증.
- 후속 UX 수정(2026-09-30): 숙소 자동완성은 이름 입력 중에만 열고 이름만 표시한다. 주소·예약 가능/견적 구분은 목록에서 제거하고, 등록 숙소를 선택하면 곧바로 출발·도착 노선 선택이 있는 예약 화면으로 이동한다. 홈 검색 제목도 숙소 인계 목적에 맞게 변경했다. 모바일 실화면 확인, lint·typecheck·build 및 숙소 E2E 9개 통과.

**CUS02 내 짐 추적·고객 계정·운영 센터 (2026-09-30)**
- 변경 파일: 고객 `/account`에 예약·문의 목록, 회원가입·이메일 로그인·비밀번호 재설정, `/account/track`에 GPS 이동 시연과 주문별 최근 차량 위치 지도(OpenStreetMap), 주문 상세의 지도 링크를 추가. 홈의 미판매 노선은 숙소 선택 후 견적 문의로 연결. `/admin`은 예약·배송·문의·숙소·회원·제휴 통계 대시보드로 변경하고 예약·고객지원·회원 역할·제휴사 화면 및 API를 추가. 숙소 등록·수정에서 제휴 고객사를 연결. 3언어·Pretendard·모바일 스타일 적용.
- 마이그레이션: `20260930000100_admin_members.sql` — 관리자 전용 회원 목록과 역할 부여·회수 RPC. 본인 관리자 역할 회수와 익명 사용자 역할 부여를 거부하며 기존 감사 기록을 사용. 원격 Supabase에는 미적용.
- 검사와 결과: lint·typecheck·build, 단위 테스트 87개, 전체 로컬 DB 테스트 175개 통과. 신규 고객·관리 E2E 7개 항목은 모두 통과했으나 Playwright의 `pnpm build && next start` Windows 서버 종료 단계가 제한 시간에 걸려 실행 종료 코드는 실패. 기존 실행 중인 서버를 재사용한 계정·관리 2개와 지도 시연 1개 E2E는 종료 코드 0으로 재통과. 모바일·데스크톱 × 라이트·다크, 계정·로그인·가입·지도·운영 진입 20개 캡처에서 HTTP 오류·가로 넘침 0건 확인.
- 연동 모드: 실제 위치가 기록된 주문은 서버 RPC의 최근 차량 좌표·시각을 지도에 표시. 기록이 없을 때는 실제 위치가 아니라는 문구가 붙은 애니메이션 시연만 표시. 회원가입·관리자 쓰기는 원격 Supabase 마이그레이션 및 Auth 설정 후 실증 필요. 결제는 기존 mock 상태.
- 미검증: 원격 Supabase에 신규 마이그레이션 적용, 회원 확인 이메일·비밀번호 복구와 익명 예약 계정 전환, 관리자 실제 계정에서 역할·제휴·숙소 변경, 실제 차량 단말 좌표·실주문 지도 시각 검수.
- 다음 ID: 원격 개발 DB 적용·관리자 계정 실로그인·실주문 GPS 기록 검증 후 현장 PWA·위챗 실기기 검수.

**UI03 페이지별 시각 검수 규칙·공개 화면 점검 (2026-09-30)**
- 변경 파일: 이 문서의 실행 규칙 8–10, `scripts/visual-audit.mjs`, 고객 숙소·가이드·약관·계정·주문·문의 화면 및 다국어 도움말 문구, `editorial-theme.css`.
- 마이그레이션: 없음.
- 검사와 결과: 타입 검사·린트·빌드 통과. 한국어 공개 화면 33개를 390px 모바일과 1280px 데스크톱에서 확인했고, 수정한 5개 화면은 라이트·다크 양쪽에서 다시 캡처했다. 첫 화면 이미지 지연 표시와 다크 테마 계정 카드 대비 문제를 찾아 수정했다. 존재하지 않는 모의 결제 ID의 404는 예상 결과다.
- 연동 모드: fixture 합성 데이터. 이미지·문구·레이아웃 검수이며 실결제·실주문 검증은 아님.
- 미검증: 원격 업무 계정이 없어 인증 후 기사·호텔·관리자 데이터 화면은 시각 검수를 끝내지 못했다. 중국어·영어 전체 페이지, 실제 주문·문의 데이터 상태도 추가 검수가 필요하다. 가이드·약관의 `[예시]` 문구는 운영 승인 콘텐츠가 없어 유지한다.
- 다음 ID: 원격 개발 DB와 역할 계정 연결 후 업무 화면 및 3언어 실데이터 상태를 페이지별 검수.

**CUS03 숙소 자동완성 목록 복구 (2026-09-30)**
- 변경 파일: `apps/web/src/server/tour-stays.ts`, `tour-stays-snapshot.json`. 한국관광공사 공개 숙박 API에서 제주 숙소 212건을 확인하고, 외부 API가 실패하거나 키가 없을 때 서버가 해당 공개 숙소명 스냅샷을 사용한다. 인증키는 스냅샷에 저장하지 않았다.
- 마이그레이션: 없음.
- 검사와 결과: API 직접 응답 200·212건, 로컬 `/api/v1/tour-stays` 200·212건, `/ko/hotels` 모바일에서 `호텔` 입력 시 자동완성 78건 표시 확인. 타입 검사·린트·빌드 통과.
- 연동 모드: 관광공사 API 우선, 호출 실패 시 2026-09-30 공개 목록 스냅샷 사용. 숙소별 제휴·판매 가능 여부는 별도 운영 설정이다.
- 미검증: 배포 서버의 외부 API 연결성 및 정기 스냅샷 갱신.
- 다음 ID: 운영 환경에서 API 연결 확인과 숙소 스냅샷 갱신 작업 연결.

**CUS04 실제 지도 기반 GPS 시연 (2026-09-30)**
- 변경 파일: `components/account/{tracking-map,real-map}.tsx`, `app/editorial-theme.css`, `tests/e2e/tracking.spec.ts`. SVG 섬 그림을 실제 OpenStreetMap 지도 타일로 바꾸고, 시연 경로·깜빡이는 경유 점·이동 마커·일시정지·처음부터를 지도 위에 표시한다. 실주문은 저장된 차량 최근 좌표를 같은 지도에 표시한다.
- 마이그레이션: 없음.
- 검사와 결과: 타입 검사·린트·빌드 통과, 추적 화면 E2E 1개 통과. 네트워크 허용 브라우저에서 모바일 9/9·데스크톱 21/21 지도 타일 로드, 마커 이동·일시정지, 가로 넘침 없음 확인. 모바일 다크 테마의 제목·버튼 대비를 수정 후 다시 캡처했다.
- 연동 모드: 지도는 OpenStreetMap 표준 타일, 시연 경로는 가상 좌표이며 실제 차량 위치와 구분 표시. 실제 위치는 기존 서버 기록을 사용한다.
- 미검증: 실주문·차량 좌표 데이터가 있는 계정에서의 실화면, 위챗 내장 브라우저 실기기, 장기 운영 트래픽에서의 지도 타일 공급 방식.
- 다음 ID: 실주문 차량 좌표와 현장 실기기 시각 검수.

**OPS-A1/A4/A5/A8·PAY-4 운영 도구 보강 (2026-09-30)**
- 변경 파일: `/admin/operations`(권역·노선별 요금 기간·슬롯/용량 생성과 상태 변경), `/admin/hotels`(한국어 기본 정보와 중국어·영어 검색명·별칭·인계 안내 편집), `/admin/content`(초안·검토·게시/보관), `/admin/refunds`(재무 승인·거절·실행 상태), 각 API 및 관리 내비게이션. 숙소 자동완성은 입력 중 검색명만 펼치고 미등록 숙소는 개별 견적 문의로 연결한다.
- 마이그레이션: `20260930000200_function_execute_grants.sql`(SECURITY DEFINER 함수 실행 권한 제한), `20260930000300_required_content_shells.sql`(실제 문구 없는 필수 안내 초안), `20260930000400_public_catalog_policy_split.sql`(비로그인 공개 조회 정책과 직원 조회 정책 분리), `20260930000500_refund_review.sql`(재무 주문 참조 조회·환불 거절 사유/감사 기록). 네 변경 모두 원격 개발 Supabase에 적용. 초기의 함수 권한 제한으로 깨진 직접 `create_order` DB 테스트는 실제 웹앱이 쓰는 `create_order_with_attribution` 경로로 수정했고, 비로그인 RLS는 권한 재확대 없이 정책을 분리했다.
- 검사와 결과: lint·typecheck 통과, 단위 테스트 87개, 로컬 DB 테스트 176개 통과(환불 거절 권한·멱등·주문 유지 포함). 관리 화면의 비인가 접근 E2E 2개는 통과 출력 확인; Windows Playwright 서버 종료 단계가 멈춰 종료 코드는 확보하지 못했다. 관리자 로그인 상태의 생성·편집 UI와 재무 실제 계정은 아직 검증하지 못했다.
- 연동 모드: 결제 mock, 콘텐츠는 승인 문구 미게시, 현장 알림은 outbox 기록만. 실제 PG 환불·실고객 연락 발송 증거가 아니다.
- 미해결: 실제 관리자 이메일·업무 계정 역할 부여, 승인된 짐 규격·금지 품목·취소/보상 문구와 번역, PG 계약 정보, 인증 후 화면 실기 검수. 남은 작업은 `TODO.md` 참조.
- 다음 ID: OPS-A2 공항 인계 장소 버전·사진·알림 작업, PAY-5 운영 확인 큐.

**OPS-A2/A3/A6·FLD-1~6·PAY-5 일부·GRW-2/3 추가 (2026-10-01)**
- 변경 파일: `/admin/handoffs`(공항 인계 장소 버전·번역·비공개 사진과 주문 상세 안내), `/admin/partner-rules`(제휴 코드·수수료), `/admin/members` 초대, `/partner/tags` 태그 인쇄·재발급, `/driver` 작업 오프라인 사본·실제 차량 이동 지도·반환 완료, `/admin/dispatch/[id]` 반환 지시·원 이벤트 정정, `/admin/payment-reviews` 공급사 재조회, `/admin/metrics` 현장 품질·알림 실패, 사진 보존 삭제·일별 지표 집계 스케줄러, 3언어 OG 이미지. 기존 기능의 권한·경로는 유지한다.
- 마이그레이션: `20260930000600_partner_rule_finance_visibility.sql`, `20260930000700_bag_tag_reissue.sql`, `20260930000800_handoff_location_notice.sql`, `20260930000900_bag_correction.sql`, `20260930001000_analytics_daily_quality.sql`을 원격 개발 Supabase에 적용. 인계 장소 변경은 고객 주문별 outbox를 만들지만 실제 고객 채널 발송은 CUS-4 전까지 하지 않는다. 정정은 원본 이벤트를 보존하고 DB에서 역할·버전·비종결 상태를 검사한다.
- 검사와 결과: lint·typecheck·build 통과, 단위 테스트 87개, 로컬 DB 테스트 181개(일별 집계 권한·현장 지표·태그 재발급·정정 포함), 비인가 관리 화면/API E2E 2개 종료 코드 0. OG 파일과 로컬 `/ko`, 관리 진입, OG URL HTTP 200 확인. 실제 관리자·기사·호텔 세션에서 변경 화면을 검증하지 못했다.
- 연동 모드: 개발용 Supabase 마이그레이션 적용, 결제 mock. 직원 초대 메일·현장 사진 Storage·Vercel cron·차량 단말·실고객 알림은 실제 계정/서비스에서 미검증. 결제 확인 버튼은 PG 조회 결과만 기록하며 결제 성공을 수동 입력하지 않는다.
- 미해결: `TODO.md`의 OPS-A7, CUS-1~4, PAY-1~3/5~7, GRW-1/4. 승인된 고객 안내·번역, 관리자 이메일, PG/위챗/알리페이 공급사 정보가 필요하다. 재무 부분 환불 수수료 규칙은 사용자 선택 대기. 미니프로그램·PWA·메일·실결제·업무자 실기기 증거가 필요하다.
- 다음 ID: 관리자 실계정 및 3언어 콘텐츠 확인, PAY-5 예외 해소·PAY-6 정책 확정, 남은 계정/결제/알림 연동.

**OPS-A7 업무자 TOTP (2026-10-01)**
- 변경 파일: `server/auth.ts`에서 민감 역할의 인증 수준을 확인하고 AAL1 세션의 해당 역할을 서버 권한 목록에서 제외, `components/staff-mfa.tsx`에 인증 앱 등록·6자리 검증 화면, `StaffGate` 업무 접근 안내.
- 마이그레이션: `20260930001100_sensitive_staff_mfa.sql` — DB `has_role()`에서 admin·finance·dispatcher 권한은 JWT AAL2일 때만 인정한다. 원격 개발 Supabase 적용.
- 검사와 결과: lint·typecheck·build, 단위 테스트 87개, 로컬 DB 테스트 182개 통과(AAL1 관리자 거절, AAL2 관리자 허용, 일반 기사 역할 유지), 전체 브라우저 E2E 123개 종료 코드 0. 실제 TOTP 등록·검증은 업무 계정과 Supabase Auth MFA 설정 확인 후 실증 필요.
- 연동 모드: Supabase Auth TOTP. 개발 프로젝트 공개 `/auth/v1/settings`는 MFA 설정을 노출하지 않아 등록 가능 여부는 확인하지 못했다. 인증 앱 분실 시 운영 절차가 필요하다.
- 미해결: 실제 관리자 이메일 계정으로 초대·비밀번호 설정·TOTP 등록·업무 API 접근 확인.
- 다음 ID: OPS-A7 실계정 검수, CUS-1~4·PAY-1~3.

**PAY-7 정산 PDF·GRW-1 홈 실험 (2026-10-01)**
- 변경 파일: `server/settlement-pdf.ts`, `/api/v1/settlements/[id]/statement`, `/admin/settlements` 다운로드, Pretendard 고정 글꼴, 홈 A/B 문구·버튼과 세션 쿠키, 주문 유입 귀속의 실험 기록, 관련 브라우저·DB 테스트.
- 마이그레이션: `20261001000100_order_experiment.sql` — 허용된 A/B 버전·세션 ID를 주문 귀속에 추가 전용으로 한 번만 저장한다. 로컬 DB와 원격 개발 프로젝트에 적용했고, 원격 컬럼 3개를 조회해 확인했다(프로젝트 목록에는 표시되지 않으나 ID 직접 호출은 성공).
- 검사와 결과: lint·typecheck·build 통과, 단위 테스트 87개, 로컬 DB 테스트 183개 통과. 전체 E2E 첫 실행은 무작위 실험 버전으로 기존 고정 문구 검사 1개가 실패해 검사를 A버전으로 고정했다. 재실행 전체 E2E 124개 통과. 정산 샘플 PDF를 Poppler로 렌더링해 한글·금액·항목 표시 확인. 관리자/제휴사 로그인 상태에서의 PDF 다운로드는 실계정 없이 미검증.
- 연동 모드: PDF는 서버 생성, 실험은 로컬/서버 쿠키와 DB 함수. 외부 결제·메일은 여전히 mock/미연동.
- 미해결: 실제 재무/제휴 계정의 다운로드 확인, CUS-1~4·PAY-1~3/5~6·GRW-4 및 실기기 검증. 할인·부분 환불·보존 규칙에 대한 사업 결정, 관리자 이메일과 공급사 설정이 필요하다.
- 다음 ID: CUS-3 정책 확정 후 할인 구현, 실계정 검수.

**관광공사 숙소 견적 문의 실패 복구 (2026-10-01)**
- 증상: `/ko/hotels?stay=2707417&route=airport_to_hotel`의 견적 요청이 일반 실패 문구를 표시했다.
- 원인: 로컬 `:3400` 미리보기 서버가 외부 접속이 제한된 실행 환경에서 시작돼 Supabase Auth 비회원 로그인 호출이 `EACCES`로 실패했다. 동일 서버의 `/api/v1/sessions/guest`가 503을 반환했다. Supabase 공개 Auth 설정은 네트워크 허용 환경에서 HTTP 200이었다.
- 조치와 검증: 미리보기 서버를 네트워크 접속 가능 환경으로 재시작하고 비회원 세션 201, 합성 고객 문의 저장 201을 확인했다. `tests/e2e/live-inquiry.spec.ts`에 외부 개발 DB를 사용하는 명시적 opt-in 화면 검사를 추가했다. 같은 숙소 ID·노선에서 입력→제출→고객 문의 페이지 이동을 모바일 브라우저로 확인(1/1 통과). 일반 E2E에서는 이 검사를 건너뛰어 외부 DB 의존성을 만들지 않는다.
- 연동 모드: 로컬 미리보기 `:3400`은 현재 `PUBLIC_DATA_SOURCE=fixture`와 실 Supabase Auth/문의 DB 조합. 테스트 문의에는 `test@example.invalid`만 썼다. 서버를 재시작할 때 외부 접속이 제한되면 같은 503이 다시 발생하므로 실행 환경을 확인해야 한다.

**숙소→숙소 견적 필드·일시 보강 (2026-10-01)**
- 변경 파일: `components/stay-search.tsx`(노선에 따라 선택 숙소를 출발/도착으로 표시, 숙소→숙소 도착 숙소 자동완성·직접 입력, 수거/전달 `datetime-local` 필수, 동일 숙소·역순/지난 일시 거부, 문의 본문에 두 숙소 식별값과 KST 일시 구분 저장), `app/editorial-theme.css`, `tests/e2e/{hotels,live-inquiry}.spec.ts`.
- 마이그레이션: 없음. 기존 고객 문의 저장 기능을 사용하며 실제 예약/가격 확정은 하지 않는다.
- 검사와 결과: lint·typecheck·build 통과, 숙소 화면 모바일 E2E 10개, 외부 개발 DB를 쓰는 opt-in 문의 제출 E2E 2개 통과. `stay=4058390&route=hotel_to_hotel`에서 별도 도착 숙소와 두 일시가 고객 문의 내역에 저장됨을 확인. 390px 화면 캡처 `docs/visual-audit/stay-to-stay-form.png`에서 입력 배치 확인.
- 연동 모드: 관광공사 숙소 목록 + Supabase Auth/문의 DB. 고객이 입력한 희망 시각은 한국 시간(KST)으로 안내하고 저장한다. 실제 판매 슬롯·확정 시간과 구분된다.

**예약 화면 통합·디자인 보강 (2026-10-01)**
- 변경 파일: `/{locale}/luggage/book`에 숙소 자동완성·세 노선·예약 단계·짐 수량·수거/전달 일시·요약을 통합했다. 상단 단독 `숙소` 메뉴를 `예약`으로 교체하고 홈·가이드·계정·호텔 QR의 예약 진입을 연결했다. 기존 `/hotels` 목록 URL은 예약 화면으로 리디렉션한다. 즉시 예약 가능한 등록 숙소에는 기존 슬롯/견적/결제 기능을 유지하며 요약 패널을 추가했다. 관광공사·미등록 숙소는 크기별 S/M/L 수량과 두 시각이 포함된 견적 문의를 보낸다.
- 마이그레이션: 없음. 판매 가능 여부와 가격은 기존 서버 규칙을 사용한다. 문의의 표시 요금은 가짜 금액 없이 확인 후 안내로 표시한다.
- 검사와 결과: lint·typecheck·build 통과. 전체 E2E 127개 통과·외부 DB opt-in 2개 기본 건너뜀. 별도 opt-in 실행에서 외부 개발 Supabase 문의 저장 E2E 2개 통과. 첫 전체 E2E에서 변경 전 `/hotels` URL을 기대하던 검사 3개가 실패했고 수정 후 재실행 전체 통과. 화면 캡처: `docs/visual-audit/booking-mobile-inquiry.png`, `booking-desktop-registered.png`.
- 연동 모드: 등록 숙소 온라인 예약은 기존 mock PG, 미등록 숙소 견적 문의는 개발 Supabase Auth/문의 DB. 실제 배송 요금·가능 시간은 견적 문의 접수만으로 확정하지 않는다.
- 미해결: 실판매 등록 숙소에서 고객 정책 승인·운영 슬롯을 채운 뒤 전체 결제 여정을 실계정으로 확인해야 한다. 관광공사 목록 장애 시 등록 숙소·직접 이름 입력으로 문의하도록 안내한다.

**수하물 이용방법 시각화 (2026-10-01)**
- 변경 파일: `/{locale}/luggage`의 이용방법에서 게시된 번호 문장을 단계별 카드로 표시하고, 사진·제목·단계 수·예시 표시·예약 진입 버튼의 시각적 우선순위를 정리했다. 번호 형식이 아닌 운영 콘텐츠는 기존 `ContentView`로 안전하게 표시한다. 한국어·중국어·영어와 모바일·데스크톱·다크 테마를 적용했다.
- 마이그레이션: 없음. CMS의 승인된 본문을 그대로 사용하며 배송 절차를 새로 확정하지 않는다.
- 검사와 결과: lint·typecheck·build 통과, 이용방법 단계·필수 안내·레이아웃 모바일 E2E 21개 통과. `docs/visual-audit/how-it-works-{desktop,mobile,mobile-dark}.png` 화면 확인.
- 연동 모드: 기존 공개 콘텐츠 소스. 예시 문구는 실제 운영 승인 전에 교체해야 한다.

**상황별 가이드 페이지 재디자인 (2026-10-01)**
- 변경 파일: `/{locale}/guide/[slug]`를 문장 카드 한 장에서 사진·제목이 함께 읽히는 히어로, 노선별 짐 인계 흐름, 예약 행동, 다른 여행 상황 카드로 개편했다. `ContentView`의 게시 문구·대체 언어 표시와 기존 캠페인 귀속·노선별 CTA 경로를 유지한다. `guide.cta`의 3언어 문구도 별도 숙소 검색을 암시하지 않는 '짐 배송 예약하기'로 바꿨다. 모바일 긴 제목의 고아 줄바꿈을 줄였다. 한국어·중국어·영어, 모바일·데스크톱·다크 테마의 공통 스타일을 `editorial-theme.css`에 적용했다.
- 마이그레이션: 없음. 실제 인계 시간·장소는 예약 화면의 운영 설정에서 확인하도록 안내하고, 예시 콘텐츠를 실운영 약속으로 표시하지 않는다.
- 검사와 결과: lint·typecheck·build 통과, 가이드/유입/모바일 레이아웃 E2E 33개 통과(중국어 가이드 가로 넘침 포함). 도착·체크아웃·숙소 이동·모바일 다크 화면을 각각 캡처하여 `docs/visual-audit/guide-*.png`에서 확인했다.
- 연동 모드: 기존 공개 CMS. 실제 승인 콘텐츠가 부족한 경우에도 게시된 원문을 중심에 놓되 운영 문구 보강이 필요하다.

**UI05 트래블 앱 스타일 전면 적용·SIM01 전체 과정 시뮬레이션 (2026-10-01)**
- 변경 파일: 홈 `app/[locale]/(customer)/page.tsx` 재구성, `app/playful-home.css`(홈), `app/playful-theme.css`(고객 화면 공통: 크림 배경·코랄/하늘/민트 포인트·둥근 카드·알약 버튼·떠 있는 하단 탭, 업무 화면은 남색/파랑 색만), `app/demo.css`, `components/demo/{journey-simulator,demo-copy,demo-entry}.tsx`, `/{locale}/demo`(noindex), 예약 차단·견적/주문 오류·계정(예약 없음)·홈·업무 로그인 화면에 시뮬레이션 진입 안내, `scripts/visual-audit.mjs`(대비·잘림·작은 터치 영역·[예시] 문구 자동 검사, 파일 잠금 재시도, 중국어·영어·시뮬레이션 경로 추가), `tests/e2e/hotels.spec.ts` 선택자.
- 시뮬레이션: 서버·DB·PG·알림을 호출하지 않고 브라우저 안에서만 진행(localStorage). 노선 3종·슬롯·짐 수량·항공편 → 서버 규칙과 같은 예시 요금(15,000/20,000원, 부가세 포함 표시)·예시 쿠폰 WELCOME10 → 연락처(한국 번호 불필요)·[예시] 필수 안내 동의 → 위챗페이/알리페이/카드 모의 결제(서버 확인 대기 연출) → 예약증(짐별 태그 QR, 개인정보 없음) → 고객/호텔/기사/운영 역할 전환: 호텔 보관 → 기사 QR·사진 수거 → 실제 지도 위 이동 → 수령 코드 발급·검증 → 완료. 고객 알림 미리보기(CUS-4), 다른 기기 코드 복구(CUS-1), 지연 보고, 수거 전 취소→재무 환불 승인, 자동 진행. 화면 전체에 “시뮬레이션 · 실제 예약·결제·알림 아님” 표시.
- 마이그레이션: 없음. 실제 예약·결제·권한 로직은 변경하지 않음.
- 확인한 차단 원인: 원격 개발 DB에서 견적은 성공(15,000원)하지만 주문은 `POLICY_ACCEPTANCE_REQUIRED`(승인 필수 안내 미게시), 결제 확정은 `SUPABASE_SERVER_SECRET` 미설정. `PUBLIC_DATA_SOURCE=fixture` 서버(:3400)는 화면 슬롯이 합성 ID라 원격 DB 견적이 `SLOT_NOT_FOUND` — 이 경우 오류 아래 시뮬레이션 안내가 표시된다.
- 검사와 결과: typecheck·lint·build 통과, 단위 테스트 87개 통과, 전체 E2E 133개 중 130 통과·2 skip·1 실패(홈 하단 여백 제거로 하단 탭이 테마 선택을 가림) → 수정 후 해당 customer·layout E2E 37개 통과. 시각 전수조사 39경로 × 모바일/데스크톱 × 라이트/다크 156화면: 1차 120화면 경고 → 색 대비(코랄 버튼 #cc4424, 보조 글자 #56617c, 주색 #1f5fd6, 민트 #0f7d63, 다크 로그인 링크, 추적 카드) 수정 후 남은 경고는 사진 위 제목(검사 도구가 이미지 배경을 판정 못 함)과 OpenStreetMap 표기 링크. 가로 넘침 0. Supabase 모드에서 guide·legal 404와 FAQ 빈 상태는 게시 콘텐츠 부재 때문.
- 연동 모드: 변경 없음(mock). 시뮬레이션 결과는 실주문·실결제·실알림 증거가 아니다.
- 미해결(사용자 제공·결정 필요): 승인된 필수 안내 3개 언어 게시, `SUPABASE_SERVER_SECRET`, 업무 계정, PG·위챗·알리페이·이메일 공급사, 쿠폰·할인 규칙(CUS-3), 부분 환불 수수료(PAY-6), 계정 삭제 시 거래 보존 기간(CUS-2), 운영 `APP_URL`(sitemap이 localhost로 출력). 이모지 아이콘의 SVG 교체, 영문 둥근 제목 폰트는 미적용.
- 다음 ID: 필수 안내 게시 후 실제 예약 완주 검증, CUS-2 보존 정책 결정.

**UI06 고객 내부 페이지 개별 재디자인·SIM02 막힌 흐름의 화면 내 시뮬레이션 (2026-10-01)**
- 변경 파일: `components/pf-hero.tsx`(파스텔 머리 영역·스티커 칩·기울어진 사진/이모지), 서비스 안내·숙소 상세·예약·고객지원·마이페이지·GPS 추적·가이드·약관·로그인/가입 화면 구조 수정, `app/pages.css`, `components/demo/{staff-simulation,sim-booking-card}.tsx`, 시뮬레이터에 숙소 검색(등록 숙소 + 관광공사 숙소)·항공권 검색형 카드·요금 티켓 요약·예약 화면 임베드 모드, `server/content.ts`(운영이 아닌 환경에서 DB 게시본이 없으면 `[예시]` 합성 콘텐츠 표시, 예약 필수 안내 판정은 `strict`로 실제 게시본만), `staff-gate.tsx`(비로그인 시 로그인 아래 업무 시뮬레이션), `scripts/visual-audit.mjs` 경로 추가.
- 동작: 예약 화면에서 실제 예약이 막히면(필수 안내 미게시) 같은 화면에서 시뮬레이션 예약이 이어지고, 미등록 숙소 실제 견적 문의는 그대로 유지. `/driver` 작업 진행, `/partner` 보관·도착 인수·QR 포스터, `/admin` 지표·배차 변경·지연 보고·환불 승인/거절·문의 답변·정산 지급 처리를 시뮬레이션 데이터로 조작 가능. 마이페이지는 이 브라우저의 시뮬레이션 예약 진행 상태를 표시. 모든 시뮬레이션은 서버·DB를 호출하지 않으며 화면에 표시한다.
- 마이그레이션: 없음.
- 검사와 결과: typecheck·lint·build 통과, 단위 테스트 87개, 전체 E2E 131 통과·2 skip(종료 코드 0). 시각 전수조사 46경로 184화면 → 대비·겹침 수정 후 재검사 대상 28화면 경고 0, 전체 가로 넘침 0. 숙소 상세 정보 카드 좌측 붙음·노선 카드 겹침, Windows에서 렌더되지 않는 이모지(🪪)를 캡처로 찾아 수정. 남은 경고는 OpenStreetMap 저작권 표기 링크 크기.
- 연동 모드: 변경 없음(mock). 시뮬레이션과 `[예시]` 콘텐츠는 실제 예약·결제·승인 문구가 아니다.
- 미검증: 실주문 예약증·주문 상세(실데이터 필요) 화면은 CSS만 적용, 위챗 내장 브라우저·실기기.
- 다음 ID: 필수 안내 승인본 게시·서버 비밀키 설정 후 실제 예약 완주 검증.

**POL01 필수 안내 4종 게시·CUS-3 쿠폰·운영 규칙 v1 (2026-10-01)**
- 결정: 사용자가 필수 안내 문구와 사업 규칙을 일반적인 기준으로 정하도록 위임했다. 내용은 `docs/06` 8-1절 “운영 규칙 v1”. 법률·보험 검토 후 버전을 올려 재게시한다.
- 변경 파일: `supabase/migrations/20261001000200_policies_and_coupons.sql`(짐 규격·금지 품목·취소/환불·파손/분실 보상 × ko/zh-CN/en 게시, `required_policy_slugs` 4종, `booking_settings.min_charge_minor`, `coupons`, `quotes.coupon_id`, `apply_quote_coupon()`), `supabase/seed.sql`(개발용 `WELCOME10`), `supabase/tests/coupons.test.ts`, 기존 DB 테스트의 필수 안내 목록·영어 게시 가정 수정, `/api/v1/quotes/[id]/coupon`, `server/quote-dto.ts`, 쿠폰 오류 코드 3개와 3언어 문구, 예약 화면 쿠폰 입력·할인 표시, 예약·서비스 화면 필수 안내 4종, fixture 필수 안내를 마이그레이션과 같은 문구로 교체(중국어 금지 품목은 차단 검사용으로 fixture에서만 제외), 시뮬레이션 안내·쿠폰 규칙 동기화.
- 검사와 결과: typecheck·lint·build 통과, 단위 87, DB 190(쿠폰 7개 신규: 부가세 재계산, 최대 할인·최소 결제, 해제, 무효·중지·노선 제한·최소 주문, 소유자만, 주문 반영·1인 한도, 고객 조회 차단), E2E 131 통과·2 skip.
- 연동 모드: 원격 개발 DB 미적용 — 이 세션의 Supabase 연결에 프로젝트 권한이 없어 적용하지 못했다. 적용 전까지 원격 모드 예약은 계속 시뮬레이션으로 이어진다.
- 미해결: 원격 적용과 실제 예약 완주 확인, 마감 후 50% 환불(부분 환불 기능), 부분 환불 수수료 재계산 적용, 계정 삭제(CUS-2) 함수·화면, 쿠폰 관리 화면.
- 다음 ID: 마이그레이션 원격 적용 → 실예약 완주 검증, CUS-2.

**UI07 이용 미리보기 (2026-10-01)**
- 설계 확인: `/luggage`는 docs/02에서 “세 가지 노선, 짐 규격·금지 품목·보상” 안내 페이지로 정의됐고, 상단 메뉴 ‘배송 노선’은 커밋 248f72a에서 홈 섹션 제목 키를 재사용해 추가된 것이었다(문서 미반영). 사용자 결정으로 메뉴를 **이용 미리보기**(`nav.preview`: 이용 미리보기/服务预览/Preview)로 바꾸고 docs/02 메뉴 정의를 갱신했다.
- 변경 파일: `components/demo/preview-journey.tsx`(상황 3가지 탭 → 예시 값 입력 → 요금·필수 안내 4종 → 위챗페이/알리페이 모의 결제 → 예약 완료·짐 태그 QR → 내 짐 추적(지도·타임라인) → 짐 찾기(공항 수령 코드 또는 숙소 프런트 QR, 짐별 확인) → 실제 예약·업무 화면 연결), `/luggage` 페이지 상단 교체(노선 목록 섹션 제거, 필수 안내 `#required-notices` 유지), `app/preview.css`, `tests/e2e/preview.spec.ts`, `public-content.spec.ts` 제목 기대값.
- 검사와 결과: build 통과, 미리보기 페이지 3언어 × 모바일/데스크톱 × 라이트/다크 12화면 경고 0, 전체 E2E 132 통과 후 제목 기대값 1건 수정 → 해당 13개 재통과.
- 연동 모드: 서버·DB 호출 없음. 공항 수령 장소는 예시로 표시.

문서 수정은 제품 코드·결제 연동·배포가 완료됐다는 뜻이 아니다. 구현 기록 형식: `작업 ID / 변경 파일 / 마이그레이션 / 검사와 결과 / 연동 모드 / 미해결 사항 / 다음 ID`.

## 9. 다음 실행 프롬프트

> 이 프로젝트의 AGENTS.md와 docs/01~05, 09를 읽고 단계 A를 구현하라. 중국인 관광객 대상 제주 수하물 플랫폼의 화면과 업무만 만들고, 중국어 간체를 고객 기본 언어로 사용하라. 외부 계약은 준비됐다고 가정하되 비밀값은 설정으로 주입하고, 없는 값은 mock 어댑터로 처리하라. 검사 결과와 실제 연동 상태를 기록하고 진행 표를 갱신하라.

## 10. 근거

[Codex의 AGENTS.md 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md)에 따라 이 파일을 진입점으로 쓰고 상세 지침은 관련 docs에서 읽는다. 시장·기술·정책 근거는 해당 상세 문서에 출처와 확인일을 표시한다.
