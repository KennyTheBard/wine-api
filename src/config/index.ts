import { get } from "env-var";
import * as dotenv from "dotenv";

dotenv.config();

export const appConfig: AppConfig = {
    port: get("PORT").required().asPortNumber(),
    mongo: {
        host: get("MONGO_HOST").required().asString(),
        port: get("MONGO_PORT").required().asPortNumber(),
        database: get("MONGO_DATABASE").required().asString(),
        username: get("MONGO_USERNAME").required().asString(),
        password: get("MONGO_PASSWORD").required().asString(),
    },
};

export type AppConfig = {
    port: number;
    mongo: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
    };
};
