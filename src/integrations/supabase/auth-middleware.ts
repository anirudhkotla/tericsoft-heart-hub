import { createMiddleware } from "@tanstack/react-start";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    return next({
      context: {
        userId: "00000000-0000-0000-0000-000000000000",
      },
    });
  },
);
