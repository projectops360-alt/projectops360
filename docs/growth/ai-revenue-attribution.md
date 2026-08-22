# AI Referral → Signup → Paid Attribution

## Purpose
Measure whether AI discovery produces signups and verified paid revenue for ProjectOps360.

## Captured first/last touch
- source class: ai/search/social/referral/campaign/direct/other
- AI engine: ChatGPT, Gemini, Claude, Perplexity, Copilot
- UTM source/medium/campaign/content/term
- external referrer host
- landing path
- touch timestamp

The browser stores the first and most recent meaningful acquisition touch in first-party local storage. Signup sends both touches to the server. Signup remains successful if attribution storage or persistence fails.

## Server-side attribution
`acquisition_attribution` is keyed by `auth.users.id` and linked to the user's initial organization when available. No email address is copied into the attribution table.

## Paid conversion
`ai_revenue_attribution` joins acquisition data to organization subscriptions/plans. `paid_attributed_mrr` is deliberately conservative: it is non-zero only when the subscription is active, has a billing-provider subscription id, and the plan has a price.

## KPI query
```sql
select
  first_ai_engine,
  count(*) as signups,
  count(*) filter (where is_verified_paid) as paid_customers,
  sum(paid_attributed_mrr) as attributed_mrr
from public.ai_revenue_attribution
where first_source_class = 'ai'
group by first_ai_engine
order by attributed_mrr desc, signups desc;
```

## Campaign convention
For links we control, use:
`utm_source=chatgpt|gemini|claude|perplexity|copilot&utm_medium=ai_referral&utm_campaign=<campaign>`.
Native AI referrers are also detected by host when the platform sends a referrer.
