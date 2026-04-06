import bcrypt from "bcryptjs";

export const seed = async function (knex) {
  const admins = [
    {
      username: "admin",
      password_hash: "admin",
      user_type: "admin",
      is_active: true,
      is_consented: true,
    },
  ].map((a) => {
    return { ...a, password_hash: bcrypt.hashSync(a.password_hash, 11) };
  });

  await knex("users").del();
  await knex("users").insert(admins);
};
