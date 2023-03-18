import { CultureBot } from "@core/CultureBot";
import * as glob from "fast-glob";
import path from "path";

export abstract class Module {
  protected readonly bot: CultureBot;
  constructor(bot: CultureBot) {
    this.bot = bot;
  }

  public abstract init(bot: CultureBot): Promise<void>;
  public abstract dispose(bot: CultureBot): Promise<void>;
}

export class ModulesManager {
  private static readonly modulesDir = path.join(__dirname, "..", "modules");
  
  private readonly bot: CultureBot;
  private readonly modules: Module[];

  constructor(bot: CultureBot) {
    this.bot = bot;
    this.modules = [];
  }

  private async loadModules(): Promise<void> {
    if (this.modules.length > 0) {
      console.error("Modules already loaded !");
      return;
    }

    const files = await glob.default("**/module.{ts,js}", { cwd: ModulesManager.modulesDir, absolute: true });
    for (const file of files) {
      const moduleImport = await import(file);
      if (moduleImport === undefined) {
        console.error(`Failed loading module ${file} !`);
        continue;
      }

      const moduleClass = moduleImport.default;
      const relativePath = path.relative(ModulesManager.modulesDir, file);

      if (moduleClass === undefined) {
        console.error(`Failed loading module ${relativePath} ! No export found.`);
        continue;
      }

      if (typeof moduleClass !== "function") {
        console.error(`Failed loading module ${relativePath} ! Export is not a class.`);
        continue;
      }

      if (moduleClass.length !== 1) {
        console.error(`Failed loading module ${relativePath} ! Module constructor must have only one parameter (bot).`);
      }
      
      const module = new moduleClass(this.bot);
      if (module === undefined || !(module instanceof Module)) {
        console.error(`Failed loading module ${relativePath} ! Export is not a Module.`);
        continue;
      }

      this.modules.push(module);
    }
  }

  public async init(): Promise<void> {
    this.bot.ensureReady();

    await this.loadModules();
    console.log(`Loaded ${this.modules.length} modules.`);
    
    for (const module of this.modules) {
      try {
        await module.init(this.bot);
        console.log(`Initialized module ${module.constructor.name}.`);
      } catch (error) {
        console.error(`Failed initializing module ${module.constructor.name} !`);
        console.error(error);
      }
    }
  }

  public async dispose(): Promise<void> {
    for (const module of this.modules) {
      await module.dispose(this.bot);
      console.log(`Disposed module ${module.constructor.name}.`);
    }
  }
}