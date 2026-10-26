# Guest post marketplace (/guest-posts)

## Adding websites
Edit `data/guest-sites.json`. One object per site in `sites`:

```json
{ "id": "example-site", "name": "example.com", "da": 55, "pa": 45, "traffic": 120000,
  "niche": "Technology", "link": "dofollow", "priceUSD": 120, "priceINR": 9500 }
```
- `priceUSD` is required. `priceINR` is optional: if EVERY site has it, visitors in India see and pay in rupees.
- `link` is `dofollow` or `nofollow`. `traffic` is monthly visits (number). `id` must be unique and URL-safe.
- The 20% content discount is `discountContentProvided` (0.2).
- Prices are always recalculated on the server from this file, so edits take effect everywhere.

## Going live
The page is hidden from search (`noindex`) and not linked in the menu or sitemap while the list is empty.
When the list is filled: remove the `noindex` meta tag in `guest-posts.html`, add `/guest-posts` to the menu and `sitemap.xml`.

## Emails (needs RESEND_API_KEY, already used by the contact form)
- Checkout started: owner gets the full cart and customer details BEFORE payment.
- Left without paying: if a visitor typed their email and leaves with sites in the bucket, the owner gets an "Unpaid cart" email.
- Paid: owner and customer get a confirmation (needs a payment provider, below).

## Payments (set in Vercel > Project > Settings > Environment Variables)
- Stripe: `STRIPE_SECRET_KEY`; webhook endpoint `https://www.apexdigitalforge.in/api/guest-webhook?p=stripe` (event `checkout.session.completed`).
- Razorpay: `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`; webhook `https://www.apexdigitalforge.in/api/guest-webhook?p=razorpay` (event `payment_link.paid`).
- Without either, checkout still emails the owner and the customer; you send the payment link by hand.
- Always run one test payment in the provider's test mode before announcing the page.
