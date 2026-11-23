import postgres from "postgres";
import { unstable_cache } from "next/cache";

declare global {
  // eslint-disable-next-line no-var
  var _sql: ReturnType<typeof postgres> | undefined;
}

const sql =
  globalThis._sql ||
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    ssl: "require",
    max: process.env.NODE_ENV === "production" ? 5 : 20,
    connect_timeout: 15,
    idle_timeout: 20,
    onnotice: () => {},
  });

globalThis._sql = sql;

export const cachedQuery = async <T,>(
  queryFn: () => Promise<T>,
  tags: string[],
  revalidate: number = 3600
): Promise<T> => {
  return unstable_cache(queryFn, tags, { tags, revalidate })();
};

export default sql;