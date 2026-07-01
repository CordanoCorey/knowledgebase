import type { Doc } from "../_generated/dataModel";

// File representation role inference is shared by new uploads and migrations so
// attachment semantics stay consistent across Smart Storage paths.
type EntryRepresentationRole = Doc<"entryRepresentations">["representationRole"];

export function inferFileRepresentationRoleFromMetadata(
  contentTypeValue?: string,
  fileNameValue?: string,
): EntryRepresentationRole {
  const contentType = contentTypeValue?.toLowerCase() ?? "";
  const fileName = fileNameValue?.toLowerCase() ?? "";

  if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    return "recording";
  }

  if (
    contentType.includes("presentation") ||
    contentType.includes("powerpoint") ||
    /\.(ppt|pptx|key)$/i.test(fileName)
  ) {
    return "slides";
  }

  if (contentType.startsWith("image/") || /\.(gif|jpe?g|png|webp)$/i.test(fileName)) {
    return "thumbnail";
  }

  if (fileName.includes("transcript")) {
    return "transcript";
  }

  if (fileName.includes("manuscript")) {
    return "manuscript";
  }

  return "supportingMaterial";
}
