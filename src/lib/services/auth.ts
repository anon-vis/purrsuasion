import type BetterSQLite from "better-sqlite3";
import { getSecret } from "astro:env/server";
import { err, ok, Result } from "neverthrow";

import {
  createJWTPayload,
  signJWT,
  verifyJWT,
  verifyPassword,
} from "../core/auth";
import { UserRepository } from "../repositories/user";

import type { DomainError, User } from "../models";

export class AuthService {
  private userRepo: UserRepository;
  private jwtSecret = getSecret("JWT_SECRET")!;

  constructor(db: BetterSQLite.Database) {
    this.userRepo = new UserRepository(db);
  }

  async login(
    username: string,
    password: string,
  ): Promise<Result<string, DomainError>> {
    try {
      const user = this.userRepo.findByUsername(username);
      if (!user) {
        return err({ type: "NotFound", entity: "User", id: username });
      }

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return err({
          type: "Validation",
          field: "password",
          message: "Invalid credentials",
        });
      }

      const payload = createJWTPayload(user);
      const token = await signJWT(payload, this.jwtSecret);

      return ok(token);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  extractTokenFromCookie(
    cookieValue: string | undefined,
  ): Result<string, DomainError> {
    if (!cookieValue) {
      return err({
        type: "Validation",
        field: "token",
        message: "No token found in cookie",
      });
    }
    return ok(cookieValue);
  }

  extractTokenFromHeader(
    authHeader: string | null,
  ): Result<string, DomainError> {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return err({
        type: "Validation",
        field: "authorization",
        message: "No valid Authorization header found",
      });
    }
    return ok(authHeader.substring(7));
  }

  verifyToken(token: string): Result<Omit<User, "password_hash">, DomainError> {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return err({
        type: "Validation",
        field: "token",
        message: "Invalid or expired token",
      });
    }
    return ok(decoded);
  }
}
