# luggage — 제주 커넥트 (가칭)

중국인 개별 관광객 대상 제주 수하물 예약·배송 플랫폼. 작업 기준은 [AGENTS.md](AGENTS.md)와 [docs/](docs/)다.

## 로컬 실행

```bash
pnpm install
cp .env.example apps/web/.env.local   # 값 채우기 (비우면 mock)
pnpm dev                              # http://localhost:3000 → /zh-CN
```

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 웹앱 개발 서버 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | 전체 패키지·테스트 타입 검사 |
| `pnpm test` | 단위 테스트 (Vitest) |
| `pnpm test:db` | embedded Postgres에 마이그레이션·시드 적용 후 DB/RLS 테스트. 원격 DB 주소가 설정되면 실행 거부 |
| `pnpm test:e2e` | 운영 빌드 + Playwright (360px 모바일 기본). 최초 1회 `pnpm exec playwright install chromium` |
| `pnpm build` | 웹앱 운영 빌드 |

배포: [docs/deploy-vercel.md](docs/deploy-vercel.md)
