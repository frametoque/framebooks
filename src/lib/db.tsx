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
    max: 20,
    connect_timeout: 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._sql = sql;
}

export const cachedQuery = async <T,>(
  queryFn: () => Promise<T>,
  tags: string[],
  revalidate: number = 3600
): Promise<T> => {
  return unstable_cache(queryFn, tags, { tags, revalidate })();
};

export default sql;