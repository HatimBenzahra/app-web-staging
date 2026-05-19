import { Injectable, Logger } from '@nestjs/common';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function resolveTimeoutMs(): number {
  const raw = Number(process.env.VLLM_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 10_000) {
    return 5 * 60_000;
  }
  return Math.floor(raw);
}

type VllmChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
};

/**
 * Thin client over the vLLM /chat/completions endpoint.
 * Handles auth, timeout (AbortController), 1-retry on network/5xx,
 * structured token-usage logging.
 */
@Injectable()
export class CoachingVllmClient {
  private readonly logger = new Logger(CoachingVllmClient.name);
  private readonly baseUrl = process.env.VLLM_BASE_URL;
  private readonly apiKey = process.env.VLLM_API_KEY;
  readonly model = process.env.VLLM_MODEL;
  readonly timeoutMs = resolveTimeoutMs();

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.model);
  }

  async chat(
    payload: unknown,
    context: { step: string; sessionId?: number | null },
  ): Promise<{ data: VllmChatResponse; content: string } | null> {
    if (!this.baseUrl || !this.apiKey) {
      return null;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const startedAt = Date.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.status >= 400 && response.status < 500) {
          this.logger.warn(
            `vLLM ${context.step} a répondu ${response.status} ${response.statusText} (pas de retry sur 4xx)`,
          );
          return null;
        }

        if (!response.ok) {
          if (attempt < maxAttempts) {
            this.logger.warn(
              `vLLM ${context.step} a répondu ${response.status} ${response.statusText}, retry ${attempt}/${maxAttempts - 1} dans 2s`,
            );
            await sleep(2000);
            continue;
          }
          this.logger.warn(
            `vLLM ${context.step} a définitivement échoué après ${attempt} tentatives: ${response.status} ${response.statusText}`,
          );
          return null;
        }

        const data = (await response.json()) as VllmChatResponse;
        const content = data.choices?.[0]?.message?.content;

        this.logger.log(
          `llm.usage step=${context.step} sessionId=${context.sessionId ?? 'n/a'} promptTokens=${data?.usage?.prompt_tokens ?? 'n/a'} completionTokens=${data?.usage?.completion_tokens ?? 'n/a'} totalTokens=${data?.usage?.total_tokens ?? 'n/a'} durationMs=${Date.now() - startedAt} attempt=${attempt}`,
        );

        if (!content || typeof content !== 'string') {
          return null;
        }
        return { data, content };
      } catch (error: unknown) {
        const errName = (error as { name?: string })?.name ?? '';
        const errMessage =
          (error as { message?: string })?.message ?? String(error);
        const isNetworkOrAbort =
          errName === 'TypeError' ||
          errName === 'AbortError' ||
          errName === 'FetchError';

        if (attempt < maxAttempts && isNetworkOrAbort) {
          this.logger.warn(
            `vLLM ${context.step} erreur "${errMessage}", retry ${attempt}/${maxAttempts - 1} dans 2s`,
          );
          await sleep(2000);
          continue;
        }
        this.logger.warn(
          `Appel vLLM ${context.step} impossible (tentative ${attempt}): ${errMessage}`,
        );
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }
    return null;
  }
}
