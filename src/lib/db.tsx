import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { 
  prepare: false, // Fixes prepared statement error on serverless pools
  connect_timeout: 10,
  idle_timeout: 20
});

export default sql;