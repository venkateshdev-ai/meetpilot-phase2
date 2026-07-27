import { redirect } from "next/navigation";

// /tickets and /requests were two names for the same table, which meant two
// list UIs to keep in sync and an ambiguous mental model. "Request" is the
// term the product uses everywhere else (a request against a revenue system),
// so this path now redirects rather than rendering a second, divergent list.
// Detail pages stay at /tickets/[id] — only the list was duplicated.
export default function TicketsIndexRedirect() {
  redirect("/requests");
}
