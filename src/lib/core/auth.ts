import bcrypt from "bcryptjs";
import * as jose from "jose";
import type { User } from "../models";

export type JWTPayload = {
  user: Omit<User, "password_hash">;
};

export function hashPassword(password: string, saltRounds: number = 11) {
  return bcrypt.hashSync(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createJWTPayload(user: User): JWTPayload {
  return {
    user: {
      id: user.id,
      username: user.username,
      user_type: user.user_type,
      is_active: user.is_active,
      is_consented: user.is_consented,
    },
  };
}

export async function signJWT(
  payload: JWTPayload,
  secret: string,
  expiration: string = "3h",
): Promise<string> {
  const secretBytes = jose.base64url.decode(secret).slice(0, 32);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiration)
    .sign(secretBytes);
}

export function verifyJWT(token: string): JWTPayload["user"] | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded.user as JWTPayload["user"];
  } catch {
    return null;
  }
}
