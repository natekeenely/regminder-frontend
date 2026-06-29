"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────── Dify types (matching Dify Console API) ───────── */

interface DifyI18n {
  en_US: string
  zh_Hans?: string
  [k: string]: string | undefined
}

interface DifyCredentialSchema {
  variable: string
  label: DifyI18n
  type: string
  required: boolean
  placeholder?: DifyI18n
  default?: string
  options?: Array<{ label: DifyI18n; value: string }>
}

interface DifyModelProvider {
  provider: string
  label: DifyI18n
  description?: DifyI18n
  icon_small: DifyI18n
  icon_large?: DifyI18n
  background?: string
  help?: { title: DifyI18n; url: DifyI18n }
  supported_model_types: string[]
  configurate_methods: string[]
  provider_credential_schema?: {
    credential_form_schemas: DifyCredentialSchema[]
  }
  model_credential_schema?: {
    model: { label: DifyI18n; placeholder?: DifyI18n }
    credential_form_schemas: DifyCredentialSchema[]
  }
  preferred_provider_type: string
  custom_configuration: {
    status: "active" | "no-configure"
  }
  system_configuration: {
    enabled: boolean
    current_quota_type?: string
    quota_configurations?: Array<{ quota_type: string }>
  }
}

interface DifyModel {
  model: string
  label: DifyI18n
  model_type: string
  features?: string[]
  status: string
}

interface MarketplacePlugin {
  plugin_id: string
  name: string
  org: string
  label: DifyI18n
  description: DifyI18n
  icon: string
  version: string
  download_count?: number
  category: string
  plugin_unique_identifier?: string
  latest_package_identifier?: string
  install_count?: number
  brief?: DifyI18n
  tags?: string[]
}

const MODEL_TYPE_LABELS: Record<string, string> = {
  llm: "LLM",
  "text-embedding": "TEXT EMBEDDING",
  rerank: "RERANK",
  speech2text: "SPEECH2TEXT",
  tts: "TTS",
  moderation: "MODERATION",
}

const MODEL_TYPE_SHORT: Record<string, string> = {
  llm: "LLM",
  "text-embedding": "Embedding",
  rerank: "Rerank",
  speech2text: "STT",
  tts: "TTS",
  moderation: "Moderation",
}

const DEFAULT_MODEL_TYPES = [
  { key: "llm", label: "System Reasoning Model" },
  { key: "text-embedding", label: "Embedding Model" },
  { key: "rerank", label: "Rerank Model" },
  { key: "speech2text", label: "Speech-to-Text Model" },
  { key: "tts", label: "Text-to-Speech Model" },
]

/* Brand colors for provider icons (used when no icon URL available from Dify API) */
const PROVIDER_BRAND: Record<string, { color: string; bg: string; letter: string }> = {
  openai: { color: "#fff", bg: "#10a37f", letter: "AI" },
  anthropic: { color: "#fff", bg: "#d4a27f", letter: "A" },
  azure_openai: { color: "#fff", bg: "#0078d4", letter: "Az" },
  google: { color: "#fff", bg: "#4285f4", letter: "G" },
  deepseek: { color: "#fff", bg: "#4d6bfe", letter: "DS" },
  ollama: { color: "#fff", bg: "#1a1a2e", letter: "OL" },
  cohere: { color: "#fff", bg: "#39594d", letter: "Co" },
  huggingface_hub: { color: "#000", bg: "#ffd21e", letter: "HF" },
  zhipuai: { color: "#fff", bg: "#3456ff", letter: "智" },
  mistralai: { color: "#fff", bg: "#f54e42", letter: "M" },
  bedrock: { color: "#fff", bg: "#ff9900", letter: "BR" },
  groq: { color: "#fff", bg: "#f55036", letter: "GQ" },
  minimax: { color: "#fff", bg: "#1c69ff", letter: "MM" },
  tongyi: { color: "#fff", bg: "#615ced", letter: "TY" },
  wenxin: { color: "#fff", bg: "#2932e1", letter: "WX" },
  spark: { color: "#fff", bg: "#0070ff", letter: "SP" },
  moonshot: { color: "#fff", bg: "#000000", letter: "MN" },
  baichuan: { color: "#fff", bg: "#3d5afe", letter: "BC" },
  yi: { color: "#fff", bg: "#000000", letter: "Yi" },
  nvidia: { color: "#fff", bg: "#76b900", letter: "NV" },
  fireworks: { color: "#fff", bg: "#6c47ff", letter: "FW" },
  togetherai: { color: "#fff", bg: "#0c8ce9", letter: "TG" },
  openrouter: { color: "#fff", bg: "#6366f1", letter: "OR" },
  replicate: { color: "#fff", bg: "#000000", letter: "Re" },
  siliconflow: { color: "#fff", bg: "#7c3aed", letter: "SF" },
  volcengine: { color: "#fff", bg: "#3370ff", letter: "VE" },
  jina: { color: "#000", bg: "#ffd500", letter: "Ji" },
  novita: { color: "#fff", bg: "#7c3aed", letter: "NV" },
  stepfun: { color: "#fff", bg: "#3b82f6", letter: "阶" },
  xinference: { color: "#fff", bg: "#000000", letter: "Xi" },
  localai: { color: "#fff", bg: "#0ea5e9", letter: "LA" },
  upstage: { color: "#fff", bg: "#8b5cf6", letter: "US" },
  sambanova: { color: "#fff", bg: "#ff6d00", letter: "SN" },
  cerebras: { color: "#fff", bg: "#dc2626", letter: "CB" },
  github: { color: "#fff", bg: "#24292f", letter: "GH" },
  "x-ai": { color: "#fff", bg: "#000000", letter: "xAI" },
  cloudflare: { color: "#fff", bg: "#f38020", letter: "CF" },
  vertex_ai: { color: "#fff", bg: "#4285f4", letter: "VA" },
  sagemaker: { color: "#fff", bg: "#ff9900", letter: "SM" },
  chatglm: { color: "#fff", bg: "#3456ff", letter: "GL" },
  voyageai: { color: "#fff", bg: "#1e3a5f", letter: "Vo" },
  nomic: { color: "#fff", bg: "#10b981", letter: "No" },
  mixedbread: { color: "#fff", bg: "#b45309", letter: "Mx" },
  fishaudio: { color: "#fff", bg: "#06b6d4", letter: "FA" },
  lmstudio: { color: "#fff", bg: "#111827", letter: "LM" },
  gpustack: { color: "#fff", bg: "#0ea5e9", letter: "GP" },
  ppio: { color: "#fff", bg: "#6366f1", letter: "PP" },
  gitee_ai: { color: "#fff", bg: "#c71d23", letter: "Gi" },
  openai_api_compatible: { color: "#fff", bg: "#6b7280", letter: "OA" },
  huggingface_tei: { color: "#000", bg: "#ffd21e", letter: "TE" },
  oci: { color: "#fff", bg: "#f80000", letter: "OC" },
  perfxcloud: { color: "#fff", bg: "#0284c7", letter: "PX" },
  zhinao: { color: "#fff", bg: "#1d4ed8", letter: "ZN" },
  vessl_ai: { color: "#fff", bg: "#6d28d9", letter: "VS" },
}

/**
 * Map Dify internal provider names → correct marketplace plugin names.
 * The Dify console uses its own internal names (e.g., "google") but the marketplace
 * uses different names (e.g., "gemini") for the same model provider plugin.
 * Without this mapping, resolvePluginIdentifier hits the wrong marketplace entry.
 */
const MARKETPLACE_NAME_MAP: Record<string, string> = {
  google: "gemini",            // Google model provider is "gemini" on marketplace ("google" = Search tool)
  // Add more as discovered — most providers match 1:1
}

/* Curated fallback — shown when Dify console + marketplace API are both unreachable */
const CURATED_PROVIDERS: MarketplacePlugin[] = [
  // ── Tier 1: Major cloud providers ──
  { plugin_id: "openai", name: "openai", org: "langgenius", label: { en_US: "OpenAI" }, description: { en_US: "GPT-4o, GPT-4 Turbo, o1, o3-mini, DALL-E, Whisper, and TTS models. The most widely used AI API platform." }, icon: "", version: "0.4.2", install_count: 850000, category: "model", plugin_unique_identifier: "langgenius/openai:0.4.2", tags: ["llm", "text-embedding", "tts", "speech2text", "moderation"] },
  { plugin_id: "anthropic", name: "anthropic", org: "langgenius", label: { en_US: "Anthropic" }, description: { en_US: "Claude Opus 4, Sonnet 4, Claude 3.5 Sonnet/Haiku. Advanced reasoning with extended thinking and 200K context." }, icon: "", version: "0.2.0", install_count: 620000, category: "model", plugin_unique_identifier: "langgenius/anthropic:0.2.0", tags: ["llm"] },
  { plugin_id: "azure_openai", name: "azure_openai", org: "langgenius", label: { en_US: "Azure OpenAI Service" }, description: { en_US: "Enterprise-grade OpenAI models hosted on Azure with data residency, compliance and private networking." }, icon: "", version: "0.2.1", install_count: 310000, category: "model", plugin_unique_identifier: "langgenius/azure_openai:0.2.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "google", name: "google", org: "langgenius", label: { en_US: "Google" }, description: { en_US: "Gemini 2.5 Pro, 2.5 Flash, 2.0. Multi-modal models with 1M+ token context and grounding." }, icon: "", version: "0.3.0", install_count: 280000, category: "model", tags: ["llm", "text-embedding"] },
  { plugin_id: "bedrock", name: "bedrock", org: "langgenius", label: { en_US: "AWS Bedrock" }, description: { en_US: "Managed access to Claude, Llama, Titan, Mistral and more via AWS. Enterprise security and VPC support." }, icon: "", version: "0.2.0", install_count: 95000, category: "model", plugin_unique_identifier: "langgenius/bedrock:0.2.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "vertex_ai", name: "vertex_ai", org: "langgenius", label: { en_US: "Google Cloud Vertex AI" }, description: { en_US: "Gemini and PaLM models via Google Cloud with enterprise MLOps, fine-tuning, and managed endpoints." }, icon: "", version: "0.1.2", install_count: 65000, category: "model", plugin_unique_identifier: "langgenius/vertex_ai:0.1.2", tags: ["llm", "text-embedding"] },

  // ── Tier 2: Fast inference & open-source hosting ──
  { plugin_id: "deepseek", name: "deepseek", org: "langgenius", label: { en_US: "DeepSeek" }, description: { en_US: "DeepSeek-V3, R1 reasoning model, and Coder. High performance Chinese-English bilingual models." }, icon: "", version: "0.1.5", install_count: 420000, category: "model", plugin_unique_identifier: "langgenius/deepseek:0.1.5", tags: ["llm"] },
  { plugin_id: "groq", name: "groq", org: "langgenius", label: { en_US: "Groq" }, description: { en_US: "Ultra-fast LPU inference for Llama 3, Mixtral, Gemma. Fastest tokens-per-second in the industry." }, icon: "", version: "0.1.0", install_count: 200000, category: "model", plugin_unique_identifier: "langgenius/groq:0.1.0", tags: ["llm"] },
  { plugin_id: "mistralai", name: "mistralai", org: "langgenius", label: { en_US: "Mistral AI" }, description: { en_US: "Mistral Large, Medium, Small, Codestral and Mixtral. European AI with open-weight and commercial models." }, icon: "", version: "0.1.1", install_count: 110000, category: "model", plugin_unique_identifier: "langgenius/mistralai:0.1.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "fireworks", name: "fireworks", org: "langgenius", label: { en_US: "Fireworks AI" }, description: { en_US: "Fast inference for Llama, Mixtral, and custom fine-tuned models. Serverless and dedicated deployments." }, icon: "", version: "0.1.0", install_count: 85000, category: "model", plugin_unique_identifier: "langgenius/fireworks:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "togetherai", name: "togetherai", org: "langgenius", label: { en_US: "Together AI" }, description: { en_US: "Run open-source models — Llama 3, Mixtral, Qwen, DeepSeek. Fast inference and fine-tuning platform." }, icon: "", version: "0.1.0", install_count: 88000, category: "model", plugin_unique_identifier: "langgenius/togetherai:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "openrouter", name: "openrouter", org: "langgenius", label: { en_US: "OpenRouter" }, description: { en_US: "Unified API gateway to 200+ models from OpenAI, Anthropic, Google, Meta and more. Single API key." }, icon: "", version: "0.1.0", install_count: 120000, category: "model", plugin_unique_identifier: "langgenius/openrouter:0.1.0", tags: ["llm"] },
  { plugin_id: "sambanova", name: "sambanova", org: "langgenius", label: { en_US: "SambaNova" }, description: { en_US: "Enterprise AI platform with custom RDU chips. Ultra-fast Llama inference and enterprise deployments." }, icon: "", version: "0.1.0", install_count: 32000, category: "model", plugin_unique_identifier: "langgenius/sambanova:0.1.0", tags: ["llm"] },
  { plugin_id: "cerebras", name: "cerebras", org: "langgenius", label: { en_US: "Cerebras" }, description: { en_US: "Wafer-scale AI inference. World's fastest Llama 3.1 inference with near-instant response times." }, icon: "", version: "0.1.0", install_count: 28000, category: "model", plugin_unique_identifier: "langgenius/cerebras:0.1.0", tags: ["llm"] },
  { plugin_id: "novita", name: "novita", org: "langgenius", label: { en_US: "Novita AI" }, description: { en_US: "GPU cloud for open-source models. Llama, Stable Diffusion, and serverless GPU inference." }, icon: "", version: "0.1.0", install_count: 42000, category: "model", plugin_unique_identifier: "langgenius/novita:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "nvidia", name: "nvidia", org: "langgenius", label: { en_US: "NVIDIA" }, description: { en_US: "NVIDIA NIM microservices for Llama, Nemotron, and enterprise AI models with TensorRT optimization." }, icon: "", version: "0.1.1", install_count: 68000, category: "model", plugin_unique_identifier: "langgenius/nvidia:0.1.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "siliconflow", name: "siliconflow", org: "langgenius", label: { en_US: "SiliconFlow" }, description: { en_US: "Fast and affordable inference for Qwen, DeepSeek, Llama and more. GenAI infra platform." }, icon: "", version: "0.1.1", install_count: 160000, category: "model", plugin_unique_identifier: "langgenius/siliconflow:0.1.1", tags: ["llm", "text-embedding", "rerank"] },
  { plugin_id: "replicate", name: "replicate", org: "langgenius", label: { en_US: "Replicate" }, description: { en_US: "Run open-source ML models in the cloud. Llama, Stable Diffusion, and thousands of community models." }, icon: "", version: "0.1.0", install_count: 72000, category: "model", plugin_unique_identifier: "langgenius/replicate:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "cloudflare", name: "cloudflare", org: "langgenius", label: { en_US: "Cloudflare Workers AI" }, description: { en_US: "Serverless AI inference at the edge. Llama, Mistral, and embedding models on Cloudflare's global network." }, icon: "", version: "0.1.0", install_count: 38000, category: "model", plugin_unique_identifier: "langgenius/cloudflare:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "ppio", name: "ppio", org: "langgenius", label: { en_US: "PPIO" }, description: { en_US: "Decentralized GPU cloud for AI inference. Low-cost access to open-source LLMs." }, icon: "", version: "0.1.0", install_count: 18000, category: "model", plugin_unique_identifier: "langgenius/ppio:0.1.0", tags: ["llm"] },

  // ── Chinese AI providers ──
  { plugin_id: "zhipuai", name: "zhipuai", org: "langgenius", label: { en_US: "ZhipuAI (GLM)" }, description: { en_US: "GLM-4, GLM-4V, ChatGLM. Leading Chinese LLM with strong bilingual and multi-modal capabilities." }, icon: "", version: "0.1.3", install_count: 125000, category: "model", plugin_unique_identifier: "langgenius/zhipuai:0.1.3", tags: ["llm", "text-embedding"] },
  { plugin_id: "tongyi", name: "tongyi", org: "langgenius", label: { en_US: "Tongyi Qianwen (Alibaba)" }, description: { en_US: "Qwen 2.5, Qwen-VL, Qwen-Audio by Alibaba Cloud. Multi-modal models with 128K context." }, icon: "", version: "0.1.2", install_count: 145000, category: "model", plugin_unique_identifier: "langgenius/tongyi:0.1.2", tags: ["llm", "text-embedding"] },
  { plugin_id: "wenxin", name: "wenxin", org: "langgenius", label: { en_US: "Baidu ERNIE" }, description: { en_US: "ERNIE 4.0 and ERNIE Bot by Baidu. Chinese-first LLMs with knowledge enhancement." }, icon: "", version: "0.1.1", install_count: 88000, category: "model", plugin_unique_identifier: "langgenius/wenxin:0.1.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "spark", name: "spark", org: "langgenius", label: { en_US: "iFlytek Spark" }, description: { en_US: "Spark cognitive model by iFlytek. Multi-modal Chinese AI with speech and vision capabilities." }, icon: "", version: "0.1.1", install_count: 72000, category: "model", plugin_unique_identifier: "langgenius/spark:0.1.1", tags: ["llm"] },
  { plugin_id: "minimax", name: "minimax", org: "langgenius", label: { en_US: "MiniMax" }, description: { en_US: "MiniMax abab models with long-context support. Chinese LLM with text, voice and vision." }, icon: "", version: "0.1.1", install_count: 65000, category: "model", plugin_unique_identifier: "langgenius/minimax:0.1.1", tags: ["llm", "text-embedding", "tts", "speech2text"] },
  { plugin_id: "moonshot", name: "moonshot", org: "langgenius", label: { en_US: "Moonshot AI (Kimi)" }, description: { en_US: "Kimi / Moonshot models with up to 200K context window. Long-document understanding specialist." }, icon: "", version: "0.1.1", install_count: 95000, category: "model", plugin_unique_identifier: "langgenius/moonshot:0.1.1", tags: ["llm"] },
  { plugin_id: "baichuan", name: "baichuan", org: "langgenius", label: { en_US: "Baichuan" }, description: { en_US: "Baichuan 2 and Baichuan-Turbo. Chinese-focused LLMs excelling at knowledge and creative tasks." }, icon: "", version: "0.1.0", install_count: 55000, category: "model", plugin_unique_identifier: "langgenius/baichuan:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "yi", name: "yi", org: "langgenius", label: { en_US: "Yi (01.AI)" }, description: { en_US: "Yi-Large, Yi-Medium, Yi-Vision by 01.AI. Bilingual models with strong reasoning and long context." }, icon: "", version: "0.1.0", install_count: 72000, category: "model", plugin_unique_identifier: "langgenius/yi:0.1.0", tags: ["llm"] },
  { plugin_id: "stepfun", name: "stepfun", org: "langgenius", label: { en_US: "StepFun (阶跃星辰)" }, description: { en_US: "Step-1 and Step-2 models. Multi-modal Chinese LLM with vision and tool-use capabilities." }, icon: "", version: "0.1.0", install_count: 42000, category: "model", plugin_unique_identifier: "langgenius/stepfun:0.1.0", tags: ["llm"] },
  { plugin_id: "volcengine", name: "volcengine", org: "langgenius", label: { en_US: "Volcengine (ByteDance)" }, description: { en_US: "Doubao and Skylark models by ByteDance. Enterprise AI platform with multi-modal and embedding support." }, icon: "", version: "0.1.1", install_count: 78000, category: "model", plugin_unique_identifier: "langgenius/volcengine:0.1.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "zhinao", name: "zhinao", org: "langgenius", label: { en_US: "360 Zhinao" }, description: { en_US: "360 AI Brain models. Chinese multi-modal LLMs with web search and tool-use grounding." }, icon: "", version: "0.1.0", install_count: 22000, category: "model", plugin_unique_identifier: "langgenius/zhinao:0.1.0", tags: ["llm"] },
  { plugin_id: "gitee_ai", name: "gitee_ai", org: "langgenius", label: { en_US: "Gitee AI" }, description: { en_US: "Gitee AI model inference platform. Access to Chinese and open-source LLMs." }, icon: "", version: "0.1.0", install_count: 15000, category: "model", plugin_unique_identifier: "langgenius/gitee_ai:0.1.0", tags: ["llm", "text-embedding"] },

  // ── Embedding & Rerank specialists ──
  { plugin_id: "cohere", name: "cohere", org: "langgenius", label: { en_US: "Cohere" }, description: { en_US: "Command R/R+, Embed v3, and Rerank 3. Enterprise RAG specialist with multilingual embedding." }, icon: "", version: "0.1.2", install_count: 95000, category: "model", plugin_unique_identifier: "langgenius/cohere:0.1.2", tags: ["llm", "text-embedding", "rerank"] },
  { plugin_id: "jina", name: "jina", org: "langgenius", label: { en_US: "Jina AI" }, description: { en_US: "Jina Embeddings v3, ColBERT Reranker, Reader-LM. Multilingual search and embedding specialist." }, icon: "", version: "0.1.1", install_count: 68000, category: "model", plugin_unique_identifier: "langgenius/jina:0.1.1", tags: ["text-embedding", "rerank", "llm"] },
  { plugin_id: "voyageai", name: "voyageai", org: "langgenius", label: { en_US: "Voyage AI" }, description: { en_US: "State-of-the-art embedding and reranking models for code, legal, finance, and multilingual retrieval." }, icon: "", version: "0.1.0", install_count: 35000, category: "model", plugin_unique_identifier: "langgenius/voyageai:0.1.0", tags: ["text-embedding", "rerank"] },
  { plugin_id: "nomic", name: "nomic", org: "langgenius", label: { en_US: "Nomic" }, description: { en_US: "Nomic Embed — open-source, high-performance text and vision embeddings with full transparency." }, icon: "", version: "0.1.0", install_count: 28000, category: "model", plugin_unique_identifier: "langgenius/nomic:0.1.0", tags: ["text-embedding"] },
  { plugin_id: "mixedbread", name: "mixedbread", org: "langgenius", label: { en_US: "Mixedbread AI" }, description: { en_US: "mxbai-embed models. Compact, high-performance embeddings for semantic search and RAG." }, icon: "", version: "0.1.0", install_count: 22000, category: "model", plugin_unique_identifier: "langgenius/mixedbread:0.1.0", tags: ["text-embedding", "rerank"] },
  { plugin_id: "upstage", name: "upstage", org: "langgenius", label: { en_US: "Upstage" }, description: { en_US: "Solar LLM and document AI. Korean-English models with specialized document parsing and embedding." }, icon: "", version: "0.1.0", install_count: 32000, category: "model", plugin_unique_identifier: "langgenius/upstage:0.1.0", tags: ["llm", "text-embedding"] },

  // ── Local / self-hosted ──
  { plugin_id: "ollama", name: "ollama", org: "langgenius", label: { en_US: "Ollama" }, description: { en_US: "Run LLMs locally on your machine. Supports Llama 3, Mistral, Qwen, Phi, Gemma and 100+ models." }, icon: "", version: "0.1.3", install_count: 350000, category: "model", plugin_unique_identifier: "langgenius/ollama:0.1.3", tags: ["llm", "text-embedding"] },
  { plugin_id: "lmstudio", name: "lmstudio", org: "langgenius", label: { en_US: "LM Studio" }, description: { en_US: "Desktop app for running local LLMs. GGUF model support with OpenAI-compatible API server." }, icon: "", version: "0.1.0", install_count: 55000, category: "model", plugin_unique_identifier: "langgenius/lmstudio:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "xinference", name: "xinference", org: "langgenius", label: { en_US: "Xorbits Inference" }, description: { en_US: "Distributed inference for LLMs, embeddings, and image models. Supports vLLM, GGML, and MLX." }, icon: "", version: "0.1.1", install_count: 48000, category: "model", plugin_unique_identifier: "langgenius/xinference:0.1.1", tags: ["llm", "text-embedding", "rerank"] },
  { plugin_id: "localai", name: "localai", org: "langgenius", label: { en_US: "LocalAI" }, description: { en_US: "Self-hosted OpenAI-compatible API. Run models locally with CPU/GPU support, no cloud needed." }, icon: "", version: "0.1.0", install_count: 42000, category: "model", plugin_unique_identifier: "langgenius/localai:0.1.0", tags: ["llm", "text-embedding", "tts", "speech2text"] },
  { plugin_id: "gpustack", name: "gpustack", org: "langgenius", label: { en_US: "GPUStack" }, description: { en_US: "Open-source GPU cluster manager for serving LLMs. Multi-node, multi-GPU model serving." }, icon: "", version: "0.1.0", install_count: 15000, category: "model", plugin_unique_identifier: "langgenius/gpustack:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "openai_api_compatible", name: "openai_api_compatible", org: "langgenius", label: { en_US: "OpenAI API Compatible" }, description: { en_US: "Connect any OpenAI-compatible API endpoint. Works with vLLM, TGI, FastChat, LiteLLM, and more." }, icon: "", version: "0.1.0", install_count: 220000, category: "model", plugin_unique_identifier: "langgenius/openai_api_compatible:0.1.0", tags: ["llm", "text-embedding"] },

  // ── Other notable providers ──
  { plugin_id: "huggingface_hub", name: "huggingface_hub", org: "langgenius", label: { en_US: "Hugging Face" }, description: { en_US: "Access 800K+ models via Inference API. Text generation, embeddings, and community models." }, icon: "", version: "0.1.1", install_count: 180000, category: "model", plugin_unique_identifier: "langgenius/huggingface_hub:0.1.1", tags: ["llm", "text-embedding"] },
  { plugin_id: "huggingface_tei", name: "huggingface_tei", org: "langgenius", label: { en_US: "HuggingFace TEI" }, description: { en_US: "Text Embeddings Inference by Hugging Face. High-throughput self-hosted embedding and reranking." }, icon: "", version: "0.1.0", install_count: 25000, category: "model", plugin_unique_identifier: "langgenius/huggingface_tei:0.1.0", tags: ["text-embedding", "rerank"] },
  { plugin_id: "github", name: "github", org: "langgenius", label: { en_US: "GitHub Models" }, description: { en_US: "AI models hosted by GitHub. Access GPT-4o, Llama, Mistral and more through GitHub's model marketplace." }, icon: "", version: "0.1.0", install_count: 45000, category: "model", plugin_unique_identifier: "langgenius/github:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "x-ai", name: "x-ai", org: "langgenius", label: { en_US: "xAI (Grok)" }, description: { en_US: "Grok-2, Grok-2 Mini by xAI. Real-time knowledge with witty, informative responses." }, icon: "", version: "0.1.0", install_count: 55000, category: "model", plugin_unique_identifier: "langgenius/x-ai:0.1.0", tags: ["llm"] },
  { plugin_id: "fishaudio", name: "fishaudio", org: "langgenius", label: { en_US: "Fish Audio" }, description: { en_US: "High-quality text-to-speech with voice cloning. Multilingual speech synthesis with natural prosody." }, icon: "", version: "0.1.0", install_count: 35000, category: "model", plugin_unique_identifier: "langgenius/fishaudio:0.1.0", tags: ["tts"] },
  { plugin_id: "sagemaker", name: "sagemaker", org: "langgenius", label: { en_US: "AWS SageMaker" }, description: { en_US: "Deploy and run models on AWS SageMaker endpoints. Custom model hosting with auto-scaling." }, icon: "", version: "0.1.0", install_count: 28000, category: "model", plugin_unique_identifier: "langgenius/sagemaker:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "oci", name: "oci", org: "langgenius", label: { en_US: "Oracle OCI" }, description: { en_US: "Oracle Cloud AI models. Cohere and Llama models via OCI Generative AI service." }, icon: "", version: "0.1.0", install_count: 12000, category: "model", plugin_unique_identifier: "langgenius/oci:0.1.0", tags: ["llm", "text-embedding"] },
  { plugin_id: "perfxcloud", name: "perfxcloud", org: "langgenius", label: { en_US: "Perfx Cloud" }, description: { en_US: "GPU cloud for AI model inference. Deploy and serve open-source models with optimized performance." }, icon: "", version: "0.1.0", install_count: 8000, category: "model", plugin_unique_identifier: "langgenius/perfxcloud:0.1.0", tags: ["llm"] },
]

function i18n(obj: DifyI18n | undefined): string {
  if (!obj) return ""
  return obj.en_US || obj.zh_Hans || Object.values(obj).find(Boolean) || ""
}

function formatCount(n: number | undefined): string {
  if (!n) return "0"
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/* ───────── API helpers ───────── */

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/proxy${path}`, init)

/** Convert a Dify icon URL to a loadable URL.
 *  Marketplace URLs are passed through directly — the browser can reach them
 *  (no CORS for <img> tags). Only Dify console paths need proxying. */
function proxyIconUrl(src: string): string {
  if (!src) return ""
  // Direct marketplace URL — browser loads it directly (no CORS for images)
  if (src.includes("marketplace.dify.ai")) return src
  // Already a proxied URL
  if (src.startsWith("/api/proxy/")) return src
  // cli-bff relative path (e.g. /api/v1/dify/plugins/icon/...) — route through Next.js proxy
  if (src.startsWith("/api/v1/")) return `/api/proxy${src}`
  // Dify console relative URL (e.g. /console/api/workspaces/current/...)
  if (src.startsWith("/console/api/")) {
    const path = src.replace("/console/api/", "")
    return `/api/proxy/api/v1/dify/console-asset/${path}`
  }
  // Absolute URL to Dify console
  if (src.includes("/console/api/")) {
    const path = src.split("/console/api/")[1]
    return `/api/proxy/api/v1/dify/console-asset/${path}`
  }
  return src
}

async function fetchProviders(): Promise<DifyModelProvider[]> {
  const resp = await api("/api/v1/dify/model-providers")
  if (!resp.ok) {
    if (resp.status === 502) throw new Error("Cannot connect to Dify — ensure dify-api is running")
    if (resp.status === 401) throw new Error("Dify auth failed — check DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD in cli-bff config")
    throw new Error(`HTTP ${resp.status}`)
  }
  const data = await resp.json()
  return data.data ?? data ?? []
}

async function fetchModels(provider: string): Promise<DifyModel[]> {
  const resp = await api(`/api/v1/dify/models?provider=${encodeURIComponent(provider)}`)
  if (!resp.ok) return []
  const data = await resp.json()
  return data.data ?? data ?? []
}

/** Derive the marketplace-correct org/name from a plugin object */
function marketplaceName(plugin: MarketplacePlugin): { org: string; name: string } {
  const org = plugin.org || "langgenius"
  // plugin_id from console may be "langgenius/gemini" — use the part after "/"
  let name = ""
  if (plugin.plugin_id && plugin.plugin_id.includes("/")) {
    name = plugin.plugin_id.split("/").pop()!
  }
  if (!name) name = plugin.name || plugin.plugin_id || ""
  // Apply name corrections (e.g., "google" → "gemini")
  name = MARKETPLACE_NAME_MAP[name] || name
  return { org, name }
}

/** Ensure every plugin has an icon URL — direct to marketplace (browser loads it) */
function enrichPluginIcons(plugins: MarketplacePlugin[]): MarketplacePlugin[] {
  return plugins.map((p) => {
    if (!p.icon || p.icon === "") {
      const { org, name } = marketplaceName(p)
      if (name) p.icon = `https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(org)}/${encodeURIComponent(name)}/icon`
    }
    return p
  })
}

async function fetchMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  try {
    const resp = await api("/api/v1/dify/plugins/model")
    if (resp.ok) {
      const data = await resp.json()
      const plugins = data.plugins ?? data.data ?? data ?? []
      if (Array.isArray(plugins) && plugins.length > 0) return enrichPluginIcons(plugins)
    }
  } catch { /* fall through */ }
  // Fallback: return curated list — still try to load icons via proxy
  return enrichPluginIcons(CURATED_PROVIDERS)
}

/** Resolve a plugin's full unique identifier from the Dify marketplace (browser can reach it) */
async function resolvePluginIdentifier(org: string, rawName: string): Promise<string | null> {
  // Apply name mapping (e.g., "google" → "gemini")
  const name = MARKETPLACE_NAME_MAP[rawName] || rawName

  async function tryResolve(o: string, n: string): Promise<string | null> {
    try {
      const resp = await fetch(`https://marketplace.dify.ai/api/v1/plugins/${encodeURIComponent(o)}/${encodeURIComponent(n)}`, { signal: AbortSignal.timeout(15000) })
      if (!resp.ok) return null
      const data = await resp.json()
      const plugin = data?.data?.plugin ?? data?.data ?? data?.plugin
      // Verify this is a model provider, not a tool
      if (plugin?.category && plugin.category !== "model") return null
      return plugin?.latest_package_identifier ?? plugin?.version?.unique_identifier ?? plugin?.unique_identifier ?? null
    } catch { return null }
  }

  // Try with mapped name first
  const result = await tryResolve(org, name)
  if (result) return result

  // If mapped name differs from raw, try the raw name as fallback
  if (name !== rawName) {
    return tryResolve(org, rawName)
  }
  return null
}

async function installPlugin(identifier: string): Promise<{ success: boolean; error?: string }> {
  const resp = await api("/api/v1/dify/plugins/install-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_unique_identifiers: [identifier] }),
  })
  const data = await resp.json()
  return { success: resp.ok && data.success, error: data.error }
}

async function saveCredentials(provider: string, credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const resp = await api(`/api/v1/dify/model-providers/${encodeURIComponent(provider)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credentials }),
  })
  if (resp.ok) return { ok: true }
  const text = await resp.text()
  let msg = `HTTP ${resp.status}`
  try { msg = JSON.parse(text)?.detail ?? JSON.parse(text)?.message ?? msg } catch { /* ok */ }
  return { ok: false, error: msg }
}

async function saveCustomModel(provider: string, modelName: string, modelType: string, credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const resp = await api(`/api/v1/dify/model-providers/${encodeURIComponent(provider)}/models`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: modelName, model_type: modelType, credentials }),
  })
  if (resp.ok) return { ok: true }
  const text = await resp.text()
  let msg = `HTTP ${resp.status}`
  try { msg = JSON.parse(text)?.detail ?? JSON.parse(text)?.message ?? msg } catch { /* ok */ }
  return { ok: false, error: msg }
}

async function removeProvider(provider: string): Promise<boolean> {
  const resp = await api(`/api/v1/dify/model-providers/${encodeURIComponent(provider)}`, { method: "DELETE" })
  return resp.ok
}

async function uninstallPlugin(installationId: string): Promise<boolean> {
  const resp = await api("/api/v1/dify/plugins/uninstall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plugin_installation_id: installationId }),
  })
  if (!resp.ok) return false
  const data = await resp.json()
  return data.success ?? false
}

async function fetchDefaultModel(modelType: string): Promise<{ provider?: string; model?: string }> {
  const resp = await api(`/api/v1/dify/default-model?model_type=${encodeURIComponent(modelType)}`)
  if (!resp.ok) return {}
  return await resp.json()
}

async function setDefaultModel(modelType: string, provider: string, model: string): Promise<boolean> {
  const resp = await api("/api/v1/dify/default-model", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model_type: modelType, provider, model }),
  })
  return resp.ok
}

/* ───────── component ───────── */

export function AiSettingsContent() {
  const [providers, setProviders] = useState<DifyModelProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState("")
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [expandedModels, setExpandedModels] = useState<Record<string, DifyModel[]>>({})
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})

  // Marketplace
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null)

  // Credential dialog
  const [credDialog, setCredDialog] = useState<DifyModelProvider | null>(null)
  const [credValues, setCredValues] = useState<Record<string, string>>({})
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)

  // Default model dialog
  const [showDefaultModels, setShowDefaultModels] = useState(false)

  const loadAllProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchProviders()
      setProviders(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMarketplace = useCallback(async () => {
    setMarketplaceLoading(true)
    try {
      const plugins = await fetchMarketplacePlugins()
      setMarketplacePlugins(plugins)
    } catch { /* ignore */ }
    setMarketplaceLoading(false)
  }, [])

  useEffect(() => {
    void loadAllProviders()
    void loadMarketplace()
  }, [loadAllProviders, loadMarketplace])

  // Split into configured and not-configured
  const configuredProviders = providers.filter(
    (p) => p.custom_configuration.status === "active" ||
      (p.system_configuration.enabled && p.system_configuration.quota_configurations?.some(
        (q) => q.quota_type === p.system_configuration.current_quota_type
      ))
  )
  const notConfiguredProviders = providers.filter(
    (p) => p.custom_configuration.status !== "active" &&
      !(p.system_configuration.enabled && p.system_configuration.quota_configurations?.some(
        (q) => q.quota_type === p.system_configuration.current_quota_type
      ))
  )

  // Filter by search
  const filterFn = (p: DifyModelProvider) =>
    !searchText ||
    p.provider.toLowerCase().includes(searchText.toLowerCase()) ||
    i18n(p.label).toLowerCase().includes(searchText.toLowerCase())

  const filteredConfigured = configuredProviders.filter(filterFn)
  const filteredNotConfigured = notConfiguredProviders.filter(filterFn)

  // Filter marketplace by search too
  const filteredMarketplace = marketplacePlugins.filter((mp) =>
    !searchText ||
    mp.name.toLowerCase().includes(searchText.toLowerCase()) ||
    i18n(mp.label).toLowerCase().includes(searchText.toLowerCase()) ||
    mp.org?.toLowerCase().includes(searchText.toLowerCase())
  )

  // Toggle model list
  async function toggleModels(providerName: string) {
    if (expandedProvider === providerName) {
      setExpandedProvider(null)
      return
    }
    setExpandedProvider(providerName)
    if (!expandedModels[providerName]) {
      setLoadingModels((prev) => ({ ...prev, [providerName]: true }))
      const models = await fetchModels(providerName)
      setExpandedModels((prev) => ({ ...prev, [providerName]: models }))
      setLoadingModels((prev) => ({ ...prev, [providerName]: false }))
    }
  }

  // Open credential dialog
  function openCredDialog(p: DifyModelProvider) {
    setCredDialog(p)
    setCredValues({})
    setCredError(null)
    setCredSaving(false)
  }

  // Save credentials
  async function handleSaveCredentials() {
    if (!credDialog) return
    setCredSaving(true)
    setCredError(null)
    const isCustomizable = credDialog.configurate_methods?.includes("customizable-model")
    let result: { ok: boolean; error?: string }
    if (isCustomizable) {
      const modelName = credValues["__model_name"]
      const modelType = credValues["__model_type"] ?? "llm"
      if (!modelName) { setCredError("Model name is required"); setCredSaving(false); return }
      const creds = { ...credValues }
      delete creds["__model_name"]
      delete creds["__model_type"]
      result = await saveCustomModel(credDialog.provider, modelName, modelType, creds)
    } else {
      result = await saveCredentials(credDialog.provider, credValues)
    }
    if (result.ok) {
      setCredDialog(null)
      await loadAllProviders()
    } else {
      setCredError(result.error ?? "Failed to save")
    }
    setCredSaving(false)
  }

  // Remove provider credentials
  async function handleRemoveProvider(providerName: string) {
    await removeProvider(providerName)
    await loadAllProviders()
  }

  // Uninstall provider plugin (removes from "To be configured" list entirely)
  async function handleUninstallPlugin(providerName: string) {
    try {
      // Dify 1.x uses qualified provider names like "langgenius/bedrock/bedrock"
      // Extract the plugin_id part: "langgenius/bedrock" (first two segments)
      const segments = providerName.split("/")
      // Build possible plugin_id values for matching
      const possibleIds: string[] = [providerName]
      if (segments.length >= 3) {
        // "langgenius/bedrock/bedrock" → plugin_id = "langgenius/bedrock"
        possibleIds.push(`${segments[0]}/${segments[1]}`)
        possibleIds.push(segments[1]) // just "bedrock"
      } else if (segments.length === 2) {
        possibleIds.push(segments[1])
      }
      // Also try with "langgenius/" prefix
      const bare = segments[segments.length - 1]
      possibleIds.push(bare)
      possibleIds.push(`langgenius/${bare}`)

      console.log(`[uninstall] Provider: ${providerName}, matching against:`, possibleIds)

      // Fetch installed plugins to find the matching installation ID
      const resp = await api("/api/v1/dify/plugins/installed")
      if (!resp.ok) return
      const data = await resp.json()
      const installed: Array<{ plugin_id: string; plugin_unique_identifier: string; installation_id?: string; id?: string }> = data.plugins ?? []

      console.log(`[uninstall] Installed plugins:`, installed.map(p => ({ id: p.plugin_id, inst: p.installation_id ?? p.id })))

      // Find matching plugin
      const match = installed.find((p) => {
        const pid = p.plugin_id ?? ""
        return possibleIds.some(candidate => pid === candidate || pid.endsWith(`/${candidate}`))
      })

      if (!match) {
        console.warn(`[uninstall] No installed plugin found matching provider: ${providerName}`)
        await loadAllProviders()
        return
      }

      console.log(`[uninstall] Found match:`, match.plugin_id, "installation_id:", match.installation_id ?? match.id)

      // Use installation_id or id or plugin_unique_identifier
      const installId = match.installation_id ?? match.id ?? match.plugin_unique_identifier
      if (installId) {
        const ok = await uninstallPlugin(installId)
        console.log(`[uninstall] Result:`, ok)
      }
      await loadAllProviders()
      await loadMarketplace()
    } catch (err) {
      console.error("[uninstall] Error:", err)
      await loadAllProviders()
    }
  }

  // Install marketplace plugin
  async function handleInstallPlugin(plugin: MarketplacePlugin) {
    const { org, name } = marketplaceName(plugin)
    if (!name) return
    setInstallingPlugin(plugin.plugin_id || plugin.name)

    // 1. Use identifier already in plugin data if available (must have @sha256: to be valid)
    let identifier = ""
    const candidate = plugin.plugin_unique_identifier || plugin.latest_package_identifier || ""
    if (candidate.includes("@")) {
      identifier = candidate
    }

    // 2. Otherwise resolve from marketplace (browser can reach it)
    if (!identifier) {
      console.log(`[install] Resolving identifier for ${org}/${name} from marketplace...`)
      identifier = (await resolvePluginIdentifier(org, name)) ?? ""
    }

    if (!identifier) {
      console.error(`[install] Could not resolve identifier for ${org}/${name}`)
      setInstallingPlugin(null)
      return
    }

    console.log(`[install] Installing ${org}/${name} with identifier: ${identifier}`)
    const result = await installPlugin(identifier)
    if (!result.success) {
      console.warn("[install] Backend reported failure (may still have installed):", result.error)
    }
    // Always reload — Dify often installs successfully even when task polling times out
    await loadAllProviders()
    await loadMarketplace()
    setInstallingPlugin(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Model Providers</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowDefaultModels(true)} className="h-9">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Default Models
          </Button>
          <Button variant="outline" size="sm" onClick={() => { void loadAllProviders(); void loadMarketplace() }} className="h-9">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadAllProviders()} className="ml-auto h-7 text-xs">Retry</Button>
          </div>
        )}

        {/* Loading state */}
        {loading && providers.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                  </div>
                  <div className="h-8 w-20 rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── SECTION: To be configured ─── */}
        {(filteredConfigured.length > 0 || filteredNotConfigured.length > 0) && (
          <section>
            {/* Configured Providers */}
            {filteredConfigured.length > 0 && (
              <div className="space-y-2 mb-4">
                {filteredConfigured.map((p) => (
                  <ProviderCard
                    key={p.provider}
                    provider={p}
                    configured
                    expanded={expandedProvider === p.provider}
                    models={expandedModels[p.provider]}
                    loadingModels={loadingModels[p.provider]}
                    onToggleModels={() => toggleModels(p.provider)}
                    onSetup={() => openCredDialog(p)}
                    onRemove={() => handleRemoveProvider(p.provider)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && configuredProviders.length === 0 && (
              <div className="mb-4 rounded-xl bg-muted/30 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                  <Bot className="h-6 w-6 text-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">Model provider not set up</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set up a model provider below to start using AI features. Click &quot;Setup&quot; on any provider card to configure API credentials.
                </p>
              </div>
            )}

            {/* Not Configured Providers — "To be configured" */}
            {filteredNotConfigured.length > 0 && (
              <div className="space-y-2">
                <h3 className="mb-2 text-sm font-semibold text-foreground">To be configured</h3>
                {filteredNotConfigured.map((p) => (
                  <ProviderCard
                    key={p.provider}
                    provider={p}
                    configured={false}
                    expanded={expandedProvider === p.provider}
                    models={expandedModels[p.provider]}
                    loadingModels={loadingModels[p.provider]}
                    onToggleModels={() => toggleModels(p.provider)}
                    onSetup={() => openCredDialog(p)}
                    onRemove={() => handleRemoveProvider(p.provider)}
                    onUninstall={() => handleUninstallPlugin(p.provider)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── SECTION: Install model providers (Marketplace) ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Install model providers
            </h3>
            {marketplaceLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {filteredMarketplace.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMarketplace.map((plugin) => (
                <MarketplaceCard
                  key={plugin.plugin_id || plugin.name}
                  plugin={plugin}
                  installing={installingPlugin === (plugin.plugin_id || plugin.name)}
                  onInstall={() => handleInstallPlugin(plugin)}
                />
              ))}
            </div>
          ) : (
            !marketplaceLoading && (
              <div className="rounded-xl border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {searchText ? `No marketplace plugins matching "${searchText}"` : "No additional model providers available to install"}
              </div>
            )
          )}
        </section>

        {/* No results */}
        {!loading && searchText && filteredConfigured.length === 0 && filteredNotConfigured.length === 0 && filteredMarketplace.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No providers matching &quot;{searchText}&quot;
          </div>
        )}
      </div>

      {/* Credential Dialog */}
      {credDialog && (
        <CredentialDialog
          provider={credDialog}
          values={credValues}
          onChange={setCredValues}
          saving={credSaving}
          error={credError}
          showSecrets={showSecrets}
          onToggleSecrets={() => setShowSecrets((v) => !v)}
          onSave={handleSaveCredentials}
          onClose={() => setCredDialog(null)}
        />
      )}

      {/* Default Model Settings Dialog */}
      {showDefaultModels && (
        <DefaultModelDialog
          providers={configuredProviders}
          onClose={() => setShowDefaultModels(false)}
        />
      )}
    </div>
  )
}

/* ───────── Provider Card ───────── */

function ProviderCard({
  provider: p,
  configured,
  expanded,
  models,
  loadingModels,
  onToggleModels,
  onSetup,
  onRemove,
  onUninstall,
}: {
  provider: DifyModelProvider
  configured: boolean
  expanded: boolean
  models?: DifyModel[]
  loadingModels?: boolean
  onToggleModels: () => void
  onSetup: () => void
  onRemove: () => void
  onUninstall?: () => void
}) {
  const label = i18n(p.label)
  const icon = i18n(p.icon_small)
  const description = i18n(p.description) || i18n(p.help?.title) || ""

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs transition-all hover:shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white dark:bg-zinc-900 shadow-xs">
          <ProviderIcon src={icon} label={label} name={p.provider} />
        </div>

        {/* Name + model types */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{label}</span>
            {configured && (
              <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/10 px-1.5 py-0">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </Badge>
            )}
          </div>
          {description && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{description}</p>}
          {/* Model type badges like Dify */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {p.supported_model_types.map((t) => (
              <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 font-normal border-border/60 text-muted-foreground">
                {MODEL_TYPE_LABELS[t] ?? t.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {configured ? (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSetup}>
                <Key className="mr-1 h-3 w-3" />
                Credentials
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" className="h-8 text-xs" onClick={onSetup}>
                <Key className="mr-1 h-3 w-3" />
                Add API Key
              </Button>
              {onUninstall && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={onUninstall} title="Uninstall plugin">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Model list toggle */}
      {configured && (
        <div className="border-t border-border/50">
          <button
            type="button"
            className="flex w-full items-center gap-1 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            onClick={onToggleModels}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
            {models && models.length > 0
              ? `${models.length} models`
              : "Show models"
            }
            {loadingModels && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
          </button>

          {/* Expanded model list */}
          {expanded && models && models.length > 0 && (
            <div className="border-t border-border/30 px-4 py-3">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {models.map((m) => (
                  <div key={m.model} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/30 transition-colors">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      m.status === "active" ? "bg-green-500" : "bg-muted-foreground/30"
                    )} />
                    <span className="text-xs text-foreground truncate" title={m.model}>{m.model}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {MODEL_TYPE_SHORT[m.model_type] ?? m.model_type}
                    </span>
                    {m.features?.includes("vision") && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">Vision</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {expanded && models && models.length === 0 && !loadingModels && (
            <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
              No models available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────── Marketplace Card ───────── */

function MarketplaceCard({
  plugin,
  installing,
  onInstall,
}: {
  plugin: MarketplacePlugin
  installing: boolean
  onInstall: () => void
}) {
  const label = i18n(plugin.label) || plugin.name
  const desc = i18n(plugin.description) || i18n(plugin.brief) || ""
  const downloadCount = plugin.download_count ?? plugin.install_count ?? 0

  return (
    <div className="group relative flex gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/30">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white dark:bg-zinc-900 shadow-xs">
        <ProviderIcon src={plugin.icon} label={label} name={plugin.name} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          {plugin.version && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono text-muted-foreground">
              {plugin.version}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {plugin.org && <span className="text-[11px] text-muted-foreground">{plugin.org}</span>}
          {downloadCount > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Download className="h-2.5 w-2.5" />
                {formatCount(downloadCount)}
              </span>
            </>
          )}
        </div>
        {desc && (
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{desc}</p>
        )}
        {/* Model type tags */}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {plugin.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 font-normal border-border/60 text-muted-foreground">
                {MODEL_TYPE_LABELS[t] ?? t.toUpperCase()}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Install button (visible on hover) */}
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={installing}
          onClick={(e) => { e.stopPropagation(); onInstall() }}
        >
          {installing ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Download className="mr-1 h-3 w-3" />
          )}
          {installing ? "Installing..." : "Install"}
        </Button>
      </div>
    </div>
  )
}

/* ───────── Credential Dialog ───────── */

function CredentialDialog({
  provider,
  values,
  onChange,
  saving,
  error,
  showSecrets,
  onToggleSecrets,
  onSave,
  onClose,
}: {
  provider: DifyModelProvider
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
  saving: boolean
  error: string | null
  showSecrets: boolean
  onToggleSecrets: () => void
  onSave: () => void
  onClose: () => void
}) {
  const isCustomizable = provider.configurate_methods?.includes("customizable-model")
  const providerSchemas = provider.provider_credential_schema?.credential_form_schemas ?? []
  const modelSchemas = provider.model_credential_schema?.credential_form_schemas ?? []
  const schemas = isCustomizable ? modelSchemas : providerSchemas
  const label = i18n(provider.label)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ProviderIcon src={i18n(provider.icon_small)} label={label} name={provider.provider} size={24} />
              {label} — {isCustomizable ? "Add Model" : "API Credentials"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {schemas.length === 0 && (
            <div className="text-sm text-muted-foreground">
              This provider has no credential schema available. You may need to install the plugin first from the marketplace section below.
            </div>
          )}

          {/* Model name field for customizable-model providers */}
          {isCustomizable && schemas.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                {i18n(provider.model_credential_schema?.model?.label) || "Model Name"}
                <span className="text-destructive">*</span>
              </label>
              <Input
                value={values["__model_name"] ?? ""}
                onChange={(e) => onChange({ ...values, __model_name: e.target.value })}
                placeholder={i18n(provider.model_credential_schema?.model?.placeholder) || "e.g. gpt-4o, claude-3-opus"}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">The model identifier from your provider</p>
            </div>
          )}

          {/* Model type selector for customizable-model providers */}
          {isCustomizable && schemas.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                Model Type
                <span className="text-destructive">*</span>
              </label>
              <select
                value={values["__model_type"] ?? "llm"}
                onChange={(e) => onChange({ ...values, __model_type: e.target.value })}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {provider.supported_model_types.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {schemas.map((field) => {
            const fieldLabel = i18n(field.label)
            const placeholder = i18n(field.placeholder) || ""
            const isSecret = field.type === "secret-input"
            const isSelect = field.type === "select"

            return (
              <div key={field.variable}>
                <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                  {fieldLabel}
                  {field.required && <span className="text-destructive">*</span>}
                </label>
                {isSelect && field.options ? (
                  <select
                    value={values[field.variable] ?? field.default ?? ""}
                    onChange={(e) => onChange({ ...values, [field.variable]: e.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">{placeholder || "Select..."}</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{i18n(opt.label)}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={isSecret && !showSecrets ? "password" : "text"}
                    value={values[field.variable] ?? ""}
                    onChange={(e) => onChange({ ...values, [field.variable]: e.target.value })}
                    placeholder={placeholder}
                  />
                )}
                {isSecret && (
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={onToggleSecrets}
                  >
                    {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showSecrets ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            )
          })}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || schemas.length === 0}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Default Model Dialog ───────── */

function DefaultModelDialog({
  providers,
  onClose,
}: {
  providers: DifyModelProvider[]
  onClose: () => void
}) {
  const [defaults, setDefaults] = useState<Record<string, { provider: string; model: string }>>({})
  const [allModels, setAllModels] = useState<Record<string, DifyModel[]>>({})
  const [loadingDefaults, setLoadingDefaults] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load current defaults and all models from configured providers
  useEffect(() => {
    async function load() {
      setLoadingDefaults(true)
      // Fetch defaults for each model type
      const defaultsMap: Record<string, { provider: string; model: string }> = {}
      await Promise.all(DEFAULT_MODEL_TYPES.map(async ({ key }) => {
        const d = await fetchDefaultModel(key)
        if (d.provider && d.model) defaultsMap[key] = { provider: d.provider, model: d.model }
      }))
      setDefaults(defaultsMap)

      // Fetch models from configured providers
      const modelsMap: Record<string, DifyModel[]> = {}
      await Promise.all(providers.map(async (p) => {
        const models = await fetchModels(p.provider)
        modelsMap[p.provider] = models
      }))
      setAllModels(modelsMap)
      setLoadingDefaults(false)
    }
    void load()
  }, [providers])

  // Get models for a given type from all configured providers
  function getModelsForType(modelType: string): Array<{ provider: string; providerLabel: string; model: string; modelLabel: string }> {
    const results: Array<{ provider: string; providerLabel: string; model: string; modelLabel: string }> = []
    for (const p of providers) {
      const models = allModels[p.provider] ?? []
      for (const m of models) {
        if (m.model_type === modelType && m.status === "active") {
          results.push({
            provider: p.provider,
            providerLabel: i18n(p.label),
            model: m.model,
            modelLabel: i18n(m.label) || m.model,
          })
        }
      }
    }
    return results
  }

  async function handleSave() {
    setSaving(true)
    await Promise.all(
      Object.entries(defaults).map(([modelType, { provider, model }]) =>
        setDefaultModel(modelType, provider, model)
      )
    )
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Default Model Settings
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {loadingDefaults ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            DEFAULT_MODEL_TYPES.map(({ key, label }) => {
              const options = getModelsForType(key)
              const current = defaults[key]
              const currentValue = current ? `${current.provider}:::${current.model}` : ""

              return (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
                  <select
                    value={currentValue}
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) {
                        setDefaults((prev) => { const next = { ...prev }; delete next[key]; return next })
                      } else {
                        const [prov, mod] = val.split(":::")
                        setDefaults((prev) => ({ ...prev, [key]: { provider: prov, model: mod } }))
                      }
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Not set</option>
                    {options.map((opt) => (
                      <option key={`${opt.provider}:::${opt.model}`} value={`${opt.provider}:::${opt.model}`}>
                        {opt.providerLabel} / {opt.modelLabel}
                      </option>
                    ))}
                  </select>
                  {options.length === 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">No configured models available for this type</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loadingDefaults}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ───────── Provider Icon ───────── */

function ProviderIcon({ src, label, name, size = 28 }: { src: string; label: string; name?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = src ? proxyIconUrl(src) : ""
  // Reset on src change
  useEffect(() => { setFailed(false) }, [resolvedSrc])

  if (!resolvedSrc || failed) {
    const brand = name ? PROVIDER_BRAND[name] : undefined
    if (brand) {
      return (
        <div
          style={{ width: size, height: size, backgroundColor: brand.bg, color: brand.color, fontSize: size * 0.38, fontWeight: 700 }}
          className="rounded-md flex items-center justify-center shrink-0 select-none"
          title={label}
        >
          {brand.letter}
        </div>
      )
    }
    return <Bot style={{ width: size, height: size }} className="text-muted-foreground" />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolvedSrc} alt={label} style={{ width: size, height: size }} className="rounded-sm object-contain" onError={() => setFailed(true)} />
}
