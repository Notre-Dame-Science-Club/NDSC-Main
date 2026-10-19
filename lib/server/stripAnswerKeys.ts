// Server-side removal of grading data from form blocks before they reach any
// client (S4 / S12). Never rely on a renderer to hide these.
const SECRET_KEYS = ['correct_option_id', 'correct_option_ids', 'correct_answer', 'correct_answers', 'answer_key', 'explanation']

export function stripAnswerKeysFromBlocks<T = any>(blocks: T): T {
  if (!Array.isArray(blocks)) return blocks
  return blocks.map((b: any) => {
    if (!b || typeof b !== 'object') return b
    const out: any = { ...b }
    for (const k of SECRET_KEYS) delete out[k]
    return out
  }) as any
}

export function stripAnswerKeysFromNode<T extends { fields?: any }>(node: T): T {
  return { ...node, fields: stripAnswerKeysFromBlocks(node.fields) }
}
