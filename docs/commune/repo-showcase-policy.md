# Repository Showcase Policy

Repository Showcase is a distinct Commune room for presenting public repository metadata and discussion. It is not Coding Cornucopia, Developer Forge, Marketplace approval, or a repository execution service.

What the website may store and show:

- public repository URL and provider
- title, summary, branch, commit, license notes, and compatibility notes
- README preview and file-tree summary supplied by a public import or by the author
- screenshot notes or public links
- manifest status, risk flags, redaction notes, and moderation state
- selected-artifact sandbox review status when explicitly requested

What the website must not do from Repository Showcase:

- clone a whole repository
- install dependencies
- build, test, run, deploy, or execute repository scripts
- auto-train on repository contents
- claim license safety, secret cleanliness, Elysia compatibility, installability, trust, endorsement, or Marketplace readiness
- fake GitHub account connection, private repository access, or OAuth ownership

Public GitHub import is metadata assistance only. It can read public API/README/tree metadata into the form so the author can review and redact it before submission. It does not create an account connection and does not prove ownership or safety.

Local showcase manifest import is also metadata only. The browser reads the selected JSON file the user chooses or pasted JSON text, fills the form, and requires author review before submission. It never inspects local repository files.

Sandbox review in this room is selected-artifact only. A user may paste one public-safe file or snippet into the Repository Showcase sandbox review route. The sandbox runner may evaluate that selected artifact according to the Coding Cornucopia sandbox boundary, but the result is evidence only. It is not whole-repository approval.

Developer Forge and Marketplace remain separate. A Repository Showcase may later inform a Developer Forge proposal, but it cannot directly approve, publish, install, or list an add-on.
