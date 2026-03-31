export interface AiChatQueryParams {
  orgId?: string;
}

export function buildAiChatHref(params: AiChatQueryParams): string {
  const usp = new URLSearchParams();
  if (params.orgId) usp.set("orgId", params.orgId);
  const qs = usp.toString();
  return qs ? `/ai?${qs}` : `/ai`;
}

