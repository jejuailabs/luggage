// pnpm test:db — Docker 없이 embedded Postgres를 띄워 마이그레이션·시드·RLS 테스트를 실행한다.
// 로컬 전용 인스턴스에만 연결한다. 원격 DB 주소가 주어지면 실행하지 않는다.
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".tmp", "pg-test");
const port = Number(process.env.TEST_DB_PORT ?? 54329);
const database = "luggage_test";

for (const name of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
  const value = process.env[name];
  if (value && !/@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(value)) {
    console.error(`[test:db] ${name} points to a non-local host. Refusing to run database tests.`);
    process.exit(1);
  }
}

/**
 * 이전 실행이 비정상 종료돼 남은 이 프로젝트의 임베디드 Postgres 프로세스를 정리한다 (Windows 공유 메모리 충돌 방지).
 * 이 저장소의 node_modules에 있는 postgres.exe만 대상으로 한다.
 */
function stopLeftoverServers() {
  if (process.platform !== "win32") return;
  const marker = path.join(root, "node_modules").replaceAll("\\", "/");
  const script = `Get-CimInstance Win32_Process -Filter "Name = 'postgres.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\','/').Contains('${marker}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
  } catch {
    // 정리 실패는 무시하고 기동을 시도한다 (실패하면 기동 오류로 드러난다).
  }
}

async function applySqlFiles(client, label, files) {
  for (const file of files) {
    const sql = await readFile(file, "utf8");
    try {
      await client.query(sql);
    } catch (error) {
      throw new Error(`[test:db] ${label} failed: ${path.relative(root, file)}\n${error.message}`);
    }
    console.log(`[test:db] applied ${path.relative(root, file)}`);
  }
}

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user: "postgres",
  password: "postgres",
  persistent: false,
  onLog: () => {},
});

let exitCode = 1;
try {
  stopLeftoverServers();
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(path.dirname(dataDir), { recursive: true });
  await server.initialise();
  await server.start();
  await server.createDatabase(database);

  const url = `postgres://postgres:postgres@127.0.0.1:${port}/${database}`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrations = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(migrationsDir, f));
  await applySqlFiles(client, "shim", [path.join(root, "supabase", "tests", "support", "supabase-shim.sql")]);
  await applySqlFiles(client, "migration", migrations);
  await applySqlFiles(client, "seed", [path.join(root, "supabase", "seed.sql")]);
  await client.end();

  exitCode = await new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "vitest", "run", "-c", "supabase/tests/vitest.config.ts", ...(process.env.DB_TEST_FILTER ? [process.env.DB_TEST_FILTER] : [])], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, TEST_DATABASE_URL: url },
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await server.stop().catch(() => {});
}
process.exit(exitCode);
