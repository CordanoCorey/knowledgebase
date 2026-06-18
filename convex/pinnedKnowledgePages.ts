import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  requireAppAccess,
  type AllowedOrganization,
} from "./lib/appAccess";

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

const sidebarPinnedKnowledgePage = v.object({
  href: v.string(),
  id: v.string(),
  label: v.string(),
  organizationKind,
  organizationName: v.string(),
  organizationReferentId: v.id("referents"),
  pageKey: v.string(),
  pinSource,
  secondaryLabel: v.string(),
  sortOrder: v.number(),
});

const unpinResultState = v.union(
  v.literal("deleted"),
  v.literal("notPinned"),
  v.literal("suppressed"),
);

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type PinRecord = Doc<"pinnedKnowledgePages">;
type SidebarPinnedKnowledgePage = {
  href: string;
  id: string;
  label: string;
  organizationKind: OrganizationKind;
  organizationName: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  pinSource: "defaultSeed" | "manual";
  secondaryLabel: string;
  sortOrder: number;
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

    return visiblePins
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
      )
      .slice(0, MAX_USER_PIN_RECORDS);
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
    record.pageKind !== "organization" ||
    record.organizationReferentId === undefined ||
    record.organizationKind === undefined
  ) {
    return null;
  }

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
    pageKey: record.pageKey,
    pinSource: record.pinSource,
    secondaryLabel: formatOrganizationKind(organization.organizationKind),
    sortOrder: record.sortOrder,
  };
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
