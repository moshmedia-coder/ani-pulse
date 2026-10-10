<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the anime catalog in a browser-safe data module and homepage interactions in focused UI components; the portfolio homepage needs no server or streaming service.
- Store anime artwork as project asset pointers and import generated featured artwork directly; this keeps media reliable without external image hotlinks.
- Keep featured slideshow timing in a browser-only React hook with cleaned-up timers and manual pause; this isolates continuous animation from catalog interactions.
- Keep award recognitions alongside the browser-safe catalog with award year and source; this makes factual recognition traceable without a server dependency.
- Keep the branded navigation drawer and community sections in focused components; the homepage remains a portfolio experience with session-only voting, history, and collection state, not shared vote totals or user accounts.
