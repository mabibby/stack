import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

// Better Auth owns everything under /api/auth/*
export const { GET, POST } = toNextJsHandler(auth);
