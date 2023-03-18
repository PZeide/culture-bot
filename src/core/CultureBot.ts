import { Command, CommandsManager } from "@core/CommandsManager";
import { DatabaseManager } from "@core/DatabaseManager";
import { ModulesManager } from "@core/ModulesManager";
import getAppDataPath from "appdata-path";
import Discord from "discord.js";
import { promises as fs } from "fs";
import path from "path";
import { Sequelize } from "sequelize";

export class CultureBot {
  private readonly databaseManager: DatabaseManager;
  private readonly modulesManager: ModulesManager;
  private readonly commandsManager: CommandsManager;

  public readonly client: Discord.Client;
  public readonly dataPath: string;

  constructor() {
    this.client = new Discord.Client({ 
      intents: [Discord.GatewayIntentBits.Guilds],
      presence: {
        activities: [{
          name: "gelbooru.com",
          type: Discord.ActivityType.Watching
        }]
      }
    });

    this.client.on("ready", this.onClientReady.bind(this));

    this.dataPath = getAppDataPath("CultureBot");
    this.databaseManager = new DatabaseManager(path.join(this.dataPath, "db.sqlite"));
    this.modulesManager = new ModulesManager(this);
    this.commandsManager = new CommandsManager(this);
  }

  public get readyClient(): Discord.Client<true> {
    this.ensureReady();
    return this.client;
  }

  public get database(): Sequelize {
    return this.databaseManager.database;
  }
  
  public addCommand(command: Command): void {
    this.commandsManager.addCommand(command);
  }

  public async start(): Promise<void> {
    await fs.mkdir(this.dataPath, { recursive: true });

    const botToken = process.env.BOT_TOKEN;
    if (botToken === undefined) {
      console.error("BOT_TOKEN is not defined !");
      process.exit(1);
    }

    await this.client.login(botToken);
    console.log("Client started.");
  }

  public async onClientReady(): Promise<void> {
    await this.databaseManager.init();
    await this.modulesManager.init();
    await this.commandsManager.registerCommands();
    console.log("Client ready.");
  }

  public async stop(): Promise<void> {
    await this.modulesManager.dispose();
    await this.databaseManager.dispose();
    this.client.destroy();
    console.log("Client stopped.");
  }

  public ensureReady(): void {
    if (!this.client.isReady())
      throw new Error("Client is not ready.");
  }
}