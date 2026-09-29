# 제주 중국인 관광객 수하물 플랫폼 — Codex 메인 오케스트레이션

문서 버전: 2.0 · 수정일: 2026-09-29 · 상태: 구현 명세 작성, 제품 코드 미착수

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

문서의 기준 충돌은 해당 책임 문서를 먼저 수정한다. 상태·데이터는 05~07, API는 04가 기준이다. URL·고객 행동은 02가 기준이다.

## 4. 구현 대상 구조

현재는 문서만 존재한다. 아래 경로는 코드 개발 때 생성한다.

```text
jeju-unified-platform/
  AGENTS.md
  docs/                         # 상세 구현 문서 9개
  apps/
    web/                        # 공개 예약 + 기사·호텔·운영 화면(PWA)
    wechat/                     # WeChat Mini Program 하이브리드 셸(D단계)
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
| B | B01–B03 완료 (2026-09-29) | B04 결제·환불(mock PG) → B05 예약증 |
| C | 미착수 | B의 주문·짐 모델 필요 |
| D | 미착수 | B·C 업무 기록 재사용. 미니프로그램 계정·위챗페이 가맹은 A부터 병행 준비 |
| E | 미착수 | C의 현장 운영 데이터 필요 |

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

문서 수정은 제품 코드·결제 연동·배포가 완료됐다는 뜻이 아니다. 구현 기록 형식: `작업 ID / 변경 파일 / 마이그레이션 / 검사와 결과 / 연동 모드 / 미해결 사항 / 다음 ID`.

## 9. 다음 실행 프롬프트

> 이 프로젝트의 AGENTS.md와 docs/01~05, 09를 읽고 단계 A를 구현하라. 중국인 관광객 대상 제주 수하물 플랫폼의 화면과 업무만 만들고, 중국어 간체를 고객 기본 언어로 사용하라. 외부 계약은 준비됐다고 가정하되 비밀값은 설정으로 주입하고, 없는 값은 mock 어댑터로 처리하라. 검사 결과와 실제 연동 상태를 기록하고 진행 표를 갱신하라.

## 10. 근거

[Codex의 AGENTS.md 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md)에 따라 이 파일을 진입점으로 쓰고 상세 지침은 관련 docs에서 읽는다. 시장·기술·정책 근거는 해당 상세 문서에 출처와 확인일을 표시한다.
