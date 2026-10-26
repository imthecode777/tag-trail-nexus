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

- The ESP32 remains the source of truth for users and roles; registration must POST to the reader and verify name, UID and role through GET /api/users before reporting success, to avoid browser-only registrations.
- Initialize connection settings with the shared default during SSR and load browser overrides after hydration, to keep server and browser output consistent.
