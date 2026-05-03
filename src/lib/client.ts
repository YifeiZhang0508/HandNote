import OpenAI from "openai";
import { type ModelConfig } from "./models";

const clients = new Map<string, OpenAI>();

export function getClient(config: ModelConfig): OpenAI {
  const key = config.id;
  if (!clients.has(key)) {
    clients.set(
      key,
      new OpenAI({
        apiKey: process.env[config.envKey],
        baseURL: config.baseURL,
      })
    );
  }
  return clients.get(key)!;
}
