# Vercel 배포

## 프로젝트 설정 (Vercel 대시보드 → Settings)
| 항목 | 값 |
|---|---|
| Root Directory | `apps/web` ("Include files outside the root directory" 켜짐 — 모노레포 패키지 사용) |
| Framework Preset | Next.js |
| Install Command | 기본값 (pnpm 자동 감지) |
| Node.js | 22.x 이상 |

## 환경변수
| 변수 | 값 | 비고 |
|---|---|---|
| `APP_ENV` | `staging` | 결제·알림이 mock인 동안 `production` 금지 (mock 금지 규칙으로 기동 실패) |
| `APP_URL` | `https://<배포 도메인>` | 호텔 QR·canonical·결제 복귀 주소 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 프로젝트 값 | 공개 값 |
| `SUPABASE_SERVER_SECRET` | Supabase secret(service role) key | **Sensitive**. 없으면 결제 확정·알림·작업이 503 |
| `CRON_SECRET` | 16자 이상 임의 문자열 | **Sensitive**. Vercel Cron이 Bearer로 보낸다 |
| `MOCK_PAYMENT_SECRET` | 16자 이상 임의 문자열 | **Sensitive**. staging mock 결제 서명 |
| `PAYMENT_MODE`·`NOTIFICATION_MODE`·`MAPS_MODE`·`WECHAT_MODE` | `mock` | 실제 연동 전 |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | 운영용 VAPID 키 | 개인키 **Sensitive**. `pnpm --filter @luggage/web exec web-push generate-vapid-keys` |
| `TRACKING_WEBHOOK_SECRET` | 16자 이상 (관제 업체와 공유) | 선택 |

임의 문자열 생성 예: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

## 스케줄 작업 (Cron)
Hobby 플랜은 하루 1회만 허용하므로 `apps/web/vercel.json`은 매일 한 번(한국 시간 새벽 2:00~3:30) 실행한다.
운영 전에는 다음 중 하나로 짧은 주기를 복구한다.
- Pro 플랜: expire-holds `*/5 * * * *`, reconcile-payments `*/10 * * * *`, dispatch-outbox `* * * * *`
- 외부 스케줄러: 같은 경로를 `Authorization: Bearer <CRON_SECRET>` 헤더로 GET 호출

## 배포 후 확인
1. `/api/v1/health` → `appEnv`, 연동 모드 확인
2. `/zh-CN` 홈, `/manifest.webmanifest`
3. 원격 Supabase에 `supabase/migrations/*`를 순서대로 적용해야 호텔·콘텐츠·예약이 동작한다
