# Stale Order Recovery Check

Open an order after a long idle period and confirm recovery copy is still accurate.
Record idle duration, order state, and any required reconnect action.
Do not mutate production orders during this check.
