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

문서 수정은 제품 코드·결제 연동·배포가 완료됐다는 뜻이 아니다. 구현 기록 형식: `작업 ID / 변경 파일 / 마이그레이션 / 검사와 결과 / 연동 모드 / 미해결 사항 / 다음 ID`.

## 9. 다음 실행 프롬프트

> 이 프로젝트의 AGENTS.md와 docs/01~05, 09를 읽고 단계 A를 구현하라. 중국인 관광객 대상 제주 수하물 플랫폼의 화면과 업무만 만들고, 중국어 간체를 고객 기본 언어로 사용하라. 외부 계약은 준비됐다고 가정하되 비밀값은 설정으로 주입하고, 없는 값은 mock 어댑터로 처리하라. 검사 결과와 실제 연동 상태를 기록하고 진행 표를 갱신하라.

## 10. 근거

[Codex의 AGENTS.md 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md)에 따라 이 파일을 진입점으로 쓰고 상세 지침은 관련 docs에서 읽는다. 시장·기술·정책 근거는 해당 상세 문서에 출처와 확인일을 표시한다.
