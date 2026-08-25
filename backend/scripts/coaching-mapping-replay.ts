/**
 * Mesure de la STABILITÉ du mapping des offres (passe 0).
 *
 * Le symptôme d'origine est une instabilité entre deux exécutions : la même porte
 * donne parfois la bonne analyse, parfois rien. Un seul passage réussi ne prouve
 * donc rien — il faut rejouer le MÊME transcript plusieurs fois et regarder si la
 * réponse varie.
 *
 * Le script n'écrit rien en base : il appelle vLLM directement, avec exactement le
 * prompt du runner.
 *
 * À lancer côté serveur (VLLM_BASE_URL n'est pas joignable depuis un poste) :
 *   npx tsx scripts/coaching-mapping-replay.ts --runs 5 <transcript.txt> [...]
 *
 * Sans fichier, le script prend les transcripts de référence de
 * designs/test-datasets/coaching-ia-v1/expected_transcriptions/.
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { parseSalesPlanMarkdown } from '../src/coaching/sales-plan.parser';
import { parseProductSheetMarkdown } from '../src/coaching/product-sheet.parser';
import { productKeysFromPlan } from '../src/coaching/prompt';
import {
  MappingProductOption,
  buildMappingSystemPrompt,
  buildMappingUserPrompt,
} from '../src/coaching/product-mapping-prompt';
import { repairMappingOutput } from '../src/coaching/json-repair';

const COACHING_DIR = path.join(__dirname, '..', 'src', 'coaching');
const DEFAULT_TRANSCRIPTS = path.join(
  __dirname,
  '..',
  '..',
  'designs',
  'test-datasets',
  'coaching-ia-v1',
  'expected_transcriptions',
);

function parseArgs(argv: string[]): { runs: number; files: string[] } {
  const files: string[] = [];
  let runs = 5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--runs') {
      runs = Number(argv[++i]);
      continue;
    }
    files.push(argv[i]);
  }
  if (!Number.isFinite(runs) || runs < 1) {
    throw new Error('--runs doit être un entier positif');
  }
  return { runs, files };
}

/** La liste fermée soumise au modèle — même construction que le runner. */
function buildOptions(): MappingProductOption[] {
  const plan = parseSalesPlanMarkdown(
    fs.readFileSync(
      path.join(COACHING_DIR, 'sales-plans', 'finanssor-plan-de-vente.md'),
      'utf8',
    ),
  ).plan;

  const sheetsDir = path.join(COACHING_DIR, 'product-sheets');
  const sheets = fs
    .readdirSync(sheetsDir)
    .filter((f) => f.endsWith('.md'))
    .map(
      (f) =>
        parseProductSheetMarkdown(
          fs.readFileSync(path.join(sheetsDir, f), 'utf8'),
        ).sheet,
    );
  const byProductKey = new Map(sheets.map((s) => [s.productKey, s]));

  return productKeysFromPlan(plan).map((key) => {
    const sheet = byProductKey.get(key);
    if (sheet) {
      return {
        key,
        label: sheet.label,
        identifiers: sheet.identifiers.length
          ? sheet.identifiers
          : sheet.facts.slice(0, 3),
      };
    }
    const step = plan.steps.find(
      (st) => st.appliesWhen === `productDetected:${key}`,
    );
    return {
      key,
      label: step?.label ?? key,
      identifiers: (step?.criteria ?? []).map((c) => c.label).slice(0, 3),
    };
  });
}

async function callVllm(system: string, user: string): Promise<string> {
  const baseUrl = (process.env.VLLM_BASE_URL ?? '').replace(/\/+$/, '');
  const model = process.env.VLLM_MODEL ?? '';
  if (!baseUrl || !model) {
    throw new Error('VLLM_BASE_URL / VLLM_MODEL absents de l’environnement');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.VLLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.VLLM_API_KEY}`;
  }

  const resp = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      temperature: 0,
      max_tokens: Number(process.env.VLLM_MAX_TOKENS ?? 4000),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { headers, timeout: Number(process.env.VLLM_TIMEOUT_MS ?? 120000) },
  );

  const content: unknown = resp.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Réponse vLLM vide ou malformée');
  }
  return content;
}

async function replayFile(
  file: string,
  runs: number,
  options: MappingProductOption[],
): Promise<void> {
  const transcript = fs.readFileSync(file, 'utf8').trim();
  const system = buildMappingSystemPrompt();
  const user = buildMappingUserPrompt(options, transcript);

  const signatures: string[] = [];
  const rejectedAll: string[] = [];
  let failures = 0;

  for (let i = 0; i < runs; i++) {
    try {
      const { products, rejected } = repairMappingOutput(
        await callVllm(system, user),
        options.map((o) => o.key),
      );
      rejectedAll.push(...rejected);
      const presented = products
        .filter((p) => p.presentedByCommercial)
        .map((p) => p.key)
        .sort();
      signatures.push(presented.join(',') || '(aucune)');
    } catch (e) {
      failures++;
      signatures.push(`ERREUR: ${(e as Error).message}`);
    }
  }

  const counts = new Map<string, number>();
  for (const s of signatures) counts.set(s, (counts.get(s) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const stability = Math.round(((sorted[0]?.[1] ?? 0) / runs) * 100);

  console.log(`\n=== ${path.basename(file)} (${runs} passages) ===`);
  for (const [sig, n] of sorted) console.log(`  ${n}/${runs}  ${sig}`);
  console.log(`  stabilité : ${stability}% (réponse majoritaire)`);
  if (rejectedAll.length) {
    console.log(`  clés hors liste rejetées : ${[...new Set(rejectedAll)].join(', ')}`);
  }
  if (failures) console.log(`  échecs d'appel : ${failures}/${runs}`);
}

async function main(): Promise<void> {
  const { runs, files } = parseArgs(process.argv.slice(2));
  const targets = files.length
    ? files
    : fs
        .readdirSync(DEFAULT_TRANSCRIPTS)
        .filter((f) => f.endsWith('.txt'))
        .map((f) => path.join(DEFAULT_TRANSCRIPTS, f));

  if (targets.length === 0) {
    throw new Error('Aucun transcript à rejouer');
  }

  const options = buildOptions();
  console.log(`Offres soumises : ${options.map((o) => o.key).join(', ')}`);

  for (const file of targets) await replayFile(file, runs, options);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
