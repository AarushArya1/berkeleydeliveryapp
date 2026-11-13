import "server-only";
import { after } from "next/server";

/** Run after the response is sent (texts, pushes). Never fails the caller. */
export function inBackground(task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task();
    } catch (e) {
      console.error("background task failed", e);
    }
  });
}
