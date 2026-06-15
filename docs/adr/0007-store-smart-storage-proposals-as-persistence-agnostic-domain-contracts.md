# Store Smart Storage Proposals as Persistence-Agnostic Domain Contracts

Smart Storage Proposals store contract-shaped domain data instead of raw Convex write payloads. This keeps Silver Layer review records portable if the application migrates away from Convex or changes its internal schema, while acceptance remains responsible for validating the proposal and translating it into the current persistence model.
