# 위챗 미니프로그램 (하이브리드)

구조는 [04 문서 8절](../../docs/04-architecture-integrations.md)을 따릅니다.
- 예약, 주문 조회, 예약증, 고객지원은 `web-view`로 웹을 그대로 씁니다.
- 결제, 로그인 코드, 구독 메시지 동의만 네이티브 페이지로 처리합니다.

```text
pages/index  web-view → WEB_ORIGIN/zh-CN (또는 ?path=/zh-CN/... 같은 웹 경로)
pages/pay    web-view가 wx.miniProgram.navigateTo로 넘긴 1회용 결제 티켓
             → wx.login code와 함께 POST /api/v1/wechat/pay-tickets/redeem
             → wx.requestPayment → (구독 동의) → 주문 화면으로 돌아감
```

## 결제 흐름
1. **결제 버튼:** web-view 안의 주문 화면이 결제 버튼을 누르면 `POST /api/v1/orders/{id}/payment-attempts`를 `wechat_pay_miniprogram` 방식으로 호출합니다.
2. **결제 티켓 발급:** 서버가 결제 시도와 **1회용 결제 티켓**을 만듭니다. 유효 시간은 5분이고, DB에는 원문 대신 해시만 저장합니다.
3. **결제 페이지 이동:** 웹이 `wx.miniProgram.navigateTo('/pages/pay/pay?ticket=…')`로 결제 페이지를 엽니다.
4. **결제 요청:** 결제 페이지가 `wx.login`으로 받은 code와 티켓을 보냅니다. 서버는 code로 결제자 openid를 확인한 뒤 티켓을 한 번만 소비하고, 결제 파라미터를 돌려줍니다.
5. **결제 확정:** `wx.requestPayment`가 성공해도 예약은 아직 확정되지 않습니다. 확정은 **PG 웹훅이나 서버 조회**로만 합니다. 주문 화면은 "결제 확인 중" 상태에서 서버 상태를 다시 읽습니다.

mock 모드에서는 결제 페이지가 모의 성공·실패 버튼을 보여줍니다. 이 버튼은 서버가 서명한 알림을 만들어 웹훅과 같은 경로로 처리합니다. mock 모드는 비운영 환경에서만 동작합니다.

## 출시 전 설정 (사람이 해야 함)

| 항목 | 위치 | 비고 |
|---|---|---|
| AppID | `project.config.json`의 `appid` | 위챗 공식 플랫폼에서 해외 법인으로 계정을 개설하고 주체 인증 후 발급 |
| AppSecret | 서버 환경변수 (웹 `.env`) | **미니프로그램 코드에 넣지 않습니다** |
| 업무 도메인 | 미니프로그램 관리 → 개발 설정 | `WEB_ORIGIN` 도메인을 인증 파일로 인증 (web-view 허용) |
| 서버 도메인 | 같은 곳의 request 합법 도메인 | `API_ORIGIN` |
| 위챗페이 | 결제 대행사를 통한 크로스보더 가맹 → AppID 연결 | 서버의 미니프로그램 결제 어댑터를 공급사용으로 교체 |
| 구독 메시지 템플릿 | 구독 메시지 관리 | 승인된 템플릿 ID를 `SUBSCRIBE_TEMPLATE_IDS`에 입력 |
| 업종·개인정보 안내 | 계정 설정 | 실제 운영 주체 정보로 입력 |

## 검증 상태
- **자동 검증 완료:**
  - `utils/url.test.js`: web-view 주소는 같은 출처만 허용하고, 결제 쿼리를 검증합니다.
  - 서버 측 결제 티켓 DB 테스트: 소유자만 발급, 한 번만 소비, 5분 만료를 확인합니다.
  - 결제 API E2E 테스트
- **미검증:**
  - 위챗 개발자 도구와 실제 기기에서의 동작
  - 실제 결제 (sandbox/live)
  - 구독 메시지
  - 심사
