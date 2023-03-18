import { CultureBot } from "@core/CultureBot";
import { config } from "dotenv";

config();

const bot = new CultureBot();

process.on("SIGINT", () => {
  console.log("CultureBot is shutting down.");
  bot.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("CultureBot is shutting down.");
  bot.stop().finally(() => process.exit(0));
});

process.on("uncaughtException", (error) => {
  console.error("An uncaught exception occured !", error);
});

process.on("unhandledRejection", (error) => {
  console.error("An unhandled rejection occured !", error);
});

bot.start();