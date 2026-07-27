import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config({ path: "/home/multgesti/.env" });
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const result = await conn.execute(
      `SELECT column_name FROM all_tab_columns WHERE table_name = 'PCUSUARI' AND column_name LIKE '%NOME%'`
    );
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { }
    }
  }
}
run();
