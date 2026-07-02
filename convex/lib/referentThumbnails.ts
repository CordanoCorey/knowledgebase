import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { inferFileRepresentationRoleFromMetadata } from "./fileRepresentationRoles";

const MAX_REPRESENTED_ENTRIES_PER_REFERENT = 20;
const MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY = 20;

type EntryVisibilityPredicate = (entry: Doc<"knowledgeEntries">) => boolean;

export async function getRepresentedReferentThumbnailUrl(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  options: { isEntryVisible?: EntryVisibilityPredicate } = {},
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referentId),
    )
    .take(MAX_REPRESENTED_ENTRIES_PER_REFERENT);
  const visibleEntries = entries
    .filter((entry) => options.isEntryVisible?.(entry) ?? true)
    .sort(compareEntriesByFreshness);

  for (const entry of visibleEntries) {
    const thumbnailUrl = await getEntryThumbnailUrl(ctx, entry._id);
    if (thumbnailUrl !== undefined) {
      return thumbnailUrl;
    }
  }

  return undefined;
}

export async function getEntryThumbnailUrl(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const storageRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "storageFile"),
    )
    .take(MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY);

  const storageThumbnail = storageRepresentations.find(isThumbnailRepresentation);
  if (storageThumbnail?.storageId !== undefined) {
    return (await ctx.storage.getUrl(storageThumbnail.storageId)) ?? undefined;
  }

  const externalRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "externalUrl"),
    )
    .take(MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY);

  return externalRepresentations.find(isThumbnailRepresentation)?.externalUrl;
}

function isThumbnailRepresentation(
  representation: Pick<
    Doc<"entryRepresentations">,
    | "contentType"
    | "externalUrl"
    | "fileName"
    | "representationKind"
    | "representationRole"
    | "storageId"
  >,
) {
  return (
    representation.representationRole === "thumbnail" ||
    (representation.representationKind === "storageFile" &&
      inferFileRepresentationRoleFromMetadata(
        representation.contentType,
        representation.fileName,
      ) === "thumbnail")
  );
}

function compareEntriesByFreshness(
  first: Doc<"knowledgeEntries">,
  second: Doc<"knowledgeEntries">,
) {
  return (
    second.updatedAt - first.updatedAt ||
    compareStrings(first._id, second._id)
  );
}

function compareStrings(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
