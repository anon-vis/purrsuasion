const config = {
  client: "better-sqlite3",
  useNullAsDefault: true,
  connection: {
    filename: process.env.DATABASE_URL || "./src/db/purrsuasion.db",
  },
  migrations: {
    directory: "./src/db/migrations",
    loadExtensions: [".mjs"],
  },
  seeds: {
    directory: "./src/db/seeds",
    loadExtensions: [".mjs"],
  },
};

export default config;
