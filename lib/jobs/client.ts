import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "dockit",
  isDev: process.env.NODE_ENV !== "production",
});
