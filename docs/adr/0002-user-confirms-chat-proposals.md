# 0002: The user confirms chat proposals

## Context
Model output and listing text can be wrong or adversarial. A watch write must remain the signed-in user's choice. [Design §12](../system-design.html).

## Decision
Chat tools propose new watches or changes. The user saves each proposal through their own authenticated Convex mutation.

## Alternatives
Allow the model to write watches directly. That removes the confirmation click but gives model mistakes write access.

## Trade-offs
The user makes one extra click for every write.

## Consequences
The model cannot change a watch by itself; proposed changes can target only the user's own watch ids.

## Status
Accepted

## Date
2026-09-27
