export const dealerCompanyLabel = (dealer: {
  company_name?: string | null;
  full_name?: string | null;
}) => dealer.company_name?.trim() || dealer.full_name?.trim() || "Dealer";

export const dealerCompanySlug = (dealer: {
  company_name?: string | null;
  full_name?: string | null;
}) =>
  dealerCompanyLabel(dealer)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
