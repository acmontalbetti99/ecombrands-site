# ecombrands.us

Static five-page site plus one serverless function for the inquiry form.
No build step, no framework, no npm dependencies.

```
index.html  about.html  how-we-build.html  how-we-think.html  work-with-us.html
api/inquiry.js        the form endpoint (Resend, via plain fetch)
assets/css/main.css   the whole design system
assets/js/main.js     all interaction, vanilla
assets/fonts/         Archivo Variable + JetBrains Mono, self-hosted
assets/img/           the logo, cropped only — never redrawn
vercel.json           clean URLs, caching, security headers
.env.example          the three variables the function needs
```

---

## ⚠️ Read this before touching DNS

**Your mailbox at `hello@ecombrands.us` already works. Do not change your
nameservers.**

Vercel will offer to take over your domain's nameservers. If you accept, every
record Dynadot currently holds — including the MX records that deliver your
email — stops being used, and mail to `hello@ecombrands.us` starts bouncing
until you rebuild them inside Vercel.

Keep Dynadot as your DNS host and just add records there. Everything below
assumes that. It is the boring path and it cannot break your email.

---

## Step 1 — GitHub

Git is already initialised with a first commit. Create an **empty** repo on
GitHub (no README, no .gitignore — this folder has both), then:

```bash
cd ecombrands
git remote add origin https://github.com/<your-username>/ecombrands-site.git
git branch -M main
git push -u origin main
```

`.gitignore` already excludes `.env`, `.env.local` and `.vercel`. Your Resend
key must never reach GitHub.

## Step 2 — Vercel

1. vercel.com → **Add New… → Project** → import the repo you just pushed.
2. Framework preset: **Other**. Leave build command and output directory empty.
3. **Deploy.**

You get a `*.vercel.app` URL. Open it — every page should work and the form
will report a configuration error, because the key isn't set yet. That error is
the function proving it is alive.

## Step 3 — Resend

1. resend.com → sign up → **Domains → Add Domain**.
2. Enter **`send.ecombrands.us`** — the subdomain, not the bare domain.

   This matters. Verifying the bare domain asks you to add an MX record on
   `ecombrands.us`, which is exactly where your mailbox's MX records live. The
   subdomain keeps sending and receiving completely separate.

3. Resend shows three records. Add each one in Dynadot (Step 5).
4. **API Keys → Create** → sending access → copy the `re_…` value. It is shown
   once.

## Step 4 — Environment variables in Vercel

**Settings → Environment Variables**, all three for Production, Preview and
Development:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | `re_…` from step 3 |
| `INQUIRY_TO` | `hello@ecombrands.us` |
| `INQUIRY_FROM` | `Ecom Brands <inquiries@send.ecombrands.us>` |

Then **Deployments → ⋯ → Redeploy**. Environment variables are read at boot, so
an existing deployment will not pick them up on its own.

## Step 5 — DNS at Dynadot

Dynadot → **My Domains → ecombrands.us → DNS Settings**. Make sure you are on
**Dynadot DNS** (the record editor), not **Name Servers**.

**Leave every existing MX record alone.**

### For the site

| Type | Host / Subdomain | Value |
|---|---|---|
| A | *(blank / @)* | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Copy the values **Vercel** shows you in *Settings → Domains* after you add
`ecombrands.us` there — they publish the current targets and the apex IP has
changed before. If what Vercel shows differs from the table, Vercel wins.

### For Resend

Three records, values taken from your own Resend dashboard:

| Type | Host | Roughly |
|---|---|---|
| MX | `send` | `feedback-smtp.<region>.amazonses.com`, priority 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | a long `p=MIGfMA0…` key |

Dynadot sometimes wants the host **without** the domain (`send`) and sometimes
with. Follow the placeholder text in its own form.

### Optional but worth it

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@ecombrands.us` |

`p=none` only asks for reports; it rejects nothing. Leave it a few weeks, read
what arrives, then decide whether to tighten it.

## Step 6 — Connect the domain

Vercel → **Settings → Domains → Add** → `ecombrands.us`. Add `www.ecombrands.us`
too and set one to redirect to the other (apex is the usual choice).

DNS takes anywhere from two minutes to an hour. Vercel issues the TLS
certificate by itself once it resolves.

## Step 7 — Prove it works

- [ ] `https://ecombrands.us` loads, `http://` redirects to `https://`
- [ ] `https://www.ecombrands.us` redirects to the apex
- [ ] All five pages load and the nav works
- [ ] Resend shows `send.ecombrands.us` as **Verified**
- [ ] Submit the form with your own address in the email field
- [ ] The email arrives at `hello@ecombrands.us`
- [ ] Hit **reply** — it addresses the sender, not yourself
- [ ] Resend → **Logs** shows the send as delivered

---

## How the form works

`work-with-us.html` posts JSON to `/api/inquiry`. The function validates,
strips control characters, checks the honeypot, rate-limits, and calls Resend.
The visitor's address goes in `Reply-To`, so answering is one click.

**Spam defences.** A hidden `website` field that only bots fill — submissions
carrying it get a `200` and are silently dropped, so the bot never learns. Plus
a 5-per-minute cap per IP. That cap lives in the memory of one warm serverless
instance, so a distributed flood can get past it. For an inquiry form on a B2B
site that is the right amount of defence. If it ever becomes a problem, add
Vercel's WAF or Cloudflare Turnstile.

**If the API is unreachable** the form falls back to opening the visitor's mail
client with everything pre-filled. That is also why the single-file preview
copy still works when opened from a desktop with no server.

## Local development

```bash
npm i -g vercel
vercel link
cp .env.example .env.local     # put your real key in it
vercel dev                     # http://localhost:3000
```

`.env.local` is gitignored.

## Things that will bite you later

**The Content-Security-Policy in `vercel.json` only allows resources from your
own domain.** That is why the site scores well and loads nothing third-party.
The moment you add Vercel Analytics, Google Analytics, a Meta pixel or an
embedded video, it will be blocked silently until you add that host to
`script-src` / `connect-src` / `frame-src`. Symptom: the tool reports zero
traffic and the browser console shows a CSP violation.

**`cleanUrls: true` is what makes `/about` work instead of `/about.html`.**
Removing it breaks every internal link at once.

**Fonts are cached for a year and immutable.** If you ever replace a `.woff2`,
change its filename too, or browsers will keep the old one.

**Assets are referenced from the site root (`/assets/…`).** The site must be
served from a domain root, not a subfolder.

## Editing content

Everything is plain HTML. Copy lives in the markup, not in a CMS. The design
system is one stylesheet, commented by section, and every value that matters is
a custom property in `:root`.

Notes for whoever edits this next:

- **One accent colour**, `--signal`. If it starts appearing everywhere, the
  system is breaking. The deeper `--signal-l` exists so white text on an orange
  button clears WCAG AA.
- **Display type is Archivo's width axis**, not its weight. Headlines animate
  from `wdth 66` to `wdth 118`. That expansion is the signature.
- **The mono layer** is the annotation system: section markers, coordinates,
  inputs and outputs, the live clock.
- Everything degrades: with JS off the site is a readable document, and
  `prefers-reduced-motion` turns off every animation.

## Deliberate omissions

No portfolio, no brand names, no product images, no statistics, no
testimonials, no headcount. The `work-with-us` page states plainly what cannot
be shared and why, which reads as discipline rather than evasion.
