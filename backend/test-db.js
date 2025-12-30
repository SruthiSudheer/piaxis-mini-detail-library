import { Pool } from "pg";

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "Piaxis_local",
  password: "sruthi",
  port: 5432,
  connectionTimeoutMillis: 5000
});

async function run() {
  try {
    await pool.query("SELECT 1");
    console.log(" Connected to PostgreSQL");


    await pool.query(`
      CREATE TABLE IF NOT EXISTS details (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        description TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS detail_usage_rules (
        id SERIAL PRIMARY KEY,
        detail_id INTEGER REFERENCES details(id),
        host_element TEXT NOT NULL,
        adjacent_element TEXT NOT NULL,
        exposure TEXT NOT NULL
      );
    `);

    console.log("Tables created");

    console.log("Inserting seed data...");

    await pool.query(`
      INSERT INTO details (id, title, category, tags, description) VALUES
      (1, 'External Wall – Slab Junction', 'Waterproofing',
       'wall,slab,waterproofing,external',
       'Waterproof membrane continuity at external wall and slab junction'),
      (2, 'Window Sill Detail with Drip', 'Window',
       'window,sill,drip,external',
       'External window sill detail with drip groove'),
      (3, 'Internal Wall – Floor Junction', 'Wall',
       'wall,floor,internal',
       'Junction detail between internal wall and finished floor')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO detail_usage_rules (id, detail_id, host_element, adjacent_element, exposure) VALUES
      (1, 1, 'External Wall', 'Slab', 'External'),
      (2, 2, 'Window', 'External Wall', 'External'),
      (3, 3, 'Internal Wall', 'Floor', 'Internal')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Seed data inserted");

    console.log(" Testing SELECT query...");

    const result = await pool.query(
      "SELECT id, title, category, tags FROM details"
    );

    console.table(result.rows);

  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await pool.end();
    console.log("Done");
  }
}

run();
