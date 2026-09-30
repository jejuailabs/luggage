import pg from "pg";

export type DbRole = "anon" | "authenticated" | "service_role";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Run tests through `pnpm test:db`.");
  // 운영·원격 DB 보호: 로컬 주소만 허용한다.
  if (!/@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url)) {
    throw new Error("Database tests may only connect to a local database.");
  }
  return url;
}

export async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  return client;
}

/**
 * 트랜잭션 안에서 역할과 JWT sub를 설정하고 실행한 뒤 항상 롤백한다.
 * 테스트끼리 데이터가 섞이지 않는다.
 */
export async function asRole<T>(
  client: pg.Client,
  role: DbRole,
  run: (client: pg.Client) => Promise<T>,
  options: { userId?: string; aal?: "aal1" | "aal2" } = {},
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    if (options.userId) {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [options.userId]);
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: options.userId, aal: options.aal ?? "aal2" })]);
    }
    return await run(client);
  } finally {
    await client.query("rollback");
  }
}
