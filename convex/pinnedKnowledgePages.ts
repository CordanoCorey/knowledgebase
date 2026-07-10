import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  requireAppAccess,
  type AllowedOrganization,
} from "./lib/appAccess";
import { getRepresentedReferentThumbnailUrl } from "./lib/referentThumbnails";

// Pinned pages drive sidebar personalization and keep labels/hrefs snapshotted
// so navigation remains stable if the underlying entry title changes.
const MAX_USER_PIN_RECORDS = 100;
const SORT_ORDER_STEP = 1000;

const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);

const pinSource = v.union(
  v.literal("defaultSeed"),
  v.literal("manual"),
);

const genericKnowledgePageKind = v.union(
  v.literal("dashboard"),
  v.literal("scripture"),
  v.literal("referent"),
  v.literal("context"),
  v.literal("search"),
);

const knowledgePageKind = v.union(
  v.literal("organization"),
  v.literal("dashboard"),
  v.literal("scripture"),
  v.literal("referent"),
  v.literal("context"),
  v.literal("search"),
);

const genericKnowledgePageInput = {
  href: v.string(),
  label: v.string(),
  pageKey: v.string(),
  pageKind: genericKnowledgePageKind,
  secondaryLabel: v.optional(v.string()),
};

const sidebarPinnedKnowledgePage = v.object({
  href: v.string(),
  id: v.string(),
  label: v.string(),
  organizationKind: v.optional(organizationKind),
  organizationName: v.optional(v.string()),
  organizationReferentId: v.optional(v.id("referents")),
  pageKind: knowledgePageKind,
  pageKey: v.string(),
  pinSource,
  secondaryLabel: v.string(),
  sortOrder: v.number(),
  thumbnailUrl: v.optional(v.string()),
});

const unpinResultState = v.union(
  v.literal("deleted"),
  v.literal("notPinned"),
  v.literal("suppressed"),
);

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type PinRecord = Doc<"pinnedKnowledgePages">;
type KnowledgePageRelationshipKind =
  | "organization"
  | "dashboard"
  | "scripture"
  | "referent"
  | "context"
  | "search";
type SidebarPinnedKnowledgePage = {
  href: string;
  id: string;
  label: string;
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  pageKind: KnowledgePageRelationshipKind;
  pageKey: string;
  pinSource: "defaultSeed" | "manual";
  secondaryLabel: string;
  sortOrder: number;
  thumbnailUrl?: string;
};

export const listForSidebar = query({
  args: {},
  returns: v.array(sidebarPinnedKnowledgePage),
  handler: async (ctx): Promise<SidebarPinnedKnowledgePage[]> => {
    const access = await requireAppAccess(ctx);
    const includeEveryDefaultOrganization = access.systemRole === "systemAdmin";
    const defaultCandidates = getDefaultOrganizationPins(
      access.organizations,
      includeEveryDefaultOrganization,
    );
    const defaultPageKeys = new Set(
      defaultCandidates.map((candidate) => candidate.pageKey),
    );
    const organizationsByReferentId = new Map(
      access.organizations.map((organization) => [
        organization.organizationReferentId,
        organization,
      ]),
    );
    const defaultRecords = await ctx.db
      .query("pinnedKnowledgePages")
      .withIndex("by_userId_and_pinSource", (q) =>
        q.eq("userId", access.userId).eq("pinSource", "defaultSeed"),
      )
      .take(MAX_USER_PIN_RECORDS);
    const pinnedRecords = await ctx.db
      .query("pinnedKnowledgePages")
      .withIndex("by_userId_and_pinState_and_sortOrder", (q) =>
        q.eq("userId", access.userId).eq("pinState", "pinned"),
      )
      .order("asc")
      .take(MAX_USER_PIN_RECORDS);
    const recordsByPageKey = new Map<string, PinRecord>();

    for (const record of defaultRecords) {
      recordsByPageKey.set(record.pageKey, record);
    }
    for (const record of pinnedRecords) {
      recordsByPageKey.set(record.pageKey, record);
    }

    const visiblePins: SidebarPinnedKnowledgePage[] = [];
    for (const candidate of defaultCandidates) {
      const record = recordsByPageKey.get(candidate.pageKey);
      if (record?.pinState === "suppressed") {
        continue;
      }

      if (record?.pinState === "pinned") {
        visiblePins.push(toSidebarPin(record, organizationsByReferentId) ?? candidate);
      } else {
        visiblePins.push(candidate);
      }
    }

    for (const record of pinnedRecords) {
      if (defaultPageKeys.has(record.pageKey)) {
        continue;
      }

      const pin = toSidebarPin(record, organizationsByReferentId);
      if (pin) {
        visiblePins.push(pin);
      }
    }

    const sortedPins = visiblePins
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
      )
      .slice(0, MAX_USER_PIN_RECORDS);

    const pinsWithThumbnails: SidebarPinnedKnowledgePage[] = [];
    for (const pin of sortedPins) {
      pinsWithThumbnails.push(await addSidebarPinThumbnail(ctx, pin, access));
    }

    return pinsWithThumbnails;
  },
});

export const pinOrganizationPage = mutation({
  args: {
    organizationReferentId: v.id("referents"),
  },
  returns: sidebarPinnedKnowledgePage,
  handler: async (ctx, args): Promise<SidebarPinnedKnowledgePage> => {
    const access = await requireAppAccess(ctx);
    const organization = access.organizations.find(
      (candidate) =>
        candidate.organizationReferentId === args.organizationReferentId,
    );
    if (!organization) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const pageKey = getOrganizationPageKey(args.organizationReferentId);
    const existing = await getPinByPageKey(ctx, access.userId, pageKey);
    const sortOrder =
      existing?.sortOrder ??
      await getNextManualSortOrder(
        ctx,
        access.userId,
        access.organizations,
        access.systemRole === "systemAdmin",
      );
    const pin = buildOrganizationPin(organization, "manual", sortOrder);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: pin.href,
        labelSnapshot: pin.label,
        organizationKind: organization.organizationKind,
        organizationReferentId: organization.organizationReferentId,
        pageKind: "organization",
        pinSource: "manual",
        pinState: "pinned",
        secondaryLabelSnapshot: pin.secondaryLabel,
        sortOrder,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("pinnedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: pin.href,
        labelSnapshot: pin.label,
        organizationKind: organization.organizationKind,
        organizationReferentId: organization.organizationReferentId,
        pageKey,
        pageKind: "organization",
        pinSource: "manual",
        pinState: "pinned",
        secondaryLabelSnapshot: pin.secondaryLabel,
        sortOrder,
        updatedAt: now,
        userId: access.userId,
      });
    }

    return pin;
  },
});

export const pinKnowledgePage = mutation({
  args: genericKnowledgePageInput,
  returns: sidebarPinnedKnowledgePage,
  handler: async (ctx, args): Promise<SidebarPinnedKnowledgePage> => {
    const access = await requireAppAccess(ctx);
    const page = normalizeGenericKnowledgePageInput(args);
    const now = Date.now();
    const existing = await getPinByPageKey(ctx, access.userId, page.pageKey);
    const sortOrder =
      existing?.sortOrder ??
      await getNextManualSortOrder(
        ctx,
        access.userId,
        access.organizations,
        access.systemRole === "systemAdmin",
      );
    const pin = buildGenericKnowledgePagePin(page, sortOrder);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: pin.href,
        labelSnapshot: pin.label,
        pageKind: pin.pageKind,
        pinSource: "manual",
        pinState: "pinned",
        secondaryLabelSnapshot: pin.secondaryLabel,
        sortOrder,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("pinnedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: pin.href,
        labelSnapshot: pin.label,
        pageKey: pin.pageKey,
        pageKind: pin.pageKind,
        pinSource: "manual",
        pinState: "pinned",
        secondaryLabelSnapshot: pin.secondaryLabel,
        sortOrder,
        updatedAt: now,
        userId: access.userId,
      });
    }

    return pin;
  },
});

export const unpinKnowledgePage = mutation({
  args: {
    pageKey: v.string(),
  },
  returns: v.object({
    pageKey: v.string(),
    state: unpinResultState,
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const defaultCandidate = getDefaultOrganizationPins(
      access.organizations,
      access.systemRole === "systemAdmin",
    ).find((candidate) => candidate.pageKey === args.pageKey);
    const existing = await getPinByPageKey(ctx, access.userId, args.pageKey);

    if (defaultCandidate) {
      const now = Date.now();
      if (existing) {
        await ctx.db.patch(existing._id, {
          hrefSnapshot: defaultCandidate.href,
          labelSnapshot: defaultCandidate.label,
          organizationKind: defaultCandidate.organizationKind,
          organizationReferentId: defaultCandidate.organizationReferentId,
          pageKind: "organization",
          pinSource: "defaultSeed",
          pinState: "suppressed",
          secondaryLabelSnapshot: defaultCandidate.secondaryLabel,
          sortOrder: existing.sortOrder,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("pinnedKnowledgePages", {
          createdAt: now,
          hrefSnapshot: defaultCandidate.href,
          labelSnapshot: defaultCandidate.label,
          organizationKind: defaultCandidate.organizationKind,
          organizationReferentId: defaultCandidate.organizationReferentId,
          pageKey: defaultCandidate.pageKey,
          pageKind: "organization",
          pinSource: "defaultSeed",
          pinState: "suppressed",
          secondaryLabelSnapshot: defaultCandidate.secondaryLabel,
          sortOrder: defaultCandidate.sortOrder,
          updatedAt: now,
          userId: access.userId,
        });
      }

      return { pageKey: args.pageKey, state: "suppressed" as const };
    }

    if (!existing) {
      return { pageKey: args.pageKey, state: "notPinned" as const };
    }

    await ctx.db.delete(existing._id);
    return { pageKey: args.pageKey, state: "deleted" as const };
  },
});

function getDefaultOrganizationPins(
  organizations: AllowedOrganization[],
  includeEveryOrganization = false,
): SidebarPinnedKnowledgePage[] {
  const seenKinds = new Set<OrganizationKind>();
  const pins: SidebarPinnedKnowledgePage[] = [];

  for (const organization of organizations) {
    if (
      !includeEveryOrganization &&
      seenKinds.has(organization.organizationKind)
    ) {
      continue;
    }

    seenKinds.add(organization.organizationKind);
    pins.push(
      buildOrganizationPin(
        organization,
        "defaultSeed",
        pins.length * SORT_ORDER_STEP,
      ),
    );
  }

  return pins;
}

function buildOrganizationPin(
  organization: AllowedOrganization,
  source: SidebarPinnedKnowledgePage["pinSource"],
  sortOrder: number,
): SidebarPinnedKnowledgePage {
  return {
    href: getOrganizationHref(organization.organizationReferentId),
    id: organization.organizationReferentId,
    label: organization.name,
    organizationKind: organization.organizationKind,
    organizationName: organization.name,
    organizationReferentId: organization.organizationReferentId,
    pageKind: "organization",
    pageKey: getOrganizationPageKey(organization.organizationReferentId),
    pinSource: source,
    secondaryLabel: formatOrganizationKind(organization.organizationKind),
    sortOrder,
  };
}

function toSidebarPin(
  record: PinRecord,
  organizationsByReferentId: Map<Id<"referents">, AllowedOrganization>,
): SidebarPinnedKnowledgePage | null {
  if (
    record.pageKind === "organization" &&
    record.organizationReferentId !== undefined &&
    record.organizationKind !== undefined
  ) {
    const organization = organizationsByReferentId.get(record.organizationReferentId);
    if (!organization) {
      return null;
    }

    return {
      href: getOrganizationHref(organization.organizationReferentId),
      id: organization.organizationReferentId,
      label: organization.name || record.labelSnapshot,
      organizationKind: organization.organizationKind,
      organizationName: organization.name || record.labelSnapshot,
      organizationReferentId: organization.organizationReferentId,
      pageKind: "organization",
      pageKey: record.pageKey,
      pinSource: record.pinSource,
      secondaryLabel:
        record.secondaryLabelSnapshot ??
        formatOrganizationKind(organization.organizationKind),
      sortOrder: record.sortOrder,
    };
  }

  if (record.pageKind === "organization") {
    return null;
  }

  return {
    href: record.hrefSnapshot,
    id: record.pageKey,
    label: record.labelSnapshot,
    pageKind: record.pageKind,
    pageKey: record.pageKey,
    pinSource: record.pinSource,
    secondaryLabel:
      record.secondaryLabelSnapshot ?? formatGenericKnowledgePageKind(record.pageKind),
    sortOrder: record.sortOrder,
  };
}

async function addSidebarPinThumbnail(
  ctx: QueryCtx,
  pin: SidebarPinnedKnowledgePage,
  access: {
    organizations: AllowedOrganization[];
    userId: Id<"users">;
  },
): Promise<SidebarPinnedKnowledgePage> {
  if (pin.organizationReferentId === undefined) {
    return pin;
  }

  const thumbnailUrl = await getRepresentedReferentThumbnailUrl(
    ctx,
    pin.organizationReferentId,
    {
      isEntryVisible: (entry) =>
        isEntryAccessibleToPinnedPageViewer(entry, access),
    },
  );

  return thumbnailUrl === undefined ? pin : { ...pin, thumbnailUrl };
}

function isEntryAccessibleToPinnedPageViewer(
  entry: Doc<"knowledgeEntries">,
  access: {
    organizations: AllowedOrganization[];
    userId: Id<"users">;
  },
) {
  return (
    isScopeAccessible(entry.visibilityKind, entry.visibilityTargetKey, access) ||
    isScopeAccessible(
      entry.discoverabilityKind,
      entry.discoverabilityTargetKey,
      access,
    )
  );
}

function isScopeAccessible(
  scopeKind: Doc<"knowledgeEntries">["visibilityKind"],
  targetKey: string,
  access: {
    organizations: AllowedOrganization[];
    userId: Id<"users">;
  },
) {
  if (scopeKind === "public") {
    return true;
  }

  if (scopeKind === "private") {
    return targetKey === `user:${access.userId}` || targetKey === access.userId;
  }

  if (scopeKind === "organization") {
    return access.organizations.some(
      (organization) =>
        organization.organizationReferentId === targetKey,
    );
  }

  return false;
}

async function getPinByPageKey(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  pageKey: string,
) {
  return await ctx.db
    .query("pinnedKnowledgePages")
    .withIndex("by_userId_and_pageKey", (q) =>
      q.eq("userId", userId).eq("pageKey", pageKey),
    )
    .unique();
}

async function getNextManualSortOrder(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizations: AllowedOrganization[],
  includeEveryDefaultOrganization: boolean,
) {
  const defaultFloor =
    getDefaultOrganizationPins(
      organizations,
      includeEveryDefaultOrganization,
    ).length * SORT_ORDER_STEP;
  const lastPinned = (
    await ctx.db
      .query("pinnedKnowledgePages")
      .withIndex("by_userId_and_pinState_and_sortOrder", (q) =>
        q.eq("userId", userId).eq("pinState", "pinned"),
      )
      .order("desc")
      .take(1)
  )[0];

  return Math.max(defaultFloor, (lastPinned?.sortOrder ?? 0) + SORT_ORDER_STEP);
}

function getOrganizationPageKey(organizationReferentId: Id<"referents">) {
  return `organization:${organizationReferentId}`;
}

function getOrganizationHref(organizationReferentId: Id<"referents">) {
  return `/organizations/${encodeURIComponent(organizationReferentId)}`;
}

function formatOrganizationKind(kind: OrganizationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

type GenericKnowledgePageInput = {
  href: string;
  label: string;
  pageKey: string;
  pageKind: Exclude<KnowledgePageRelationshipKind, "organization">;
  secondaryLabel?: string;
};

function normalizeGenericKnowledgePageInput(
  input: GenericKnowledgePageInput,
): Required<GenericKnowledgePageInput> {
  const pageKey = input.pageKey.trim();
  const label = input.label.trim();
  const href = input.href.trim();
  const secondaryLabel =
    input.secondaryLabel?.trim() || formatGenericKnowledgePageKind(input.pageKind);

  if (!pageKey) {
    throw new Error("Invalid Knowledge Page key");
  }
  if (!label) {
    throw new Error("Invalid Knowledge Page label");
  }
  if (!href.startsWith("/") || href.startsWith("//")) {
    throw new Error("Invalid Knowledge Page href");
  }
  if (!isGenericPageKeyValidForKind(input.pageKind, pageKey)) {
    throw new Error("Invalid Knowledge Page key");
  }

  return {
    href,
    label,
    pageKey,
    pageKind: input.pageKind,
    secondaryLabel,
  };
}

function buildGenericKnowledgePagePin(
  page: Required<GenericKnowledgePageInput>,
  sortOrder: number,
): SidebarPinnedKnowledgePage {
  return {
    href: page.href,
    id: page.pageKey,
    label: page.label,
    pageKind: page.pageKind,
    pageKey: page.pageKey,
    pinSource: "manual",
    secondaryLabel: page.secondaryLabel,
    sortOrder,
  };
}

function formatGenericKnowledgePageKind(
  kind: Exclude<KnowledgePageRelationshipKind, "organization">,
) {
  if (kind === "dashboard") {
    return "Dashboard";
  }
  if (kind === "scripture") {
    return "Bible Passage";
  }
  if (kind === "referent") {
    return "Referent Page";
  }
  if (kind === "context") {
    return "Context Page";
  }

  return "Search";
}

function isGenericPageKeyValidForKind(
  kind: Exclude<KnowledgePageRelationshipKind, "organization">,
  pageKey: string,
) {
  return pageKey.startsWith(`${kind}:`);
}
