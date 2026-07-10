# Link Every User to a Person Referent

Every signed-up User must be linked to exactly one Person Referent and canonical Person Tag, while a Person Knowledge Entry remains optional. This keeps User as authentication and access infrastructure, keeps Person as the taggable Knowledge Type, and lets other entries tag or relate to a user by referencing that user's Person Tag rather than treating User as a Knowledge Type.

Account-created, sysadmin-seeded, and pending-membership people should be created as reference-only Person referents unless someone contributes an actual Person Knowledge Entry. A Person can still become a Knowledge Entry later, but code-created identity records should not appear in the Answer Feed as though they were contributed knowledge.
