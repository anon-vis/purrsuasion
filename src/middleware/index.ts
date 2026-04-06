import { defineMiddleware } from "astro:middleware";
import { authService } from "../lib/services";
import { roundService } from "../lib/services";

export const onRequest = defineMiddleware((context, next) => {
  const unprotectedRoute = [
    "/",
    "/login",
    "/api/login",
    "/api/logout",
  ].includes(context.url.pathname);

  const cookieValue = context.cookies.get("persuasion_game_token")?.value;
  const extractTokenResult = authService.extractTokenFromCookie(cookieValue);

  if (extractTokenResult.isOk()) {
    const verifiedUserResult = authService.verifyToken(
      extractTokenResult.value,
    );

    if (verifiedUserResult.isOk()) {
      context.locals.username = verifiedUserResult.value.username;
      context.locals.userType = verifiedUserResult.value.user_type;
      context.locals.id = verifiedUserResult.value.id;

      if (context.locals.userType === "student") {
        const roundInfoResult = roundService.getUserRoundInfo(
          context.locals.id,
        );
        if (roundInfoResult.isOk()) {
          context.locals.roundId = roundInfoResult.value.round_id;
          context.locals.groupId = roundInfoResult.value.group_id;
          context.locals.isReceiver = roundInfoResult.value.is_for_receiver;
          context.locals.prompt = roundInfoResult.value.instructions;
          context.locals.roundAssignmentId =
            roundInfoResult.value.round_assignment_id;
          context.locals.groupMembers =
            roundInfoResult.value.group_members || [];
          context.locals.roundStarted = roundInfoResult.value.started_at;
          context.locals.condensedPrompt =
            roundInfoResult.value.condensed_instructions;
          context.locals.category = roundInfoResult.value.category;
        }
      }

      return next();
    }
  }

  if (unprotectedRoute) {
    return next();
  }

  return context.redirect("/login");
});
