import type BetterSQLite from "better-sqlite3";
import { Result, ok, err } from "neverthrow";
import type { User, DomainError } from "../models";
import { UserRepository } from "../repositories/user";

export class UserService {
  private userRepo: UserRepository;

  constructor(private db: BetterSQLite.Database) {
    this.userRepo = new UserRepository(db);
  }

  toggleActive(userId: number): Result<User, DomainError> {
    try {
      const user = this.userRepo.findById(userId);
      if (!user) {
        return err({ type: "NotFound", entity: "User", id: userId });
      }

      const newActiveState = !user.is_active;
      this.userRepo.updateActive(userId, newActiveState ? 1 : 0);

      const updatedUser = this.userRepo.findById(userId);
      if (!updatedUser) {
        return err({ type: "NotFound", entity: "User", id: userId });
      }

      return ok(updatedUser);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  toggleConsented(userId: number): Result<User, DomainError> {
    try {
      const user = this.userRepo.findById(userId);
      if (!user) {
        return err({ type: "NotFound", entity: "User", id: userId });
      }

      const newConsentedState = !user.is_consented;
      this.userRepo.updateConsented(userId, newConsentedState ? 1 : 0);

      const updatedUser = this.userRepo.findById(userId);
      if (!updatedUser) {
        return err({ type: "NotFound", entity: "User", id: userId });
      }

      return ok(updatedUser);
    } catch (error) {
      return err({
        type: "Conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
