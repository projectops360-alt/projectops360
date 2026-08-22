# Project Friction Intelligence public route hotfix

The public buyer-intent pillar `/project-friction-intelligence` must bypass locale/auth middleware in the same way as `/landing`.

Regression contract:
- anonymous requests to `/project-friction-intelligence` remain public;
- locale-aware authenticated application routes remain protected;
- the unlocalized-path unit test includes the pillar route.
