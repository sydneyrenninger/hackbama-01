/** Maps P0001 exception names raised by SQL functions to user-facing copy. */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sign in to continue.",
  listing_unavailable: "That listing is no longer available.",
  own_listing: "That's your own listing.",
  own_request: "That's your own request.",
  cross_campus_not_allowed: "This campus doesn't accept offers from your campus.",
  offer_rate_limited: "You've sent a lot of offers. Try again in a while.",
  offer_already_pending: "You already have a pending offer on this.",
  offer_not_found: "That offer doesn't exist or isn't yours.",
  offer_not_pending: "That offer has already been answered.",
  request_unavailable: "That request is closed or not visible to you.",
  message_required: "Add a message or attach one of your listings.",
  message_too_long: "Keep messages under 1,000 characters.",
  message_rate_limited: "You're sending messages too quickly. Wait a minute.",
  category_not_allowed: "This campus doesn't allow that category.",
  tenant_not_browsable: "You can't browse that campus.",
  exchange_size_invalid: "Trades need 2 or 3 people.",
  exchange_duplicate_listing: "Each listing can appear once per trade.",
  exchange_rate_limited: "You've proposed a lot of trades. Try again later.",
  exchange_must_start_with_own_listing: "Start a trade with one of your own listings.",
  exchange_needs_distinct_people: "Each listing in a trade must belong to a different person.",
  exchange_chain_invalid: "Those listings don't form a trade everyone wants.",
  exchange_not_found: "That trade doesn't exist or doesn't include you.",
  exchange_not_open: "That trade is no longer open.",
  exchange_not_accepted: "Everyone has to accept the trade first.",
  not_allowed_to_trade: "Your campus membership doesn't allow trading yet.",
};

export function friendlyDbError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Something went wrong.";
  if (err.message && MESSAGES[err.message]) return MESSAGES[err.message];
  if (err.code === "42501") return "You don't have permission to do that.";
  if (err.code === "23505") return "That already exists.";
  if (err.code === "23514") return "Some details aren't valid.";
  return "Something went wrong. Try again.";
}
