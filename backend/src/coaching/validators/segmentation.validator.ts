import { Injectable } from '@nestjs/common';
import {
  SegmentationAgentResult,
  SegmentationBlock,
} from '../agents/segmentation/segmentation-agent.types';

@Injectable()
export class SegmentationValidator {
  validate(
    result: SegmentationAgentResult,
    bounds: { startTime: number; endTime: number },
  ): { blocks: SegmentationBlock[]; reasons: string[] } {
    const reasons: string[] = [];
    const seen = new Set<string>();
    const blocks = result.blocks
      .map((block, index): SegmentationBlock => {
        const startTime = clampTime(block.startTime, bounds);
        const endTime = clampTime(block.endTime, bounds);
        const safeStart = Math.min(startTime, endTime);
        const safeEnd = Math.max(startTime, endTime);
        const id = block.id.trim() || `block-${index + 1}`;
        if (seen.has(id)) {
          reasons.push(`duplicate_id:${id}`);
        }
        seen.add(id);
        if (safeEnd - safeStart < 0.25) {
          reasons.push(`too_short:${id}`);
        }
        return {
          ...block,
          id,
          startTime: Number(safeStart.toFixed(2)),
          endTime: Number(safeEnd.toFixed(2)),
          confidence: Math.min(1, Math.max(0, block.confidence)),
        };
      })
      .filter((block) => block.endTime - block.startTime >= 0.25)
      .sort((a, b) => a.startTime - b.startTime);

    for (let index = 1; index < blocks.length; index += 1) {
      if (blocks[index].startTime < blocks[index - 1].endTime) {
        reasons.push(`overlap:${blocks[index - 1].id}->${blocks[index].id}`);
      }
    }

    if (blocks.length === 0) {
      reasons.push('no_valid_blocks');
    }

    return { blocks, reasons };
  }
}

function clampTime(
  value: number,
  bounds: { startTime: number; endTime: number },
): number {
  if (!Number.isFinite(value)) return bounds.startTime;
  return Math.min(bounds.endTime, Math.max(bounds.startTime, value));
}
