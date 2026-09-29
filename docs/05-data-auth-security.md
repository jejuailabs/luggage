# 05. 수하물 주문 데이터·인증·권한·정보 보호

연결: [메인](../AGENTS.md), [API](04-architecture-integrations.md), [거래](06-booking-payments-settlement.md), [현장](07-logistics-tracking-operations.md)

## 1. 기준 원칙

PostgreSQL을 예약·결제·수하물·인계의 기준 저장소로 사용한다. 모든 업무 테이블은 UUID 기본키, 생성·변경 시각, 필요한 상태 버전을 가진다. 이벤트 시각은 UTC `timestamptz`, 운영 날짜·컷오프는 Asia/Seoul 기준이다. 금액은 통화 최소 단위 정수로 저장한다.

공개 호텔·안내 데이터와 개인 주문·금융·사진·차량 위치 데이터를 분리한다. 브라우저에 보이는 ID는 비밀이 아니며, 조회마다 소유권·배정·호텔 범위를 검사한다. Supabase의 노출 스키마는 grants와 RLS를 모두 설정한다.

## 2. 계정·호텔·운영 설정

| 테이블 | 필수 필드·관계 | 제약 |
|---|---|---|
| `profiles` | user_id→auth.users, 표시명, locale, theme | 사용자가 역할을 직접 수정 불가 |
| `contact_channels` | user_id, type, 암호화 연락값, verified_at | 입력과 소유 확인 분리 |
| `role_assignments` | user_id, role, scope_type, scope_id | 서버 관리, 역할·범위 유일 |
| `hotel_partners` | 이름, 계약·정산 설정 참조, 상태 | 실제 계약값 주입 |
| `hotel_members` | hotel_id, user_id, permissions | 소속 호텔 범위 |
| `hotels` | partner_id, 한국어 원명, 주소, zone_id, 지점 상태 | 동일 명칭 다른 지점 구분 |
| `hotel_translations` | hotel_id, locale, 이름·별칭·안내 | hotel+locale 유일 |
| `service_zones` | 권역 경계·표시명·상태 | 판매 가능 지역 |
| `handoff_locations` | 유형, 층·출구·좌표·사진, 유효기간 | 공항 인계 장소 버전 |
| `service_slots` | 날짜, 노선 유형, 양 끝 권역, 컷오프, 약속 시간 | 서버 계산 시각 보존 |
| `capacity_buckets` | slot_id, max/held/committed units | 음수·초과 불가 |
| `price_rules` | 노선·권역·짐 규격·유효일·가격 버전 | 소급 변경 방지 |
| `feature_settings` | 기능, 환경, mode, enabled | 미연동 판매 차단 |

## 3. 예약·결제·정산

| 테이블 | 필수 필드·관계 | 제약 |
|---|---|---|
| `quotes` | 소유 세션, 노선·짐 입력 스냅샷, 금액·통화·만료 | 서버 생성·주문시 재검증 |
| `orders` | owner_id, route_type, reservation_status, quote_id, 금액·연락 스냅샷 | 결제·배송 상태와 분리 |
| `order_bags` | order_id, 규격·수량, 가격·세금 스냅샷 | 실제 bags와 수량 정합성 |
| `capacity_holds` | order_id, bucket_id, units, 만료·상태 | held→committed/released 1회 |
| `payment_attempts` | order_id, PG, 외부거래 ID, 금액·상태 | PG+외부 ID 유일 |
| `payment_events` | PG, 이벤트 ID, 원문 해시, 수신·처리 시각 | 중복 처리 차단 |
| `refund_requests` | order_id, 요청액·사유·검토 상태 | 요청·실행 분리 |
| `refunds` | payment_attempt_id, 환불액·PG ID·실행 상태 | 총액 초과 방지 |
| `ledger_entries` | order_id, 금액, 유형, 역분개 참조 | append-only |
| `hotel_commissions` | hotel_id, order_id, 계약 규칙 스냅샷, 금액 | 확정·환불 반영 |
| `settlement_batches/items` | 호텔·기간·원장 항목·지급 참조 | 항목 이중 지급 방지 |
| `policy_acceptances` | 정책 ID·버전·언어·주문·동의 시각 | 결제 당시 문구 보존 |

`orders.reservation_status`는 draft, held, confirmed, cancelled, expired, needs_review 중 하나다. 결제·환불 상태는 각 테이블에서 계산하고 주문의 단일 status 문자열에 합치지 않는다.

## 4. 수하물·작업·증빙

| 테이블 | 필수 필드·관계 | 제약 |
|---|---|---|
| `bags` | order_id, 무작위 tag_id, 크기, bag_status, version | 짐 1개당 1행, 태그 유일 |
| `delivery_jobs` | order_id, 출발·도착 지점, 약속 시각, 상태 | 노선당 작업 |
| `routes` | driver_id, vehicle_id, 날짜, 상태 | 배차 버전 |
| `route_stops` | route_id, 위치, 순서, 시간창 | 변경 이력 |
| `job_assignments` | job_id, driver_id, 배정·해제 시각 | 현재 담당자 도출 |
| `bag_events` | bag_id, actor, event_type, 발생·서버수신 시각, client_event_id | append-only, 재전송 중복 차단 |
| `handoff_challenges` | order_id, 대상 bag_ids, code_hash, 만료·시도·소비 | 원자적 단일 사용 |
| `evidence_files` | order_id, bag_id, 비공개 storage_key, 목적·보존 | 접근 권한 검사 |
| `vehicle_locations` | route_id, 시각·좌표·정확도·출처 | 활성 배정·짧은 보존 |
| `support_tickets/messages` | order_id, 소유자, 내부/고객 공개 | 메시지 공개 범위 |
| `incidents` | job_id, 유형·심각도·조사·결과 | 배송 상태와 별개 |
| `compensation_claims` | incident_id, 보상·보험 처리 | PG 환불과 별개 |

주문 1:N 짐, 짐 1:N 이벤트, 주문 1:N 결제 시도, 결제 시도 1:N 환불 구조다. 짐을 다른 차량으로 옮겨도 과거 이벤트를 수정하지 않는다.

## 5. 공개 콘텐츠·유입·시스템

`content_entries/translations`: 짐배송 안내, 호텔 이용법, 공항 인계, FAQ, 취소·보상 정책. locale별 승인·게시 상태를 가진다.

`hotel_campaigns/referral_codes/attribution_events`: 호텔 QR·중국어 캠페인과 서버 확정 주문 연결. 개인정보를 분석 이벤트에 직접 넣지 않는다.

`idempotency_keys/outbox_events/job_runs/notification_deliveries/audit_logs/integration_health`: 중복 요청·알림·외부 연동·운영자 변경 기록. 원문 비밀값을 로그에 남기지 않는다.

```sql
CHECK (held_units >= 0 AND committed_units >= 0);
CHECK (held_units + committed_units <= max_units);
UNIQUE (provider, event_id);      -- payment_events
UNIQUE (client_event_id);          -- bag_events
UNIQUE (actor_id, operation, idempotency_key);
```

위 SQL은 불변 조건의 예시다. 실제 마이그레이션에는 열·외래키·인덱스·RLS를 함께 작성한다. 여러 행의 총 환불액 제약은 결제 행을 잠그는 트랜잭션에서 검증한다. 용량도 같은 방식으로 원자적으로 확보한다.

## 6. 역할과 권한

| 역할 | 볼 수 있고 처리할 수 있는 것 | 볼 수 없는 것 |
|---|---|---|
| 공개 방문자 | 공개 호텔·안내·슬롯의 제한된 정보 | 주문·연락처·사진 |
| guest/회원 | 자기 주문·짐·문의·정책 동의 | 다른 고객 주문 |
| 기사 | 현재 배정 작업·필요 최소 인계 정보 | 미배정 주문·금융·다른 고객 이력 |
| 호텔 직원 | 자기 지점의 해당 날짜 주문·보관·인계 | 다른 호텔·결제 상세 |
| support | 배정된 문의·필요 주문 정보 | 정산 계좌 변경 |
| dispatcher | 배차·짐·사고 처리 | 환불 승인·정산 계좌 |
| finance | 결제·환불·호텔 정산 | 불필요한 위치·사진 원문 |
| content_editor | 공개 안내 초안·번역 | 고객 개인정보 |
| admin | 부여된 관리 범위 | 서버 secret 원문 |

운영자 MFA, 중요 변경 감사 기록, 결제·정산 계좌 권한 분리를 적용한다. `profiles` 수정으로 `role_assignments`를 변경할 수 없다. RLS는 직접 DB API 접근과 뷰·Storage 정책까지 점검한다.

## 7. 한국 번호 없는 비회원 예약

guest는 보호된 소유 세션으로 주문을 생성한다. Supabase anonymous auth 또는 동등한 서버 관리 방식 중 A01 검증 결과에 맞춰 선택한다. Supabase DB의 `anon` role과 anonymous auth 사용자를 혼동하지 않는다.

다른 기기에서 복구하려면 검증된 연락 채널로 전달한 단기 코드/링크를 교환한다. 토큰은 해시·만료·단일 사용·시도 제한을 적용한다. 링크의 GET 미리보기만으로 소모하지 않고, 교환 후 URL에서 비밀값을 제거한다. 같은 이메일 문자열만으로 기존 guest 주문을 다른 회원에게 붙이지 않는다.

연락 채널 인증이 어려운 경우 고객지원의 증빙 확인 경로를 둔다. 주문번호+이름만으로 전체 배송 정보·사진을 보여주지 않는다.

## 8. 사진·위치·삭제

사진 업로드는 목적·대상·개수·크기·형식 제한, 실제 파일 유형 검사, EXIF 제거, 비공개 저장을 거친다. storage 경로에 이름·전화·여권번호를 넣지 않는다. 짧게 유효한 접근 링크를 대상 권한 확인 뒤 발급한다.

차량 위치는 활성 배송에 필요한 범위만 보관·표시한다. 기사 개인 위치나 다른 고객 경유지 전체를 고객에게 공개하지 않는다. 위치가 오래됐으면 마지막 관측 시각을 표시한다.

데이터 보존기간은 거래·인계 증빙·위치·고객 문의로 나눠 정책값을 입력한다. 탈퇴는 계정 접근 폐기, 불필요 정보 삭제, 보존 필요 거래 기록의 분리 처리로 구성한다. Supabase DB 백업과 Storage 파일 백업은 별도로 검증한다.

## 9. 테스트와 완료 기준

1. 고객 A는 고객 B의 주문·사진·복구 링크를 읽을 수 없다.
2. 호텔 A는 호텔 B의 보관·인계 명령을 실행할 수 없다.
3. 배정 해제된 기사는 이후 상태 변경·위치 조회를 할 수 없다.
4. 고객이 profile API로 운영자 권한을 얻을 수 없다.
5. 동시 마지막 슬롯·동시 부분환불에도 수량·금액 제약을 지킨다.
6. 직접 Supabase API·뷰·Storage 우회 경로에서도 같은 제한이 적용된다.
7. 계정 삭제 후 이전 세션·복구 링크로 주문에 접근할 수 없다.

## 10. 출처

확인 2026-09-29.

- [Supabase RLS와 grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 공동 책임](https://supabase.com/docs/guides/deployment/shared-responsibility-model)
- [Supabase 백업 범위](https://supabase.com/docs/guides/platform/backups)

테이블·역할·보존 구분은 이 프로젝트의 설계다. 구현 시 실제 SQL과 함께 갱신한다.
