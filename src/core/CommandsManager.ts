import { CultureBot } from "@core/CultureBot";
import Discord from "discord.js";

export abstract class Command {
  constructor(public readonly descriptor: Discord.ApplicationCommandData) {}

  public abstract execute(interaction: Discord.ChatInputCommandInteraction): Promise<void>;
  public autocomplete?(interaction: Discord.AutocompleteInteraction): Promise<void>;
}

export class CommandsManager {
  private readonly bot: CultureBot;
  private commands: Command[];
  private registered: boolean;

  constructor(bot: CultureBot) {
    this.bot = bot;
    this.commands = [];
    this.registered = false;
    
    bot.client.on("interactionCreate", this.onInteraction.bind(this));
  }

  private async onInteraction(interaction: Discord.Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
      return;

    const command = this.commands.find(command => command.descriptor.name === interaction.commandName);
    if (command === undefined) {
      console.error(`Command ${interaction.commandName} not found !`);
      return;
    }

    try {
      if (interaction.isChatInputCommand()) {
        await command.execute(interaction);
      } else if (interaction.isAutocomplete()) {
        if (command.autocomplete === undefined) {
          console.warn(`Command ${command.descriptor.name} does not support autocomplete.`);
          return;
        }

        await command.autocomplete(interaction);
      }
    } catch (error) {
      if (interaction.isAutocomplete()) {
        console.error(`An error occured while executing autocomplete for ${command}`, error);
        await interaction.respond([]);
      } else {
        console.error(`An error occured while executing command ${command}`, error);
        await interaction.reply({ content: "An error occured while executing the command." });
      }
    }
  }

  public addCommand(command: Command): void {
    if (this.registered)
      throw new Error("Cannot add a command after the commands have been registered.");

    this.commands.push(command);
  }

  public async registerCommands(): Promise<void> {
    if (this.registered)
      throw new Error("Commands have already been registered.");
    
    const devServerId = process.env.DEV_SERVER_ID;
    let appCommandManager: Discord.ApplicationCommandManager | Discord.GuildApplicationCommandManager;
    let registeredAppCommands: Discord.Collection<string, Discord.ApplicationCommand>;
    if (process.env.NODE_ENV === "development" && devServerId !== undefined) {
      const guild = await this.bot.client.guilds.fetch(devServerId);
      appCommandManager = guild.commands;
      registeredAppCommands = await appCommandManager.fetch();
    } else {
      appCommandManager = this.bot.readyClient.application.commands;
      registeredAppCommands = await appCommandManager.fetch();
    }

    for (const command of this.commands) {
      const found = registeredAppCommands.find((c) => c.name === command.descriptor.name);
      if (found === undefined) {
        await appCommandManager.create(command.descriptor);
      } else {
        await found.edit(command.descriptor);
      }
    }

    console.log(`Registered ${this.commands.length} commands.`);

    for (const command of registeredAppCommands.values()) {
      const found = this.commands.find((c) => c.descriptor.name === command.name);
      if (found === undefined) {
        await command.delete();
        console.log(`Deleted command ${command.name}.`);
      }
    }

    this.registered = true;
  }
}