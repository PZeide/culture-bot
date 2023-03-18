import { AbstractDataType, AbstractDataTypeConstructor, DataTypes, Sequelize, Utils } from "sequelize";

const UnproxyAbstract: typeof DataTypes.ABSTRACT = DataTypes.ABSTRACT.prototype.constructor;

class SnowflakeDataType extends UnproxyAbstract {
  public key = "SNOWFLAKE";
  public static key = "SNOWFLAKE";

  constructor() {
    super();
  }

  public toSql(): string {
    return "CHAR(18)";
  }
}

class JsArrayDataType extends UnproxyAbstract implements AbstractDataType {
  public key = "JSARRAY";
  public static key = "JSARRAY";

  private readonly type: DataTypes.DataTypeAbstract;
  
  constructor(type: DataTypes.DataTypeAbstract) {
    super();
    this.type = type;
  }

  public toSql(): string {
    return "JSON";
  }

  public validate(value: unknown): boolean {
    if (!Array.isArray(value))
      return false;

    if (!Object.hasOwnProperty.call(this.type, "validate"))
      return true;

    return value.every(v => (this.type as any).validate(v));
  }

  public _stringify(value: unknown): string {
    return JSON.stringify(value);
  }

  public static parse(value: string): unknown {
    return JSON.parse(value);
  }
}

export namespace CultureDataTypes {
  export const SNOWFLAKE = Utils.classToInvokable(SnowflakeDataType) as unknown as AbstractDataTypeConstructor;
  export const JSARRAY = (type: DataTypes.DataTypeAbstract) => Utils.classToInvokable(JsArrayDataType)(type) as unknown as AbstractDataTypeConstructor;
}

export class DatabaseManager {
  private readonly _database: Sequelize;
  private initialized: boolean;

  constructor(path: string) {
    this._database = new Sequelize({
      dialect: "sqlite",
      storage: path,
      logging: false
    });

    this.initialized = false;
  }

  public get database(): Sequelize {
    if (!this.initialized)
      throw new Error("Database is not initialized.");
      
    return this._database;
  }

  public async init(): Promise<void> {
    if (this.initialized)
      return;

    await this._database.authenticate();
    this.initialized = true;
    console.log("Database initialized.");
  }

  public async dispose(): Promise<void> {
    if (!this.initialized)
      return;

    await this._database.close();
    this.initialized = false;
    console.log("Database closed.");
  }
}