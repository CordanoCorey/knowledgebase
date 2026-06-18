import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  requireOrganizationAdmin,
  requireSystemAdmin,
} from "./lib/appAccess";
import {
  organizationMembershipRole,
  type OrganizationMembershipRole,
} from "./lib/organizationRoles";

const BASE_HUMAN_WEIGHT = 0;
const MAX_ORGANIZATION_ENTRIES_PER_REFERENT = 10;
const MAX_ORGANIZATION_MEMBERS = 100;
const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);
const organizationMemberStatus = v.union(
  v.literal("active"),
  v.literal("pending"),
);
const organizationMember = v.object({
  email: v.optional(v.string()),
  membershipId: v.id("memberships"),
  name: v.string(),
  role: organizationMembershipRole,
  status: organizationMemberStatus,
  userId: v.optional(v.id("users")),
});
const organizationMembershipSettings = v.object({
  members: v.array(organizationMember),
  name: v.string(),
  organizationEntryId: v.id("organizationEntries"),
  organizationKind,
  organizationReferentId: v.id("referents"),
});

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type OrganizationAccountCtx = MutationCtx | QueryCtx;

export const createOrganizationAccount = mutation({
  args: {
    name: v.string(),
    organizationKind,
  },
  returns: v.object({
    canonicalKey: v.string(),
    href: v.string(),
    name: v.string(),
    organizationEntryId: v.id("organizationEntries"),
    organizationKind,
    organizationReferentId: v.id("referents"),
  }),
  handler: async (ctx, args) => {
    const access = await requireSystemAdmin(ctx);
    const now = Date.now();
    const name = normalizeName(args.name);
    if (!name) {
      throw new Error("Organization name is required.");
    }

    const canonicalKey = normalizeLookupKey(name);
    const existingReferent = await getOrganizationReferentByKey(
      ctx,
      canonicalKey,
    );
    if (existingReferent) {
      throw new Error("Organization already exists.");
    }

    const organizationReferentId = await ctx.db.insert("referents", {
      canonicalKey,
      canonicalName: name,
      knowledgeType: "organization",
    });
    const primaryTagId = await ctx.db.insert("tags", {
      createdByUserId: access.userId,
      knowledgeType: "organization",
      label: name,
      lookupKey: canonicalKey,
      referentId: organizationReferentId,
    });
    const previewText = `${formatOrganizationKind(
      args.organizationKind,
    )} organization.`;
    const entryId = await ctx.db.insert("knowledgeEntries", {
      contextPreviewTagLabels: [],
      createdAt: now,
      createdByUserId: access.userId,
      discoverabilityKind: "public",
      discoverabilityTargetKey: "public",
      humanWeight: BASE_HUMAN_WEIGHT,
      knowledgeType: "organization",
      previewText,
      primaryTagId,
      primaryTagLabel: name,
      publicPreviewText: previewText,
      representedReferentId: organizationReferentId,
      searchText: `${name} ${args.organizationKind}`,
      title: name,
      updatedAt: now,
      visibilityKind: "public",
      visibilityTargetKey: "public",
    });
    await ctx.db.insert("entryTags", {
      entryId,
      taggedAt: now,
      taggedByUserId: access.userId,
      tagId: primaryTagId,
      tagPurpose: "represented",
    });
    const organizationEntryId = await ctx.db.insert("organizationEntries", {
      entryId,
      isActive: true,
      organizationKind: args.organizationKind,
    });

    return {
      canonicalKey,
      href: `/organizations/${canonicalKey}`,
      name,
      organizationEntryId,
      organizationKind: args.organizationKind,
      organizationReferentId,
    };
  },
});

export const getOrganizationMembershipSettings = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.union(organizationMembershipSettings, v.null()),
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      return null;
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const members = await listOrganizationMembers(
      ctx,
      organization.organizationReferentId,
    );

    return {
      ...organization,
      members,
    };
  },
});

export const addOrganizationMember = mutation({
  args: {
    email: v.string(),
    organizationId: v.string(),
    role: organizationMembershipRole,
  },
  returns: organizationMember,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("User email is required.");
    }

    const user = await getUserByEmail(ctx, email);
    const now = Date.now();
    if (!user) {
      const personReferentId = await upsertPendingMemberPerson(
        ctx,
        email,
        now,
      );
      const membershipId = await upsertPendingOrganizationMembership(ctx, {
        organizationReferentId: organization.organizationReferentId,
        personReferentId,
        role: args.role,
        updatedAt: now,
      });
      const membership = await ctx.db.get(membershipId);
      if (!membership) {
        throw new Error("Member setup failed.");
      }

      return await getPendingOrganizationMemberSummary(ctx, membership);
    }

    if (user.isActive !== true) {
      await ctx.db.patch(user._id, { isActive: true });
    }

    const personReferentId = await upsertUserProfile(ctx, user, email, now);
    const membershipId = await upsertOrganizationMembership(ctx, {
      memberUserId: user._id,
      organizationReferentId: organization.organizationReferentId,
      personReferentId,
      role: args.role,
      updatedAt: now,
    });
    const membership = await ctx.db.get(membershipId);
    if (!membership) {
      throw new Error("Member setup failed.");
    }

    return getOrganizationMemberSummary(user, membership);
  },
});

async function getOrganizationReferentByKey(
  ctx: OrganizationAccountCtx,
  canonicalKey: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", "organization").eq("canonicalKey", canonicalKey),
    )
    .unique();
}

async function getActiveOrganizationByRouteId(
  ctx: OrganizationAccountCtx,
  organizationId: string,
) {
  const directReferentId = ctx.db.normalizeId("referents", organizationId);
  const directReferent =
    directReferentId === null ? null : await ctx.db.get(directReferentId);
  const referent =
    directReferent?.knowledgeType === "organization"
      ? directReferent
      : await getOrganizationReferentByKey(
          ctx,
          normalizeLookupKey(organizationId),
        );
  if (!referent) {
    return null;
  }

  const organizationEntry = await getActiveOrganizationEntryByReferent(
    ctx,
    referent._id,
  );
  if (!organizationEntry) {
    return null;
  }

  return {
    name: organizationEntry.entry.title,
    organizationEntryId: organizationEntry.organizationEntry._id,
    organizationKind: organizationEntry.organizationEntry.organizationKind,
    organizationReferentId: referent._id,
  };
}

async function getActiveOrganizationEntryByReferent(
  ctx: OrganizationAccountCtx,
  organizationReferentId: Id<"referents">,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", organizationReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);

  for (const entry of entries) {
    if (entry.knowledgeType !== "organization") {
      continue;
    }

    const organizationEntry = await ctx.db
      .query("organizationEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
    if (!organizationEntry || organizationEntry.isActive === false) {
      continue;
    }

    return { entry, organizationEntry };
  }

  return null;
}

async function listOrganizationMembers(
  ctx: QueryCtx,
  organizationReferentId: Id<"referents">,
) {
  const activeMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("membershipStatus", "active"),
    )
    .take(MAX_ORGANIZATION_MEMBERS);
  const members = [];

  for (const membership of activeMemberships) {
    if (!membership.memberUserId) {
      continue;
    }

    const user = await ctx.db.get(membership.memberUserId);
    if (!user) {
      continue;
    }

    members.push(getOrganizationMemberSummary(user, membership));
  }

  const pendingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("membershipStatus", "invited"),
    )
    .take(MAX_ORGANIZATION_MEMBERS);

  for (const membership of pendingMemberships) {
    if (membership.memberUserId) {
      continue;
    }

    members.push(await getPendingOrganizationMemberSummary(ctx, membership));
  }

  return members;
}

async function getUserByEmail(ctx: MutationCtx, email: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (users.length > 1) {
    throw new Error("Multiple user accounts use that email.");
  }

  return users[0] ?? null;
}

async function upsertUserProfile(
  ctx: MutationCtx,
  user: Doc<"users">,
  email: string,
  now: number,
) {
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (existingProfile) {
    return existingProfile.personReferentId;
  }

  const name = normalizeName(user.name ?? email) || email;
  const canonicalKey = `user:${email}`;
  const personReferentId = await upsertReferent(ctx, {
    canonicalKey,
    canonicalName: name,
    knowledgeType: "person",
  });
  const personTagId = await upsertPrimaryTag(ctx, {
    knowledgeType: "person",
    label: name,
    lookupKey: canonicalKey,
    referentId: personReferentId,
  });
  const personEntryId = await upsertKnowledgeEntry(ctx, {
    knowledgeType: "person",
    previewText: email,
    primaryTagId: personTagId,
    primaryTagLabel: name,
    representedReferentId: personReferentId,
    searchText: `${name} ${email}`,
    title: name,
    updatedAt: now,
  });
  const personEntry = await ctx.db
    .query("personEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", personEntryId))
    .unique();
  if (!personEntry) {
    await ctx.db.insert("personEntries", { entryId: personEntryId });
  }

  await ctx.db.insert("userProfiles", {
    createdAt: now,
    personEntryId,
    personReferentId,
    personTagId,
    updatedAt: now,
    userId: user._id,
  });

  return personReferentId;
}

async function upsertPendingMemberPerson(
  ctx: MutationCtx,
  email: string,
  now: number,
) {
  const name = email;
  const canonicalKey = `contact-email:${email}`;
  const personReferentId = await upsertReferent(ctx, {
    canonicalKey,
    canonicalName: name,
    knowledgeType: "person",
  });
  const personTagId = await upsertPrimaryTag(ctx, {
    knowledgeType: "person",
    label: name,
    lookupKey: canonicalKey,
    referentId: personReferentId,
  });
  const personEntryId = await upsertKnowledgeEntry(ctx, {
    knowledgeType: "person",
    previewText: email,
    primaryTagId: personTagId,
    primaryTagLabel: name,
    representedReferentId: personReferentId,
    searchText: `${name} ${email}`,
    title: name,
    updatedAt: now,
  });
  const personEntry = await ctx.db
    .query("personEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", personEntryId))
    .unique();
  if (!personEntry) {
    await ctx.db.insert("personEntries", { entryId: personEntryId });
  }

  return personReferentId;
}

async function upsertOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    memberUserId: Id<"users">;
    organizationReferentId: Id<"referents">;
    personReferentId: Id<"referents">;
    role: OrganizationMembershipRole;
    updatedAt: number;
  },
) {
  const existingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_organizationReferentId", (q) =>
      q
        .eq("memberUserId", membership.memberUserId)
        .eq("organizationReferentId", membership.organizationReferentId),
    )
    .take(10);
  const existingMembership = existingMemberships[0];

  if (!existingMembership) {
    return await ctx.db.insert("memberships", {
      createdAt: membership.updatedAt,
      memberRole: membership.role,
      memberUserId: membership.memberUserId,
      membershipStatus: "active",
      organizationReferentId: membership.organizationReferentId,
      personReferentId: membership.personReferentId,
      targetKind: "organization",
      updatedAt: membership.updatedAt,
    });
  }

  const patch: Partial<Doc<"memberships">> = {};
  if (existingMembership.memberRole !== membership.role) {
    patch.memberRole = membership.role;
  }
  if (existingMembership.membershipStatus !== "active") {
    patch.membershipStatus = "active";
  }
  if (existingMembership.personReferentId !== membership.personReferentId) {
    patch.personReferentId = membership.personReferentId;
  }
  if (existingMembership.targetKind !== "organization") {
    patch.targetKind = "organization";
  }
  if (hasPatch(patch)) {
    patch.updatedAt = membership.updatedAt;
    await ctx.db.patch(existingMembership._id, patch);
  }

  return existingMembership._id;
}

async function upsertPendingOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    organizationReferentId: Id<"referents">;
    personReferentId: Id<"referents">;
    role: OrganizationMembershipRole;
    updatedAt: number;
  },
) {
  const existingMembership = await getPendingMembershipByPersonAndOrganization(
    ctx,
    membership.personReferentId,
    membership.organizationReferentId,
  );

  if (!existingMembership) {
    return await ctx.db.insert("memberships", {
      createdAt: membership.updatedAt,
      memberRole: membership.role,
      membershipStatus: "invited",
      organizationReferentId: membership.organizationReferentId,
      personReferentId: membership.personReferentId,
      targetKind: "organization",
      updatedAt: membership.updatedAt,
    });
  }

  const patch: Partial<Doc<"memberships">> = {};
  if (existingMembership.memberRole !== membership.role) {
    patch.memberRole = membership.role;
  }
  if (existingMembership.membershipStatus !== "invited") {
    patch.membershipStatus = "invited";
  }
  if (existingMembership.targetKind !== "organization") {
    patch.targetKind = "organization";
  }
  if (
    existingMembership.organizationReferentId !==
    membership.organizationReferentId
  ) {
    patch.organizationReferentId = membership.organizationReferentId;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = membership.updatedAt;
    await ctx.db.patch(existingMembership._id, patch);
  }

  return existingMembership._id;
}

async function getPendingMembershipByPersonAndOrganization(
  ctx: OrganizationAccountCtx,
  personReferentId: Id<"referents">,
  organizationReferentId: Id<"referents">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_personReferentId_and_membershipStatus", (q) =>
      q.eq("personReferentId", personReferentId).eq("membershipStatus", "invited"),
    )
    .take(10);

  return (
    memberships.find(
      (membership) =>
        membership.targetKind === "organization" &&
        membership.organizationReferentId === organizationReferentId &&
        membership.memberUserId === undefined,
    ) ?? null
  );
}

async function upsertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
  },
) {
  const existingReferent = await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q
        .eq("knowledgeType", referent.knowledgeType)
        .eq("canonicalKey", referent.canonicalKey),
    )
    .unique();
  if (!existingReferent) {
    return await ctx.db.insert("referents", referent);
  }

  const patch: Partial<Doc<"referents">> = {};
  if (existingReferent.canonicalName !== referent.canonicalName) {
    patch.canonicalName = referent.canonicalName;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingReferent._id, patch);
  }

  return existingReferent._id;
}

async function upsertPrimaryTag(
  ctx: MutationCtx,
  tag: {
    knowledgeType: Doc<"tags">["knowledgeType"];
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
) {
  const existingTag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", tag.knowledgeType).eq("lookupKey", tag.lookupKey),
    )
    .unique();
  if (!existingTag) {
    return await ctx.db.insert("tags", tag);
  }

  const patch: Partial<Doc<"tags">> = {};
  if (existingTag.label !== tag.label) {
    patch.label = tag.label;
  }
  if (existingTag.referentId !== tag.referentId) {
    patch.referentId = tag.referentId;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingTag._id, patch);
  }

  return existingTag._id;
}

async function upsertKnowledgeEntry(
  ctx: MutationCtx,
  entry: {
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    primaryTagId: Id<"tags">;
    primaryTagLabel: string;
    representedReferentId: Id<"referents">;
    searchText: string;
    title: string;
    updatedAt: number;
  },
) {
  const existingEntry = await getKnowledgeEntryByReferent(
    ctx,
    entry.representedReferentId,
    entry.knowledgeType,
  );
  const nextEntry = {
    contextPreviewTagLabels: [],
    discoverabilityKind: "public" as const,
    discoverabilityTargetKey: "public",
    humanWeight: BASE_HUMAN_WEIGHT,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagId: entry.primaryTagId,
    primaryTagLabel: entry.primaryTagLabel,
    representedReferentId: entry.representedReferentId,
    searchText: entry.searchText,
    title: entry.title,
    visibilityKind: "public" as const,
    visibilityTargetKey: "public",
  };

  if (!existingEntry) {
    return await ctx.db.insert("knowledgeEntries", {
      ...nextEntry,
      createdAt: entry.updatedAt,
      updatedAt: entry.updatedAt,
    });
  }

  const patch: Partial<Doc<"knowledgeEntries">> = {};
  if (existingEntry.title !== nextEntry.title) {
    patch.title = nextEntry.title;
  }
  if (existingEntry.previewText !== nextEntry.previewText) {
    patch.previewText = nextEntry.previewText;
  }
  if (existingEntry.searchText !== nextEntry.searchText) {
    patch.searchText = nextEntry.searchText;
  }
  if (existingEntry.primaryTagId !== nextEntry.primaryTagId) {
    patch.primaryTagId = nextEntry.primaryTagId;
  }
  if (existingEntry.primaryTagLabel !== nextEntry.primaryTagLabel) {
    patch.primaryTagLabel = nextEntry.primaryTagLabel;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = entry.updatedAt;
    await ctx.db.patch(existingEntry._id, patch);
  }

  return existingEntry._id;
}

async function getKnowledgeEntryByReferent(
  ctx: OrganizationAccountCtx,
  representedReferentId: Id<"referents">,
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"],
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", representedReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);

  return entries.find((entry) => entry.knowledgeType === knowledgeType) ?? null;
}

function getOrganizationMemberSummary(
  user: Doc<"users">,
  membership: Doc<"memberships">,
) {
  const email = user.email;
  return {
    ...(email === undefined ? {} : { email }),
    membershipId: membership._id,
    name: normalizeName(user.name ?? email ?? "Unknown user") || "Unknown user",
    role: membership.memberRole ?? "member",
    status: "active" as const,
    userId: user._id,
  };
}

async function getPendingOrganizationMemberSummary(
  ctx: OrganizationAccountCtx,
  membership: Doc<"memberships">,
) {
  const person = await getPersonSummary(ctx, membership.personReferentId);
  const email = person.email;
  return {
    ...(email === undefined ? {} : { email }),
    membershipId: membership._id,
    name: person.name,
    role: membership.memberRole ?? "member",
    status: "pending" as const,
  };
}

async function getPersonSummary(
  ctx: OrganizationAccountCtx,
  personReferentId: Id<"referents">,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", personReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);
  const personEntry =
    entries.find((entry) => entry.knowledgeType === "person") ?? null;
  if (personEntry) {
    const email = normalizeEmail(personEntry.previewText);
    return {
      email: isEmailLike(email) ? email : undefined,
      name:
        normalizeName(personEntry.title) ||
        (isEmailLike(email) ? email : "Pending member"),
    };
  }

  const referent = await ctx.db.get(personReferentId);
  const name = normalizeName(referent?.canonicalName ?? "Pending member");
  const email = normalizeEmail(referent?.canonicalName ?? "");

  return {
    email: isEmailLike(email) ? email : undefined,
    name: name || "Pending member",
  };
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}

function formatOrganizationKind(kind: OrganizationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
