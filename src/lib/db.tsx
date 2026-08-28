import postgres from "postgres";
import { unstable_cache } from "next/cache";

const sql = postgres(process.env.DATABASE_URL!, { 
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20
});

export const cachedQuery = async <T,>(
  queryFn: () => Promise<T>,
  tags: string[],
  revalidate: number = 3600
): Promise<T> => {
  return unstable_cache(queryFn, tags, { tags, revalidate })();
};

export default sql;