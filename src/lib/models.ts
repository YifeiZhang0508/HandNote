export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  model: string;
  envKey: string;
  description: string;
  supportsVision: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    id: "mimo",
    name: "MiMo-V2.5",
    provider: "小米",
    baseURL: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5",
    envKey: "MIMO_API_KEY",
    description: "小米多模态模型，支持图片理解与推理",
    supportsVision: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    provider: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    description: "DeepSeek语言模型（文本推理，暂不支持图片）",
    supportsVision: false,
  },
];

export function getModelConfig(modelId: string): ModelConfig {
  const config = MODELS.find((m) => m.id === modelId);
  if (!config) {
    throw new Error(`未知模型: ${modelId}`);
  }
  return config;
}
