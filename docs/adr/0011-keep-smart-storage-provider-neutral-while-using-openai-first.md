# Keep Smart Storage Provider-Neutral While Using OpenAI First

## Status

Accepted.

## Context

Smart Storage needs an LLM-backed path for turning Bronze Sources into reviewable Silver Proposals, but the domain contract should not become an OpenAI-specific API payload or a Convex persistence schema. The app also wants a local-first posture: deterministic previews, scaffolds, and fallback behavior should remain useful before and after any model call.

The first OpenAI-backed implementation is cost-sensitive and proposal-shaped. It should classify and structure bounded request input, not perform open-ended research or broad reasoning.

## Decision

Smart Storage keeps a provider-neutral, versioned Smart Storage Contract while the first LLM adapter calls OpenAI's Responses API with structured JSON output.

The model request sends:

- static instructions from `mvp-smart-storage-openai-instructions-v1`
- request-specific input containing the Contribution Submission, Sources, active Knowledge Context, Smart Storage Contract snapshot, Source interpretation policy, and Type Behavior snapshot
- a strict JSON schema named `smart_storage_run_outcome`

The model outcome is one of two decisions:

- `proposal`: one validated Smart Storage Proposal can be stored as Silver Layer review material
- `noProposal`: the Run completed without a reviewable Silver Proposal, so no Proposal row is created

The default OpenAI model remains `gpt-5.4-nano` because this MVP workload is bounded classification and structured proposal generation. `OPENAI_SMART_STORAGE_MODEL` can override the model when quality or evaluation results justify a larger model.

## Consequences

Smart Storage Runs can now distinguish model failure from a successful no-proposal outcome. This prevents the app from forcing weak, empty, unsupported, or extraction-limited Sources into hallucinated Silver Proposals.

The Smart Storage Contract remains portable to a later proprietary or self-hosted model because the persisted contract names domain decisions and output shape rather than an OpenAI SDK or Convex write payload.

The current implementation still does not perform advanced extraction, web browsing, multi-proposal splitting, or automatic Gold Layer writes. Those remain separate slices.
