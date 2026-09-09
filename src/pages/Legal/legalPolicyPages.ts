import { archivedLegalPolicyPages } from "./economicLegalArchive.ts";
import { clarifyEconomicPolicy, readinessLegalVersion } from "./readinessLegalClarifications.ts";
export type LegalPolicyPage = {
  slug: string;
  route: string;
  title: string;
  status: string;
  lastUpdated: string;
  body: string;
};

export const legalPolicyPages: LegalPolicyPage[] = [
  {
    "slug": "acceptable-use-policy",
    "route": "/legal/acceptable-use-policy",
    "title": "Acceptable Use Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Acceptable Use Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis Acceptable Use Policy defines unacceptable uses of Elysia Ecobotics Online, Elysia-related public services, Marketplace submissions, Developer Forge tools, Living Library features, Commune features, Work With requests, Commons Circle accounts, and future local Elysia integration surfaces.\n\nThe goal is freedom with real boundaries: creative, educational, technical, ecological, and community work without enabling exploitation, harm, fraud, privacy invasion, or unsafe code.\n\n## 2. General prohibited uses\n\nYou may not use the site to violate law; commit fraud; mislead users; impersonate others; harass or threaten; expose private information; distribute malware; steal credentials; exfiltrate data; attack systems; evade moderation; manipulate reviews or trust labels; run scams; solicit unsafe donations; exploit children; distribute non-consensual intimate content; encourage targeted violence; facilitate stalking or doxxing; infringe intellectual property; bypass licensing or access controls; or abuse infrastructure.\n\n## 3. Security abuse\n\nDo not probe, scan, or test systems outside the Vulnerability Disclosure Policy; attempt unauthorized access; bypass authentication, RLS, or role checks; exploit local protocol handlers; attempt to access private local Elysia data; steal API keys; submit service-role keys; upload malware; create command-and-control tooling; overload the site; perform denial-of-service attacks; abuse rate limits; create bot floods; or coordinate attacks.\n\n## 4. Privacy abuse\n\nDo not post another person’s private information, publish private addresses, publish phone numbers or emails without permission, share private messages without consent, upload unredacted logs, upload receipts with personal/financial data, expose customer/user records, scrape personal profiles abusively, use the site for surveillance, or collect information for harassment, stalking, discrimination, or exploitation.\n\n## 5. Marketplace abuse\n\nDo not submit add-ons that steal data, hide behavior, run commands without approval, exfiltrate local files, access local Elysia memory without explicit permission, bypass local Elysia policy gates, conceal network calls, install malware, persist without approval, evade revocation, misrepresent review status, infringe licenses, impersonate official tools, include deceptive telemetry, or pressure users into unsafe installs.\n\n## 6. Commune abuse\n\nDo not use public community features to phish users, ask for passwords or tokens, trick users into running unsafe commands, publish exploit chains without responsible context, post malware, target beginners with scams, fake job offers, pressure private contact, harass users, publish private support information, share code that silently harms users, or post inflammatory content mainly to provoke abuse.\n\n## 7. Living Library abuse\n\nDo not use the Living Library to imply datasets are automatically training-safe, misrepresent licenses, scrape or mirror protected data, expose sensitive human or ecological data, launder copyrighted datasets into AI training, use official links to imply false endorsement, or submit source suggestions for spam/scams/malware/propaganda networks without disclosure.\n\n## 8. Donation and stewardship abuse\n\nDo not claim Elysia Ecobotics processes donations for independent organizations unless explicitly true; impersonate charities; post fake donation links; shame non-donors; promise authority or employment in exchange for donations; upload unredacted financial proof; or solicit funds through unofficial channels while implying official approval.\n\n## 9. Volunteer/work request abuse\n\nDo not submit fake identities, misrepresent qualifications, upload confidential employer/client material, submit sensitive personal records, ask for paid employment where no paid role exists and then claim acceptance, impersonate Elysia Ecobotics staff, or claim reviewer/moderator/admin status without assignment.\n\n## 10. Content manipulation\n\nDo not manipulate saved counts, reviews, badges, votes, or trust labels; create fake accounts to boost content; coordinate spam; use bots without permission; evade bans; hide sponsorships or material connections; or submit undisclosed advertisements.\n\n## 11. Illegal or regulated content\n\nDo not use the site for illegal activity or to distribute regulated goods or instructions in a way that creates legal or safety risk, including weapons trafficking, explosives, illegal drugs, stolen goods, counterfeit goods, hacking services, human trafficking, child exploitation, financial fraud, illegal surveillance tools, unlawful discrimination, or unauthorized medical/legal/financial services.\n\n## 12. AI/model misuse\n\nDo not use Elysia-related public tools to bypass model licenses, distribute unlicensed model weights, launder private data into training sets, generate harassment campaigns, impersonate real people deceptively, create non-consensual intimate imagery, automate scams, create malware or phishing at scale, or misrepresent AI output as verified fact.\n\n## 13. Enforcement\n\nViolations may result in warnings, redaction requests, content removal, account limits, suspension, termination, add-on rejection, revocation, security holds, and reporting to platforms or authorities where necessary.\n\n## 14. Good-faith exceptions\n\nGood-faith security research, journalism, education, criticism, research, or public-interest discussion may be allowed when it follows applicable policies, avoids unnecessary harm, protects private data, and does not enable abuse.\n\n## 15. Final rule\n\nBuild, share, learn, and disagree. Do not exploit, deceive, leak, or endanger.\n"
  },
  {
    "slug": "add-on-submission-policy",
    "route": "/legal/add-on-submission-policy",
    "title": "Add-on Submission Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Add-on Submission Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis policy explains how add-ons are submitted, reviewed, labeled, approved, rejected, deprecated, or blocked in The Elysia Marketplace. It protects local Elysia users, private local memory, local files and credentials, the public Marketplace, good-faith developers, and the commons around Elysia.\n\n## 2. Submission does not equal approval\n\nSubmitting an add-on does not make it approved, reviewed, trusted, official, safe, compatible, or installable. Community submissions are never auto-approved.\n\n## 3. Required submission materials\n\nA submission may require add-on name, slug/ID, publisher name, publisher profile, version, category, summary, description, license, source URL, package URL/upload method, manifest JSON, dependencies, permissions requested, actions exposed, network behavior, file access behavior, command execution behavior, Docker/container behavior, external account/API requirements, screenshots or documentation, support status, compatibility notes, security notes, and rollback/removal notes.\n\n## 4. Manifest requirements\n\nA manifest should declare schema version, add-on ID, name, publisher, version, category, trust tier requested if any, local-only status, network access, dependencies, actions, permissions, risk level, action kind, action label, required local operator approval, external accounts, files read or written, commands executed, model access, memory access, device access, logs produced, and uninstall behavior.\n\nA manifest is a declaration. Local Elysia must still verify and approve local actions.\n\n## 5. Review states and trust tiers\n\nSubmissions may move through states such as draft, submitted, needs changes, approved, security hold, rejected, deprecated, blocked, and revoked.\n\nPossible trust tiers include Official, Reviewed, Community, Unreviewed, Deprecated, and Blocked. Trust tiers are assigned through review. Developers cannot self-assign trust.\n\n## 6. Permission labels\n\nPermission labels may include Local-only, Networked, Uses Docker, Reads selected files, Writes files, Command execution, External account, API key required, Model access, Memory access requested, Device access, and Sandbox required.\n\n## 7. High-risk permissions\n\nThe following require extra review and may be rejected or restricted: arbitrary command execution, shell access, filesystem read/write outside approved scopes, access to local Elysia memory or vaults, network exfiltration, dependency installation, background services, Docker/container use, model downloading, browser automation, local server startup, credential storage, telemetry, device/camera/microphone access, automatic updates, and self-modifying behavior.\n\n## 8. Disallowed submissions\n\nAdd-ons may be rejected or blocked if they contain malware, steal data, exfiltrate secrets, bypass local Elysia approval, impersonate official components, conceal permissions, use deceptive UI, violate licenses, violate copyright, include stolen code, include unlicensed models/datasets, rely on illegal content, encourage illegal activity, target vulnerable users, include spyware, install persistent services without approval, run destructive commands, modify system settings without approval, evade review, or create unacceptable safety risk.\n\n## 9. Security review process\n\nReview may include manifest schema validation, declared-permission review, dependency review, license review, source inspection, package inspection, secret scanning, network behavior review, local sandbox test, uninstall/rollback review, compatibility review, reviewer decision, and labels.\n\n## 10. Documentation requirements\n\nAdd-ons should include clear purpose, install expectations, permissions explanation, configuration steps, known limitations, external service requirements, uninstall steps, safety notes, license and attribution information.\n\n## 11. Installation authority\n\nThe website does not silently install add-ons into local Elysia. Future install flow should be: Marketplace catalog → user chooses install/open → local Elysia validates manifest/package → local Elysia shows permissions → user approves or cancels → local Elysia installs outside the core folder → audit record is created.\n\n## 12. Add-on storage location\n\nLocal add-ons should live outside the Elysia core folder, such as in an `Elysia_Add-ons` sibling folder, so the private core remains clean and third-party files do not pollute core source.\n\n## 13. Sandboxing\n\nUnreviewed, experimental, high-risk, or command-executing add-ons should be tested in a sandbox or virtual machine. Some add-ons may require a Sandbox Required label before use.\n\n## 14. Approval, rejection, revocation, and appeals\n\nApproval means the add-on may be listed or made available according to its review status. Approval does not guarantee safety, suitability, compatibility, or legal fitness for every user.\n\nA submission may be rejected for incomplete manifests, unclear licensing, unsafe permissions, unresolved security concerns, misleading claims, inadequate documentation, or violation of policy.\n\nApproved add-ons may be revoked if later found unsafe, misleading, abandoned, vulnerable, license-infringing, malicious, or incompatible.\n\nDevelopers may request reconsideration with specific corrections, evidence, updated manifests, and relevant security or license information.\n\n## 15. Emergency action\n\nAdministrators may take emergency action to hide, block, revoke, or warn about an add-on where user safety, security, privacy, or legal compliance requires immediate action.\n\n## 16. Future payments\n\nPaid add-ons are not enabled unless separate policy and payment infrastructure exist. Developers may not imply official paid Marketplace support until implemented.\n"
  },
  {
    "slug": "code-of-conduct",
    "route": "/legal/code-of-conduct",
    "title": "Code of Conduct",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Code of Conduct\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis Code of Conduct governs participation in Elysia Ecobotics Online, Elysia Ecobotics public spaces, Marketplace development, Developer Forge work, Living Library curation, Commune participation, Work With requests, and related project communities.\n\nIt is meant to protect freedom of thought and speech while preventing abuse, exploitation, harassment, and reckless technical behavior.\n\n## 2. Project values\n\nParticipants should honor truth, dignity, privacy, stewardship, reality-contact, consent, humility, courage, ecological care, technical responsibility, repair over domination, and freedom without exploitation.\n\n## 3. Expected conduct\n\nParticipants are expected to be respectful, honest about uncertainty, cite sources where relevant, disclose conflicts of interest, credit others, respect licenses, avoid misleading claims, ask before escalating private contact, protect secrets, redact logs before sharing, help newcomers without condescension, accept correction when warranted, and challenge ideas without humiliating people.\n\n## 4. Unacceptable conduct\n\nUnacceptable conduct includes harassment, threats, stalking, doxxing, hate or dehumanization, sexual harassment, non-consensual sexual content, exploitation of minors, impersonation, scams, malicious code, credential theft, intimidation, repeated unwanted contact, sabotage, bad-faith reporting, spam, abuse of moderator processes, private-data exposure, discriminatory exclusion, violent encouragement, and retaliation against reporters.\n\n## 5. Power and authority\n\nTrust roles are not decorations.\n\nAdministrators, moderators, reviewers, guardians, Marketplace reviewers, source reviewers, and security reviewers must act proportionately, avoid conflicts of interest, explain decisions where practical, protect private information, avoid favoritism, avoid humiliation, document serious actions, recuse when needed, not use roles for personal retaliation, not demand private data unnecessarily, and not imply authority outside assigned scope.\n\n## 6. Contributor conduct\n\nContributors should submit work they have rights to submit, avoid copying code or content without license compliance, disclose AI-generated or AI-assisted work where important, respect review feedback, avoid hidden dependencies, write clear documentation, not submit confidential material, not pressure maintainers into unsafe merges, and not treat volunteer review as entitlement.\n\n## 7. Developer conduct\n\nDevelopers must not hide malicious behavior, smuggle permissions, mislabel licenses, mislead users about review status, collect unnecessary data, use add-ons for surveillance, bypass local Elysia policy gates, exploit beginners, or ship unsafe updates.\n\n## 8. Moderator conduct\n\nModerators should protect people without policing harmless difference, act against abuse/scams/leaks/malware, preserve room for good-faith disagreement, avoid ideological purity tests, be transparent where safety allows, not use moderation to win arguments, and escalate serious risks.\n\n## 9. Reporting\n\nReports may involve harassment, scams, malware, private data exposure, copyright issues, impersonation, unsafe code, false official claims, donation abuse, child safety risks, and security vulnerabilities.\n\nReport contacts: Conduct/moderation `abuse@elysiaecobotics.com`; Security `security@elysiaecobotics.com`; Copyright `dmca@elysiaecobotics.com`.\n\n## 10. Enforcement\n\nEnforcement may include warning, informal correction, required edit, redaction, temporary restriction, content removal, account suspension, ban, loss of role, add-on delisting, security hold, and administrator review.\n\n## 11. Appeals\n\nWhere practical, people may appeal enforcement decisions. Appeals should be specific, calm, and evidence-based. Appeals may be denied where they are abusive, repetitive, unsafe, legally constrained, or clearly bad faith.\n\n## 12. Community standard\n\nThe Code of Conduct is not meant to make the community sterile. It is meant to keep it human enough to be worth building.\n"
  },
  {
    "slug": "community-guidelines",
    "route": "/legal/community-guidelines",
    "title": "Community Guidelines",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Community Guidelines\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Community principle\n\nElysia Ecobotics Online should support freedom, creativity, disagreement, repair, education, experimentation, and public-interest collaboration.\n\nFreedom here does not mean freedom to exploit, harass, deceive, expose, endanger, scam, or manipulate others.\n\nThe Elysia Commune and other community areas should be welcoming to serious builders, learners, researchers, artists, developers, environmental stewards, and community members. They should not become unsafe, predatory, spam-filled, leaky, or reckless.\n\n## 2. Scope\n\nThese Guidelines apply to The Elysia Commune; comments, posts, drafts, and post requests; repository showcases; code-sharing areas; troubleshooting threads; Marketplace reviews and developer interactions; Living Library suggestions and reports; Work With requests; Commons Circle profiles and membership interactions; direct interactions with administrators, moderators, reviewers, contributors, or users; and any future chat, collaborative rooms, media uploads, or public messaging features.\n\n## 3. Expected behavior\n\nCommunity members should treat others with dignity, assume good faith when reasonable, respect boundaries, argue ideas without humiliating people, provide evidence when making factual claims, disclose uncertainty, cite sources, distinguish opinion from verified fact, respect local-first privacy boundaries, redact secrets before sharing logs or screenshots, follow licenses and attribution requirements, disclose conflicts of interest, avoid manipulative sales tactics, avoid impersonation, ask before moving a conversation into private contact, and report serious safety, security, or abuse concerns.\n\n## 4. Public/private boundary\n\nDo not post private Elysia memory, private logs, request traces, local vault content, `.env` files, API keys, tokens, passwords, local file paths that reveal private details, customer/user records, confidential employer or client material, unredacted receipts, private medical/legal/financial/identity documents, private messages without permission, or private personal data.\n\nPublic posts are not private support tickets.\n\n## 5. Commune-specific rules\n\nThe Commune is the riskiest public area. It may include blogging, troubleshooting, code sharing, repository showcases, research notes, job posts, community networking, and future chat or collaborative rooms.\n\nThe following are not allowed: uploading secrets or private logs; posting malware or deceptive code; instructing users to run unsafe commands without clear warnings; presenting unreviewed code as safe; pretending to be official; using support threads to phish users; requesting passwords, API keys, tokens, or private files; asking users to disable security protections without a clear, legitimate reason; manipulating users into installing unreviewed add-ons; posting fake job offers or scam opportunities; sharing sensitive ecological location data in a way that could enable harm.\n\n## 6. Disagreement and debate\n\nGood-faith disagreement is allowed. Criticism is allowed. Technical correction is allowed. Ethical disagreement is allowed.\n\nNot allowed: targeted harassment, stalking, threats, dehumanizing attacks, slurs or sustained abuse, dogpiling, malicious misrepresentation, intimidation, doxxing, encouraging others to harass, or repeatedly contacting someone after being asked to stop.\n\n## 7. Protected and vulnerable groups\n\nDo not attack people based on race, color, ethnicity, national origin, caste, religion, sex, gender identity, sexual orientation, disability, age, veteran status, immigration status, or other protected or vulnerable status.\n\nDiscussion of public policy, religion, identity, ethics, culture, ecology, and conflict is allowed when handled with care and evidence. Scapegoating, dehumanization, and harassment are not.\n\n## 8. Safety and crisis content\n\nElysia Ecobotics Online is not an emergency, medical, mental-health, legal, or crisis-response service. Do not use the site to encourage self-harm, provide instructions for violence, exploit someone in crisis, shame vulnerable users, present professional advice without qualification, or solicit emergency support through public comments.\n\n## 9. Code and repository sharing\n\nCode sharing is allowed when it is honest, appropriately licensed, and not deceptive.\n\nDo not hide malicious behavior, disguise command execution, exfiltrate files or secrets, bypass user consent, bypass local Elysia policy gates, submit code that silently runs external network calls, claim compatibility without testing or review, omit dangerous dependencies, misrepresent a license, or pressure users to run code outside a sandbox.\n\nCommunity code is not trusted by default.\n\n## 10. Research, data, and claims\n\nWhen sharing research notes or Living Library-linked work, cite sources, distinguish evidence from interpretation, note limitations, respect dataset licenses and consent, do not claim public data is automatically training-safe, avoid using data to target or expose individuals or communities, and treat Indigenous, ecological, health, humanitarian, refugee, and vulnerable-community data with extra care.\n\n## 11. Jobs, volunteering, and collaboration\n\nDo not post fake job offers, misleading paid-role claims, exploitative unpaid labor requests disguised as employment, requests for sensitive personal data in public, pressure to move into unsafe private channels, scams, affiliate traps, or deceptive opportunities.\n\nVolunteer and contributor roles must be transparent about whether they are paid, unpaid, project-based, speculative, or future interest only.\n\n## 12. Donation and stewardship discussions\n\nDo not solicit donations for personal or unverified causes through the Commune unless explicitly allowed and moderated. Do not impersonate independent nonprofits, claim partnership where none exists, post unredacted receipts, shame users who do not donate, promise membership authority in exchange for money, or use humanitarian crises to scam users.\n\n## 13. Moderation labels and actions\n\nFuture moderation may use labels such as Official, Community, Unreviewed, Needs redaction, Security hold, Resolved, Archived, Blocked, License unclear, Sandbox required, Security review needed, Experimental, Deprecated.\n\nModerators or administrators may ask for edits, request redaction, hide/remove content, restrict links, lock threads, disable comments, place content on security hold, reject posts or add-ons, revoke listings, suspend accounts, ban accounts, preserve records for review, and report serious threats, illegal content, or abuse where appropriate.\n\n## 14. Appeals and corrections\n\nWhere practical, users may ask for reconsideration of moderation decisions. Appeals should be calm, specific, and factual. We may decline appeals that are abusive, repetitive, bad-faith, unsafe, or legally constrained.\n\n## 15. Official accounts\n\nOnly authorized administrators may post official security notices, release notices, governance updates, or policy changes. Users may not impersonate Elysia Ecobotics, EcoSyneva Commons LLC, moderators, reviewers, developers, or official partners.\n\n## 16. Community ethos\n\nShare publicly. Redact first. Cite sources. Respect people. Respect licenses. Do not scam. Do not leak secrets. Do not pretend power is safety. Do not run untrusted code. Protect the private core. Help the living world with humility.\n"
  },
  {
    "slug": "dmca-copyright-policy",
    "route": "/legal/dmca-copyright-policy",
    "title": "DMCA / Copyright Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# DMCA / Copyright Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis policy explains how Elysia Ecobotics Online handles copyright complaints, takedown requests, counter-notices, repeat infringement, and copyright-related disputes.\n\nThe site may host or link to user content, add-ons, code snippets, repository showcases, documentation, images, posts, comments, source cards, and other materials. Copyright problems must be handled seriously and fairly.\n\n## 2. Important status note\n\nThis policy describes the public copyright complaint path. To rely on the DMCA safe-harbor process in the United States, a service provider generally needs to designate an agent and make that agent’s information available through the U.S. Copyright Office DMCA Designated Agent Directory and on its website.\n\nEcoSyneva Commons LLC should register or confirm designated-agent details before relying on formal DMCA safe-harbor procedures. Until then, copyright notices should use the contact below.\n\n## 3. Copyright contact\n\nCopyright and DMCA-related notices should be sent to `dmca@elysiaecobotics.com`. Include enough information to identify the copyrighted work, the allegedly infringing material, and how to contact the complaining party.\n\n## 4. Copyright complaints\n\nIf you believe material on Elysia Ecobotics Online infringes your copyright, send a written notice containing your physical or electronic signature; identification of the copyrighted work; identification of the allegedly infringing material and information sufficient to locate it; information sufficient to contact you; a good-faith belief statement that the use is not authorized by the copyright owner, its agent, or the law; and a statement under penalty of perjury that the information is accurate and you are authorized to act on behalf of the owner.\n\n## 5. What happens after a notice\n\nAfter receiving a copyright notice, we may remove the material, disable access, label or restrict content, notify the user who submitted it, request clarification, reject incomplete or abusive notices, preserve records, and terminate repeat infringers where appropriate.\n\n## 6. Counter-notice\n\nIf your content was removed because of a copyright complaint and you believe the removal was mistaken or misidentified, you may send a counter-notice containing your physical or electronic signature; identification of the material removed or disabled and its prior location; a statement under penalty of perjury that you have a good-faith belief the material was removed or disabled because of mistake or misidentification; your name, address, and phone number; and a statement consenting to the jurisdiction of the appropriate federal district court and accepting service of process from the complainant or their agent.\n\nCounter-notices can have legal consequences. Consider legal advice before sending one.\n\n## 7. Repeat infringer policy\n\nAccounts or users who repeatedly infringe copyright may be suspended, terminated, restricted, or blocked in appropriate circumstances.\n\nRepeat infringement may include repeated valid notices, court findings, clear evidence of infringement, or patterns of abusive content submission.\n\n## 8. False or abusive notices\n\nDo not send false copyright complaints. Misrepresentations can have legal consequences.\n\nCopyright complaints should not be used to silence criticism, commentary, fair use, competition, public-interest discussion, or material you merely dislike.\n\n## 9. Marketplace and add-ons\n\nDevelopers must not submit add-ons, packages, documentation, models, datasets, media, or code that infringe copyright. Add-ons may be rejected, delisted, blocked, or revoked for copyright concerns.\n\nDevelopers must disclose licenses and comply with attribution, source, copyleft, redistribution, patent, and model/data access requirements.\n\n## 10. Living Library\n\nThe Living Library links to official sources and provides metadata, not mirrored datasets by default. If a source link, excerpt, annotation, or metadata card raises copyright concern, contact us with enough information to identify the issue.\n\n## 11. Commune and user posts\n\nUsers may not post copyrighted material without permission, license, fair use, or other lawful basis. Do not upload full articles, books, paid datasets, proprietary manuals, unlicensed media, copied code, or private documents unless you have rights to share them.\n\n## 12. Non-copyright complaints\n\nThis policy is for copyright. Other issues may be handled under different policies, including trademark complaints, privacy violations, harassment, impersonation, defamation, malware, personal data exposure, license compliance not involving copyright takedown, and community violations.\n\n## 13. No legal advice\n\nThis policy is not legal advice. Copyright law is complex. Users, developers, and complainants are responsible for their own legal judgment.\n"
  },
  {
    "slug": "donation-recognition-terms",
    "route": "/legal/donation-recognition-terms",
    "title": "Donation Recognition Terms",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Donation Recognition Terms\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThe Commons Circle may recognize members who support independent stewardship organizations or contribute to public-benefit work. These terms explain how optional donation recognition should work.\n\n## 2. No donations to Elysia Ecobotics through this flow\n\nElysia Ecobotics Online does not process donations for independent organizations.\n\nIf you choose to support a stewardship organization, you donate directly through that organization’s own website or official channel.\n\nEcoSyneva Commons LLC does not receive, hold, process, refund, or receipt those donations through this flow.\n\n## 3. No partnership implied\n\nStewardship organization listings are informational.\n\nListing an organization does not imply partnership, sponsorship, endorsement, official affiliation, fundraising agreement, donation processing relationship, tax advice, or guarantee of effectiveness.\n\nUsers should review each organization directly before donating.\n\n## 4. Optional participation\n\nDonation recognition is optional. A user may create a Free Member account without donating. No one should be shamed, pressured, or excluded for not donating.\n\n## 5. Recognition is not authority\n\nDonation proof may support stewardship recognition, but it does not grant administrator authority, moderator authority, reviewer authority, Guardian / Reviewer role, developer approval, Marketplace trust, official status, employment, paid role, control over Elysia, or access to private local Elysia memory.\n\nAuthority roles are assigned by authorized administrators.\n\n## 6. Recognition may be reviewed\n\nAdministrator review may consider whether the proof appears redacted, whether the organization is listed or otherwise appropriate, whether the request appears genuine, whether the user follows community and privacy rules, whether recognition would be misleading, and whether there is abuse, fraud, or pressure.\n\nRecognition is not automatic.\n\n## 7. Minimal verification data\n\nA recognition request should store minimal information, such as user ID, organization ID/name, donation date, amount range, verification status, receipt reference or hash, proof file metadata, redaction confirmation, verified-at timestamp, and reviewer/admin ID if approved.\n\nExact donation amount should not be required when an amount range is sufficient.\n\n## 8. Amount ranges\n\nSuggested amount ranges: Under $10; $10–$24; $25–$49; $50–$99; $100–$249; $250+; Prefer not to say.\n\nRecognition should not become a wealth contest.\n\n## 9. Redaction requirement\n\nBefore uploading proof, redact card numbers, bank account details, billing address, full transaction IDs, tax IDs, legal ID numbers, private account details, personal notes, and unrelated personal information.\n\nDo not upload full unredacted receipts.\n\n## 10. Proof file handling\n\nAt launch, proof handling may be local metadata/hash only. Raw files should not be uploaded until private storage, RLS, administrator review, retention, and deletion processes are built.\n\nIf proof upload becomes active, proof files should be stored in a private bucket with restricted access and should not be public.\n\n## 11. Verification statuses\n\nPossible statuses include draft_local, pending_admin_review_local, pending_review, needs_redaction, approved, rejected, withdrawn, and deleted.\n\nLocal-only statuses do not mean administrator review is live.\n\n## 12. Badges and tiers\n\nPossible recognition may include Stewardship Supporter, Water Steward, Forest Steward, Reef Steward, Health Steward, Knowledge Commons Supporter, and Steward Member.\n\nBadges and tiers are ultimately assigned by authorized administrators.\n\n## 13. Fraud and misuse\n\nWe may reject, remove, or reverse recognition where there is evidence of fabricated proof, unredacted sensitive data, impersonation, donation scams, pressure or coercion, false affiliation claims, repeated abuse, policy violations, or misuse of badges.\n\n## 14. Tax and legal disclaimer\n\nEcoSyneva Commons LLC does not provide tax advice. Donations made directly to independent organizations may or may not be tax-deductible depending on the organization, jurisdiction, donor status, and law. Consult the organization and a qualified advisor if needed.\n\nEcoSyneva Commons LLC does not issue donation receipts for donations made to independent organizations.\n\n## 15. Organization changes\n\nThe list of stewardship organizations may change. Organizations may be added, removed, paused, or labeled with caution notes.\n\n## 16. No guarantee of organization performance\n\nWe cannot guarantee how an independent organization uses funds, how effective it is, or whether its programs change. Users should research organizations directly.\n\n## 17. Future administrator workflow\n\nA future workflow may include: user donates directly to an independent organization; user returns to Commons Circle; user uploads redacted proof or proof metadata; administrator reviews minimal information; administrator approves, rejects, or requests redaction; badge or recognition is assigned if approved.\n\nUntil that workflow is live, local drafts are not submitted to an administrator.\n"
  },
  {
    "slug": "marketplace-developer-agreement",
    "route": "/legal/marketplace-developer-agreement",
    "title": "Marketplace Developer Agreement",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Marketplace Developer Agreement\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis Marketplace Developer Agreement governs developers, publishers, organizations, and contributors who submit add-ons, manifests, extensions, themes, tools, integrations, packages, scripts, or related materials to The Elysia Marketplace.\n\nThe Marketplace exists to grow Elysia capability without stuffing every experiment into the private local Elysia core. Public catalog outside. Local Elysia authority inside.\n\n## 2. Core rule\n\nMarketplace manifests are declarations, not permission grants.\n\nA developer may declare what an add-on wants to do. That does not mean the website, Elysia Ecobotics, or local Elysia grants that power automatically.\n\nLocal Elysia remains the final authority for local installation, permissions, execution, enablement, disablement, removal, and revocation.\n\n## 3. Developer eligibility\n\nTo submit add-ons, you may be required to create a Commons Profile, create or request a developer profile, provide accurate publisher information, disclose source links, disclose affiliations, accept this Agreement, accept the Add-on Submission Policy, accept security review requirements, and comply with licenses and laws.\n\nDeveloper status cannot be self-assigned as trusted, official, reviewed, guardian, moderator, or administrator.\n\n## 4. Developer responsibility\n\nYou are responsible for add-on code, manifests, package contents, dependencies, documentation, permission declarations, updates, network behavior, file access behavior, command execution behavior, model access behavior, data collection, external accounts or APIs, licensing, security, support statements, compatibility claims, removal, and update notices.\n\n## 5. No hidden behavior\n\nAdd-ons must not hide behavior from users or reviewers. You must disclose filesystem access, command execution, network access, external accounts, API keys required, model calls, Docker/container use, device access, background tasks, telemetry, logging, data upload, dependency installation, self-updating behavior, post-install scripts, AI model downloads, and sensitive permissions.\n\n## 6. Prohibited add-on behavior\n\nAdd-ons may not steal credentials, exfiltrate files, upload private Elysia memory, read local vaults without explicit permission, bypass local Elysia permission gates, bypass user approval, silently execute commands, persist outside approved folders, install malware, hide network calls, modify unrelated user files, disable security controls, impersonate official Elysia components, misrepresent review status, evade revocation, exploit users, harvest personal information, violate law, violate third-party licenses, or create unacceptable safety risk.\n\n## 7. Permissions and risk labels\n\nAdd-ons may receive labels such as Official Elysia Add-on, Community Add-on, Verified Developer, Manifest Validated, Security Reviewed, Experimental, Sandbox Recommended, Sandbox Required, External Network Access, Filesystem Access, Command Execution, Docker Required, Reads Selected Files, Uses External Account, Unreviewed, Deprecated, Revoked, or Blocked.\n\nLabels are assigned by review process, not by developer assertion.\n\n## 8. Official status\n\nYou may not claim an add-on is official, endorsed, reviewed, approved, secure, safe, verified, or compatible unless that status has been granted through the applicable process.\n\n## 9. Licensing\n\nYou must identify the license for your add-on and significant dependencies. You must not submit code, media, datasets, model files, documentation, or assets unless you have the right to submit and distribute them. If your add-on uses open-source code, you must comply with attribution, notice, source availability, copyleft, patent, redistribution, and other license requirements. If your add-on uses model files, data, or APIs with access conditions, you must disclose those conditions.\n\n## 10. Dependencies\n\nYou must disclose meaningful dependencies, including Python packages, Node packages, Rust crates, system packages, container images, model files, API services, binaries, native libraries, external CLIs, and browser automation dependencies. You should pin versions where practical and explain installation risk.\n\n## 11. Security review\n\nSubmitting an add-on does not guarantee approval. Review may include manifest validation, license review, dependency review, static inspection, local sandbox testing, network behavior review, permissions review, secret scanning, documentation review, abuse-risk review, and compatibility review. Review may be incomplete. A reviewed add-on is not guaranteed safe.\n\n## 12. Updates\n\nUpdates may require re-review when they change permissions, dependencies, execution behavior, network behavior, file access, license terms, packaging, maintainer identity, compatibility claims, security posture, or user data practices. You must not use updates to smuggle behavior that would not have been approved during review.\n\n## 13. Revocation and removal\n\nEcoSyneva Commons LLC may reject, delist, deprecate, revoke, block, or warn about an add-on for safety, legal, licensing, security, abuse, compatibility, or policy reasons. Local Elysia may also block revoked add-ons if revocation infrastructure is implemented.\n\n## 14. Payments and monetization\n\nMarketplace payments are not active unless explicitly implemented and governed by separate terms. Some community add-ons may later be free or paid depending on developer and marketplace policy. Paid add-ons require additional terms, tax/accounting review, refund policy, abuse controls, and developer agreements. Do not collect payment through unofficial channels while claiming Marketplace approval.\n\n## 15. Privacy and data collection\n\nIf an add-on collects, stores, transmits, or processes user data, you must disclose what data is collected, why it is collected, where it is stored, whether it leaves the local machine, how long it is retained, how users can disable or delete it, and what external services receive it. Add-ons must not collect more data than needed.\n\n## 16. Support, incidents, and maintenance\n\nYou are responsible for honestly stating whether an add-on is maintained, experimental, archived, unsupported, or proof-of-concept. If you learn of a vulnerability in your add-on, you must notify Marketplace reviewers or administrators promptly and cooperate with mitigation. Serious vulnerabilities may trigger delisting, revocation, warning labels, or emergency notices.\n\n## 17. Relationship\n\nSubmitting add-ons does not make you an employee, agent, partner, representative, or official spokesperson of EcoSyneva Commons LLC.\n\n## 18. Termination\n\nViolation of this Agreement may result in rejection, delisting, account suspension, developer status removal, public warnings, security holds, or other action.\n"
  },
  {
    "slug": "privacy-policy",
    "route": "/legal/privacy-policy",
    "title": "Privacy Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Privacy Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Plain-language promise\n\nElysia Ecobotics Online is the public website and account ecosystem around Elysia. The private local Elysia core is separate.\n\nWe will not silently access private local Elysia memory, vaults, files, logs, passwords, credentials, request traces, machine inventory, or private project context. Local Elysia data remains local unless a user explicitly chooses a narrow export, upload, account-link, add-on install, or connection action.\n\nThis Privacy Policy explains what information the public website may collect, how it may use that information, what is intentionally not collected, and what will require explicit future design before it becomes active.\n\n## 2. Scope\n\nThis Privacy Policy applies to the public website and public-facing features of Elysia Ecobotics Online, including the Archive, Marketplace, Products, Lab, Developer Forge, Living Library, Commune, Work With Elysia Ecobotics, Commons Circle, Story, About, Mission, and account/profile/submission/review features connected to those pages.\n\nThis Privacy Policy does not automatically apply to third-party websites, independent nonprofit organizations, GitHub/GitLab/Codeberg/Forgejo repositories, Supabase, Cloudflare, payment processors, model repositories, dataset portals, or external services except as described here. Those services have their own privacy policies and terms.\n\nThis Privacy Policy does not convert the private local Elysia application into a cloud service. Local Elysia remains controlled by the user on the user’s own machine unless the user explicitly chooses otherwise.\n\n## 3. Information we may collect\n\nDepending on what features are enabled and what you choose to use, we may collect the following categories of information.\n\n### 3.1 Account information\n\nIf you create a website account, we may process email address, authentication identifiers, account creation and login metadata, password authentication handled by the authentication provider, session tokens or authentication cookies, account status, and security or abuse-prevention logs. We should not receive or store your password in plaintext.\n\nYour website account is not your local Elysia account. Do not enter your local Elysia password into the public website.\n\n### 3.2 Commons Profile information\n\nIf you create a Commons Profile, we may collect username, display name, public bio, interests, website link, GitHub or public developer links, developer-profile request flag, profile visibility preferences, membership status, and badges when those systems become active.\n\nCommons Profile data is public-site profile data. It does not overwrite local Elysia identity, local memory, local vault content, local files, or local passwords.\n\n### 3.3 Marketplace information\n\nThe Elysia Marketplace may process saved add-ons, add-on submissions, publisher/developer profile information, add-on manifest data, add-on permissions and risk labels, review status, moderation or security-review notes, compatibility metadata, and public catalog metadata.\n\nThe Marketplace is a public catalog and review surface. It does not silently install add-ons into local Elysia. Local installation requires local Elysia-controlled approval and future local installer machinery.\n\n### 3.4 Living Library information\n\nThe Living Library may process saved sources, saved citations, local or future account-backed collections, source suggestions, broken-link reports, tags, filters, and source-card metadata.\n\nThe Living Library stores metadata, annotations, access notes, risk labels, citations, and official links. It does not mirror giant datasets, certify that all data is training-safe, or connect public website resources to private Elysia memory.\n\n### 3.5 Commune information\n\nThe Elysia Commune may eventually process public posts, post drafts and post requests, comments, troubleshooting threads, repository showcase drafts, code-sharing notes, code-sandbox requests, reports, moderation records, and public profile references.\n\nThe Commune is public-facing. Do not upload secrets, private Elysia memory, private logs, `.env` files, credentials, personal documents, unredacted customer/user data, or confidential employer/client material.\n\nAt launch, some Commune functions may be local draft-only and stored in the user’s browser until a backend review queue exists.\n\n### 3.6 Work With Elysia Ecobotics information\n\nIf you request to volunteer, contribute, collaborate, or express future paid-role interest, we may process name or display name, email or preferred contact, Commons username, request type, skills, experience, availability, links, portfolio information, message text, and administrator-review status.\n\nUnless a backend administrator review queue is live, these requests may be stored locally in your browser as drafts or pending-review placeholders.\n\nDo not submit sensitive personal data, tax information, bank details, Social Security numbers, legal ID scans, birthdates, health information, or confidential employer/client material.\n\n### 3.7 Stewardship recognition and donation verification information\n\nElysia Ecobotics Online does not process donations for independent organizations. If you donate to an independent nonprofit or stewardship organization, you donate directly to that organization through its own website.\n\nIf stewardship recognition verification becomes active, we may collect minimal verification information such as user ID, organization ID/name, donation date, amount range, verification status, receipt reference or hash, proof file metadata, redaction confirmation, verified-at timestamp, and reviewer/admin record.\n\nWe should not store full card numbers, bank account details, billing addresses, full unredacted receipts, tax documents, or unnecessary transaction IDs. If proof upload becomes active, it must use a private storage bucket, access controls, retention rules, and administrator review workflow.\n\n### 3.8 Technical and security information\n\nWhen you visit the site, our hosting, authentication, logging, and security providers may process technical information such as IP address, browser type/version, device and operating-system information, request timestamps, URLs requested, referrer information, error logs, cookies/tokens used for authentication, and security or abuse-prevention signals.\n\nWe use this information to keep the site available, secure, and functional.\n\n### 3.9 Local browser storage\n\nSome features use local browser storage before backend account sync is built. Local browser storage may include saved Living Library sources, citations, collections, Commune drafts, Work With request drafts, Commons Circle onboarding state, stewardship verification draft metadata, and privacy preference placeholders.\n\nLocal browser storage remains in your browser unless you clear it, export it, or a future account-sync feature is deliberately built. It is not secure storage for secrets.\n\n### 3.10 Optional future local Elysia linking\n\nFuture local Elysia linking must be explicit, narrow, revocable, and controlled by local Elysia. Private memory, vaults, logs, files, local passwords, credentials, and machine data do not sync by default.\n\nIf a future local Elysia account link is built, it should explain what is being linked, what data may leave the local machine, what remains local, how to disconnect, what tokens are stored and where, what permissions are granted, and what audit logs are created.\n\n## 4. Information we do not want you to submit\n\nDo not submit API keys, access tokens, passwords, private keys, `.env` files, Supabase service-role keys, Cloudflare tokens, GitHub tokens, private local file paths, private Elysia memory, local Elysia vault content, private logs, unredacted screenshots, customer/user data, Social Security numbers, bank account information, card numbers, tax documents, confidential employer/client material, non-consensual intimate content, medical records, protected educational records, private addresses, doxxing information, or information about another person without consent.\n\nIf such material is submitted, we may remove it, restrict it, redact it, block it, or disable the account or feature involved.\n\n## 5. How we use information\n\nWe may use information to provide and improve the site, create and maintain accounts and profiles, authenticate users, save public-site preferences, display public profile information chosen by the user, process add-on submissions and Marketplace reviews, support Living Library curation, support Commune posts and moderation, process Work With requests, process stewardship recognition drafts or future administrator review, prevent spam/abuse/scams/malware/harassment, enforce policies, respond to security reports, investigate incidents, comply with legal obligations, and protect users, the public site, local Elysia users, and the commons around Elysia.\n\n## 6. How we share information\n\nWe may share information only as reasonably needed for public website operation, security, compliance, and moderation.\n\nService providers may include hosting, authentication, storage, source control, deployment, email, security, or moderation tooling. Examples may include Cloudflare, Supabase, GitHub, and future tools intentionally added to the website stack.\n\nIf you publish or submit content for public posting, the public portions of that content may become visible to other users. Public posts are not private support tickets.\n\nInformation may be reviewed by administrators, moderators, reviewers, or security personnel when needed for abuse reports, safety concerns, security reviews, add-on review, copyright complaints, policy enforcement, account integrity, or legal compliance.\n\nWe may disclose information if required by law or if we believe disclosure is necessary to protect rights, safety, security, users, infrastructure, or the public.\n\nWe do not intend to sell personal information. We do not intend to build this site around surveillance advertising.\n\n## 7. Cookies and similar technologies\n\nThe site may use cookies, localStorage, sessionStorage, or similar browser storage for authentication, session state, saved items, account preferences, local drafts, security, and feature functionality.\n\nWe should avoid unnecessary tracking cookies. We should not use third-party advertising trackers by default.\n\n## 8. Third-party links and services\n\nElysia Ecobotics Online links to independent nonprofits, research portals, public repositories, source documentation, model repositories, public datasets, and other external websites. External links are not controlled by EcoSyneva Commons LLC. Review the privacy policy, terms, licenses, and risks of each external site before using it.\n\n## 9. Data retention\n\nWe keep information only as long as needed for the purposes described in this policy, unless a longer period is required for security, legal, audit, anti-abuse, dispute, or operational reasons.\n\nFuture retention rules should distinguish between account data, public posts, moderation logs, security logs, add-on review records, donation verification metadata, proof files, local browser drafts, and deleted/withdrawn content.\n\nProof files, if ever accepted, should have a limited retention period and deletion process.\n\n## 10. Deletion, access, and correction\n\nUsers should be able to request correction, deletion, or export of personal account data where practical and lawful. Some records may need to be retained for security incidents, moderation history, add-on safety records, abuse prevention, legal compliance, accounting, or proof of policy enforcement.\n\n## 11. Children\n\nElysia Ecobotics Online is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn that a child under 13 provided personal information, we will take appropriate steps to delete it.\n\nUsers under the age of majority should use the site only with appropriate parent or guardian involvement.\n\n## 12. Security\n\nWe use reasonable safeguards appropriate to the public website’s stage and risk. These may include access controls, HTTPS, authentication, limited collection, RLS where Supabase is used, local-only draft flows where backend review is not ready, and administrator review for sensitive workflows.\n\nNo online system is perfectly secure. Users should not submit secrets or sensitive private information to public forms.\n\n## 13. International users\n\nThe site is operated from the United States. If you access the site from another country, your information may be processed in the United States or by service providers in other jurisdictions.\n\nFuture international compliance, including region-specific privacy rights, may require additional review as the site grows.\n\n## 14. Changes\n\nWe may update this Privacy Policy. If changes are material, we should provide a visible notice or update date. Continued use after changes means the updated policy applies.\n\n## 15. Official contacts\n\nPrivacy contact: `privacy@elysiaecobotics.com`  \nSecurity contact: `security@elysiaecobotics.com`  \nAbuse/moderation contact: `abuse@elysiaecobotics.com`\n"
  },
  {
    "slug": "security-review-policy",
    "route": "/legal/security-review-policy",
    "title": "Security Review Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Security Review Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis policy describes how Elysia Ecobotics Online approaches security review for website features, Marketplace add-ons, Developer Forge submissions, Commune code sharing, repository showcases, and future local Elysia integrations.\n\nSecurity review is not theater. It is a practical boundary system designed to keep capability from becoming reckless.\n\n## 2. Scope\n\nThis policy may apply to Marketplace add-ons, manifests, add-on packages, Developer Forge templates, repository showcases, code snippets, Commune sandbox requests, public website features, account features, Supabase tables and RLS, Cloudflare deployment behavior, local Elysia install flows, future protocol handlers, download artifacts, release checksums, and signatures.\n\n## 3. Security review is limited\n\nA security review reduces risk. It does not eliminate risk. Reviewed does not mean perfectly safe. Security Reviewed does not mean bug-free, exploit-proof, legally safe, or appropriate for every user.\n\n## 4. Core boundaries\n\nSecurity review protects the boundaries between website account data and private local Elysia data, public catalog and local execution, manifest declaration and local permission grant, community code sharing and code execution, local drafts and backend submissions, administrator review and self-assigned authority, public links and mirrored datasets, optional external services and the default private core.\n\n## 5. Threat model\n\nReview should consider credential theft, local file exfiltration, private memory exposure, `.env` leakage, malware, dependency confusion, malicious updates, command injection, cross-site scripting, insecure direct object references, RLS bypass, account takeover, phishing, impersonation, scam donation flows, malicious repository showcases, unsafe code snippets, prompt-injection-like manipulation of users or tools, unauthorized local protocol actions, data overcollection, privacy-invasive telemetry, license laundering, and model/data access violations.\n\n## 6. Review labels and levels\n\nPossible security labels include Unreviewed, Manifest Validated, Security Reviewed, Experimental, Sandbox Recommended, Sandbox Required, Network Access, File Access, Command Execution, External Account Required, API Key Required, Docker/Container Use, License Unclear, Needs Changes, Security Hold, Deprecated, Blocked, and Revoked.\n\nReview levels may include: no review; format validation; manual metadata review; source/package review; sandbox test; official or trusted release review with provenance, checksums/signatures, and maintainer accountability.\n\n## 7. Minimum review for Marketplace listing\n\nBefore a Marketplace add-on is marked approved, reviewers should check manifest completeness, permissions, source/package availability, license, dependencies, declared network access, declared file access, declared command execution, external account/API requirements, install/uninstall notes, compatibility notes, risk labels, and misleading claims.\n\n## 8. Automatic and human checks\n\nAutomatic checks may include schema validation, secret scanning, dependency vulnerability scanning, package diffing, file type inspection, path guard checks, unsafe command detection, license detection, checksum verification, signature verification, route smoke tests, type checks, and build checks. Automatic checks do not replace human review.\n\nHuman review should ask what the add-on claims to do, what it can actually do, what permissions it requests, what happens if it is malicious or buggy, what data it can touch, what leaves the local machine, what dependencies are pulled in, what licenses apply, who maintains it, whether it can be removed cleanly, and whether a reasonable user would understand the risk.\n\n## 9. Local execution rule\n\nCommunity code must not run directly on Supabase, Cloudflare backend, Elysia core, Bradley’s machine, shared website servers, or user machines without explicit local approval. Future execution must be sandboxed, optional, explicit, resource-limited, secret-free, private-network-free, host-mount-free, loggable, and killable.\n\n## 10. Website security review\n\nWebsite feature review should consider authentication state, RLS, public/private data separation, localStorage sensitivity, hidden admin routes, role checks, XSS risk, upload risk, file type and size limits, API key exposure, service-role key leakage, Cloudflare Pages routing, Supabase anon-key-only frontend posture, error messages, logged data, abuse rate limits, and direct URL access.\n\n## 11. Sensitive features requiring extra review\n\nExtra review is required for file uploads, receipt/proof uploads, code execution, local Elysia linking, add-on installation, admin dashboards, moderator tools, public chat, direct messaging, comments, media hosting, payment or paid add-ons, email notifications, phone/SMS alerts, external API integrations, local protocol handlers, and browser extension-like behavior.\n\n## 12. Incident response\n\nSecurity incidents may result in immediate feature disablement, add-on delisting, revocation, account suspension, user notification, key rotation, audit review, forced update, patch release, public advisory, evidence preservation, and law enforcement or platform reporting where necessary.\n\n## 13. Re-review triggers\n\nRe-review may be required when permissions, dependencies, maintainer identity, package content, source repository, version, vulnerability reports, user complaints, external service integration, or local behavior changes.\n\n## 14. Review records\n\nReview records may include reviewer, date, version, manifest hash, package hash, source URL, checks performed, risk labels, decision, notes, unresolved concerns, and revocation history.\n\n## 15. Security contact\n\nSecurity contact: `security@elysiaecobotics.com`\n"
  },
  {
    "slug": "terms-of-use",
    "route": "/legal/terms-of-use",
    "title": "Terms of Use",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Terms of Use\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Acceptance\n\nBy accessing or using Elysia Ecobotics Online, creating an account, submitting content, browsing the Marketplace, using the Living Library, participating in the Commune, requesting volunteer/collaboration review, or downloading public Elysia materials, you agree to these Terms of Use and the related policies linked from the site.\n\nIf you do not agree, do not use the site.\n\n## 2. What this site is\n\nElysia Ecobotics Online is the public website and account ecosystem around Elysia and Elysia Ecobotics™. It may include downloads and release information, Marketplace browsing and add-on submissions, developer tools and manifest documentation, Living Library source cards and research links, public community and blogging features, membership and Commons Profile features, stewardship recognition workflows, volunteer/contributor/collaboration request workflows, and project documentation.\n\n## 3. What this site is not\n\nElysia Ecobotics Online is not the private local Elysia core, a cloud copy of local Elysia memory, a place to upload secrets, a remote-control surface for private computers, an employer unless a specific written paid role exists, a payment processor for independent nonprofits, a legal/medical/financial/mental-health/emergency service, or a guarantee that add-ons, code, datasets, sources, or community posts are safe, accurate, complete, legal, licensed, or appropriate for every use.\n\n## 4. Public website account vs. local Elysia account\n\nA Commons account is for the public website. It may support profile, membership, saved items, Marketplace activity, Developer Forge activity, Living Library collections, Commune participation, and stewardship recognition.\n\nA Commons account does not unlock or sync private local Elysia memory, local files, vaults, logs, passwords, credentials, or machine data by default.\n\nDo not enter your local Elysia password into the public website.\n\n## 5. Eligibility\n\nYou must be legally able to use the site and agree to these Terms. Users under the age of majority should use the site with appropriate parent or guardian involvement. Users under 13 may not create accounts or submit personal information.\n\nWe may refuse, suspend, or terminate accounts where required for safety, legal compliance, security, abuse prevention, or policy enforcement.\n\n## 6. Accounts\n\nYou are responsible for providing accurate account information, keeping login credentials secure, not sharing credentials with unauthorized persons, promptly reporting suspected account compromise, not impersonating others, and not using accounts to evade bans, moderation, security review, or rate limits.\n\nWe may limit, suspend, or terminate accounts that violate policies, pose risk, submit malicious content, abuse others, or undermine the integrity of the site.\n\n## 7. User content\n\nUser content may include posts, comments, drafts, add-on submissions, manifests, code snippets, source suggestions, repo showcases, profile information, reports, volunteer requests, and other submissions.\n\nYou keep ownership of content you submit, subject to any licenses you attach or agreements you separately accept.\n\nBy submitting content to public or review features, you grant EcoSyneva Commons LLC a limited, worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, format, moderate, review, transmit, and use the content as needed to operate the site, provide the requested feature, review submissions, enforce policies, protect users, and maintain records.\n\nThis license does not give EcoSyneva Commons LLC ownership of your content. It is necessary to operate the site.\n\n## 8. Your responsibility for content\n\nYou are responsible for ensuring that your content is lawful, does not violate third-party rights, does not contain secrets or private data, does not contain malware, does not misrepresent licenses/permissions/affiliations, does not falsely claim to be official, does not impersonate another person or organization, does not create unsafe or deceptive instructions, and complies with these Terms and related policies.\n\n## 9. Public content is public\n\nPublic posts, public profiles, comments, source suggestions, add-on listings, and public repo showcases may be visible to others.\n\nDo not submit private support information, credentials, personal documents, private logs, private local Elysia memory, confidential employer/client material, or unredacted personal data to public features.\n\n## 10. Moderation\n\nThe site may moderate content and accounts to protect users, the public commons, local Elysia users, and the integrity of the project.\n\nModeration may include warning, labeling, hiding, redaction requests, security holds, removal, disabling comments or submissions, locking threads, blocking uploads, rejecting add-ons, revoking add-on listings, suspending or terminating accounts, and preserving records for safety or legal purposes.\n\nWe may moderate content even if it is lawful, where it violates site policy, threatens safety, undermines trust, exposes private data, enables scams, or creates unacceptable operational risk.\n\n## 11. Marketplace and add-ons\n\nThe Marketplace is a catalog and review surface. Add-ons may be independent developer work unless marked official.\n\nAdd-ons may request permissions, interact with local systems, use dependencies, connect to networks, read files, execute commands, or affect local Elysia behavior if installed locally. Such capabilities require explicit local review and approval by local Elysia infrastructure when installation features exist.\n\nA Marketplace listing does not guarantee that an add-on is safe, bug-free, compatible, maintained, secure, legal for every use, or appropriate for sensitive work.\n\nUsers install add-ons at their own risk. Developers are responsible for their add-ons, dependencies, manifests, licenses, claims, updates, security, and support.\n\n## 12. Downloads, releases, and local software\n\nElysia may be distributed as source code, binaries, installers, packages, or release artifacts when available.\n\nUnless a separate license or warranty states otherwise, software is provided as-is and may be experimental. Users are responsible for reviewing release notes, system requirements, dependencies, permissions, and known issues.\n\nLocal Elysia may rely on third-party software, open-source packages, operating-system components, runtimes, model files, local inference tools, developer tools, and optional external services. Each third-party component may have its own license, terms, access conditions, privacy practices, and technical risks.\n\n## 13. Third-party software, models, services, and licenses\n\nThe Elysia ecosystem may interact with or refer to tools and services such as hosting providers, authentication providers, source-control platforms, package managers, model repositories, local model runtimes, databases, browser APIs, local desktop frameworks, Python/Rust/TypeScript tooling, container/sandbox systems, and open-source libraries.\n\nYou are responsible for complying with third-party licenses and terms. EcoSyneva Commons LLC does not grant rights it does not own.\n\nDo not use the site or Elysia tools to bypass license restrictions, model access conditions, paid access controls, API terms, rate limits, or copyright obligations.\n\n## 14. Living Library\n\nThe Living Library provides metadata, source cards, official links, access notes, citations, risk labels, and research guidance. It does not certify that every source is accurate, complete, current, training-safe, license-compatible, ethically appropriate, or suitable for every use.\n\nUsers must review licenses, terms, privacy risks, citation requirements, community consent, data provenance, and ethical context before using sources, datasets, code, or papers.\n\n## 15. Commune and public community\n\nThe Commune is intended for public posts, troubleshooting, blogging, code sharing, repository showcases, community networking, research notes, and future collaboration.\n\nThe Commune is high-risk and may be moderated closely. Do not post secrets, `.env` files, API keys, private local Elysia memory, private logs, credentials, unredacted screenshots, customer/user data, confidential employer/client material, exploit code without responsible context, scams, harassment, doxxing, malware, illegal content, or private personal documents.\n\nCommunity code must not run directly on Supabase, Cloudflare backend, Elysia core, Bradley’s machine, or shared website servers. Future execution must be sandboxed, optional, explicit, resource-limited, secret-free, private-network-free, host-mount-free, loggable, and killable.\n\n## 16. Stewardship recognition and independent donations\n\nThe Commons Circle may encourage members to consider independent stewardship organizations.\n\nDonations are made directly to those organizations, not to EcoSyneva Commons LLC through this site. Listings do not imply partnership, sponsorship, endorsement, approval, or donation processing.\n\nStewardship recognition, badges, or membership tiers may be reviewed by administrators. Donation proof may support recognition, but it does not grant administrator, moderator, reviewer, developer, or platform authority.\n\nDo not upload unredacted receipts or full financial records.\n\n## 17. Volunteer, contributor, and work requests\n\nWork With Elysia Ecobotics is a doorway for volunteer, contributor, collaboration, and future paid-role interest.\n\nMost opportunities are currently volunteer, contributor, or collaborator roles unless explicitly marked paid. A request does not guarantee a role, paid work, membership tier, badge, moderator status, reviewer authority, or employment.\n\nPaid roles require separate written agreement.\n\n## 18. Prohibited conduct\n\nYou may not use the site to violate law, harass, threaten, abuse, exploit or endanger children, share non-consensual intimate content, dox or expose private information, spread malware, steal credentials, exfiltrate data, evade security controls, submit knowingly false reports, impersonate official Elysia Ecobotics accounts, misrepresent licenses/safety/compatibility/approvals, run scams, manipulate reviews/votes/badges/trust labels, scrape abusively, overload infrastructure, bypass moderation or bans, encourage self-harm or targeted violence, conduct illegal surveillance, or build/distribute harmful tools.\n\n## 19. Intellectual property\n\nElysia Ecobotics™, Elysia Ecobotics Online, site design elements, documentation, and official Elysia materials may be protected by copyright, trademark, trade dress, or other rights.\n\nDo not use project names, logos, or confusingly similar branding in a way that suggests affiliation, sponsorship, approval, or official status without permission.\n\nUser content remains subject to the rights and licenses of the user or third parties.\n\n## 20. Copyright complaints\n\nCopyright complaints and counter-notices are handled under the DMCA / Copyright Policy. We may remove or disable access to material alleged to infringe copyright and may terminate repeat infringers where appropriate.\n\n## 21. Security research\n\nSecurity research must follow the Vulnerability Disclosure Policy. Unauthorized access, destructive testing, data exfiltration, persistence, malware deployment, social engineering, privacy invasion, or disruption of service is not allowed.\n\n## 22. Disclaimers\n\nThe site, software, content, add-ons, documentation, source cards, community posts, and public materials are provided as-is and as-available unless a separate written agreement says otherwise.\n\nWe do not warrant that the site will be uninterrupted, content will be accurate or current, add-ons will be safe or compatible, third-party links will remain available, local software will work on every system, community posts will be reliable, datasets will be license-safe, security review will find every issue, or user content will remain available.\n\n## 23. Limitation of liability\n\nTo the maximum extent permitted by law, EcoSyneva Commons LLC and its representatives are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, including lost profits, lost data, business interruption, security incidents caused by user-installed add-ons, misuse of third-party services, or reliance on public content.\n\nSome jurisdictions do not allow certain limitations, so some limitations may not apply.\n\n## 24. Indemnity\n\nYou agree to defend, indemnify, and hold harmless EcoSyneva Commons LLC and its representatives from claims, damages, liabilities, costs, and expenses arising from your use of the site, your content, your add-ons, your violations of law or policy, your infringement of rights, or your misuse of public or local Elysia systems.\n\n## 25. Changes\n\nWe may update these Terms. If changes are material, we should post notice or update the effective date. Continued use after changes means the updated Terms apply.\n\n## 26. Governing law\n\nThese Terms are intended for a United States/Colorado-based project posture, but final governing law and venue language should be reviewed before publication.\n\nColorado law, without regard to conflict-of-law rules, is the intended governing-law posture unless a different jurisdiction is legally required.\n\n## 27. Official contacts\n\nGeneral legal contact: `legal@elysiaecobotics.com`  \nAbuse/moderation contact: `abuse@elysiaecobotics.com`  \nSecurity contact: `security@elysiaecobotics.com`\n"
  },
  {
    "slug": "volunteer-contributor-disclaimer",
    "route": "/legal/volunteer-contributor-disclaimer",
    "title": "Volunteer / Contributor Disclaimer",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Volunteer / Contributor Disclaimer\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis disclaimer explains the status of volunteer, contributor, collaborator, reviewer-interest, and future paid-role requests connected to Elysia Ecobotics.\n\nThe project is early. Transparency matters.\n\n## 2. No employment by default\n\nSubmitting a request to help Elysia Ecobotics does not create employment, a contractor relationship, a partnership, an agency relationship, a paid role, a guaranteed role, or a promise of future compensation.\n\nMost current opportunities are volunteer, contributor, or collaborator roles unless a role is explicitly marked paid in writing. Paid roles require a separate written agreement.\n\n## 3. No authority by default\n\nSubmitting a request does not grant administrator status, moderator status, reviewer status, Guardian / Reviewer role, Marketplace reviewer authority, source reviewer authority, security reviewer authority, official spokesperson status, membership tier increase, badge, or right to represent EcoSyneva Commons LLC.\n\nAuthority roles are assigned by authorized administrators.\n\n## 4. Volunteer and contributor categories\n\nPossible contribution areas may include documentation, troubleshooting support, source curation, Living Library suggestions, research notes, accessibility testing, UI/UX feedback, security review interest, Marketplace/add-on review interest, add-on development, developer tooling, environmental/ecological data work, product testing, media/design support, and community support.\n\nAvailability of these areas may change.\n\n## 5. Requests are not guaranteed\n\nA request may be saved locally as a draft, held for future administrator review, accepted, declined, unanswered, redirected, postponed, or closed because the project lacks capacity. We cannot promise response times.\n\n## 6. Sensitive information\n\nDo not submit Social Security numbers, legal IDs, birthdates, bank information, tax forms, medical information, private addresses, passwords, API keys, tokens, private Elysia memory, private logs, `.env` files, confidential employer/client material, or proprietary code you cannot share.\n\n## 7. Ownership and licensing of contributions\n\nYou should only contribute work you have the right to contribute. Future contribution processes may require a contributor license agreement, developer agreement, project license, or written permission statement before work is accepted into public code, documentation, datasets, designs, or add-ons.\n\nUntil formal contribution terms are implemented, do not submit confidential, proprietary, or restricted material.\n\n## 8. No reimbursement unless agreed\n\nExpenses, equipment, software, internet, travel, subscriptions, hardware, data access, and other costs are not reimbursed unless agreed in writing before the expense.\n\n## 9. Safety and boundaries\n\nVolunteers and contributors should not represent themselves as employees, make promises on behalf of Elysia Ecobotics, collect money for the project without authorization, contact users privately in a pressure-based way, request credentials or private files from users, ask users to run unsafe code, access user data without authorization, or handle moderation/review outside assigned scope.\n\n## 10. Recognition\n\nContributions may be recognized through badges, acknowledgments, profile notes, membership tier updates, or public credit. Recognition is not guaranteed and may depend on administrator review, contributor preference, safety, accuracy, and project capacity.\n\n## 11. Constructive publishing ethics\n\nRecognition may consider usefulness, honesty, source quality, respect for privacy, redaction, license compliance, clarity, humility, repair and maintenance, respectful community conduct, and public-benefit value.\n\n## 12. Ending participation\n\nEither side may end volunteer or contributor participation at any time, subject to preservation of existing licenses, moderation records, safety records, or legal obligations.\n\n## 13. Future paid roles\n\nFuture paid roles may be posted separately with clear terms, pay/rate if known, role expectations, eligibility, application process, and written agreement requirements. Do not interpret volunteer participation as a promise of future employment.\n"
  },
  {
    "slug": "vulnerability-disclosure-policy",
    "route": "/legal/vulnerability-disclosure-policy",
    "title": "Vulnerability Disclosure Policy",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-09",
    "body": "# Vulnerability Disclosure Policy\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Public URL:** https://elysia-ecobotics-online.pages.dev  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-09\n\n## 1. Purpose\n\nThis policy gives security researchers a safe, clear way to report vulnerabilities affecting Elysia Ecobotics Online, The Elysia Marketplace, public account features, public code, public releases, or future local Elysia integration points.\n\nWe value responsible security research. We also need to protect users, private data, local Elysia systems, infrastructure, and the public commons.\n\n## 2. Security contact\n\nSecurity reports should be sent to: `security@elysiaecobotics.com`\n\nDo not post unpatched vulnerabilities publicly before we have had a reasonable chance to investigate and mitigate.\n\n## 3. Scope\n\nIn-scope systems may include Elysia Ecobotics Online, public routes and pages, authentication flows, Commons Circle account features, Marketplace submission/review flows, Living Library source suggestion features, Commune post/request features, Work With request features, public deployment configuration, public release artifacts, public GitHub repositories owned by EcoSyneva Commons LLC, future local Elysia linking surfaces, future add-on installer protocol surfaces, and future APIs documented as in scope.\n\nOut-of-scope unless explicitly authorized: third-party services not controlled by EcoSyneva Commons LLC, Cloudflare infrastructure itself, Supabase infrastructure itself, GitHub infrastructure itself, independent nonprofit websites, third-party repositories, user devices, user local Elysia installations, social engineering, physical attacks, spam attacks, denial-of-service attacks, destructive testing, attempts to access real user data, and attempts to persist access.\n\n## 4. Authorized research boundaries\n\nSecurity research is welcome only if you act in good faith, avoid privacy violations, avoid data exfiltration, avoid disruption, avoid destructive actions, do not persist access, do not modify or delete data, do not access other users’ accounts, do not submit malware, do not bypass payments or external third-party terms, stop testing and report promptly if you encounter sensitive data, and give us reasonable time to investigate before public disclosure.\n\n## 5. Prohibited testing\n\nDo not perform denial-of-service or stress testing, spam or mass account creation, phishing, social engineering, credential stuffing, password spraying, malware deployment, ransomware simulation, data exfiltration, destructive file operations, real receipt/proof upload abuse, attacks against third-party providers, attacks against local Elysia users, attacks against Bradley’s machine or private systems, physical intrusion, or harassment of users/staff/contributors/volunteers.\n\n## 6. What to report\n\nUseful reports include vulnerability summary, affected URL/route/repository/package/feature, steps to reproduce, safe proof-of-concept, impact explanation, whether user data is at risk, whether secrets are exposed, whether local Elysia could be affected, suggested mitigation, your contact information, and desired disclosure timeline.\n\nDo not include real user data. Use test accounts or synthetic examples.\n\n## 7. AI and local Elysia-specific reports\n\nAI/local-first reports may include unsafe local protocol invocation, add-on permission bypass, manifest validator bypass, local installer risk, secret leakage in logs, prompt or tool routing that causes unauthorized actions, sandbox escape, unauthorized file access, private memory export without approval, model/tool routing vulnerability, and malicious add-on behavior.\n\nAI hallucinations or content disagreements alone are not necessarily security vulnerabilities, but they may be safety or quality reports.\n\n## 8. Response process\n\nWe aim to acknowledge receipt when practical, triage severity, ask follow-up questions if needed, investigate, mitigate or explain why the report is out of scope, credit the researcher if appropriate and requested, and coordinate disclosure where appropriate. This process may be slower while the project is early.\n\n## 9. Safe harbor intent\n\nFor good-faith research that follows this policy, we do not intend to pursue legal action or account enforcement solely because you reported a vulnerability.\n\nThis safe-harbor intent does not protect activity that violates this policy, harms users, exfiltrates data, disrupts service, violates law, attacks third parties, or exceeds authorized scope.\n\nThis safe-harbor statement is an operational intent and not legal advice.\n\n## 10. No bounty promise\n\nThere is no bug bounty program unless a separate written program says so. Reports may be appreciated, credited, or prioritized, but payment is not promised.\n\n## 11. Public disclosure\n\nDo not publicly disclose unresolved vulnerabilities without coordination. A typical disclosure timeline may be discussed based on severity, exploitation risk, and mitigation complexity. Emergency risks may require longer coordination or immediate mitigations.\n\n## 12. Security.txt\n\nFuture implementation may include `/.well-known/security.txt` with security contact and disclosure information.\n\n## 13. Abuse reports vs. vulnerabilities\n\nUse security contact for technical vulnerabilities. Use abuse/moderation contact for harassment, scams, content violations, impersonation, copyright complaints, or community safety issues.\n\nAbuse/moderation contact: `abuse@elysiaecobotics.com`\n"
  },
  {
    "slug": "trademark-notice",
    "route": "/legal/trademark-notice",
    "title": "Trademark Notice",
    "status": "Public operating policy",
    "lastUpdated": "2026-06-10",
    "body": "# Trademark Notice\n\n**Site:** Elysia Ecobotics Online  \n**Brand:** Elysia Ecobotics™  \n**Operator:** EcoSyneva Commons LLC  \n**Status:** Public operating policy. Informational, not legal advice.  \n**Last updated:** 2026-06-10\n\n## 1. Public notice\n\nElysia Ecobotics™ is a trademark of EcoSyneva Commons LLC. Elysia Ecobotics™ is used to identify the public project, website, and brand initiative around Elysia.\n\nElysia Ecobotics Online is the public website. Elysia is the private local-first AI product and system. EcoSyneva Commons LLC is the legal and business umbrella.\n\n## 2. Symbol use\n\nThe ™ symbol is used to give public notice of claimed trademark rights. No registration symbol is used unless and until a registration is issued.\n\n## 3. No false affiliation\n\nDo not use Elysia Ecobotics™, Elysia Ecobotics Online, Elysia, project logos, or confusingly similar names in a way that implies affiliation, sponsorship, endorsement, official status, or approval without permission.\n\n## 4. Community reference\n\nCommunity discussion, criticism, commentary, and accurate reference to the project are allowed when they do not mislead people about source, affiliation, sponsorship, or approval.\n\n## 5. Private records\n\nPrivate launch/proof records and legal evidence packets are not public website materials and are not published here.\n"
  }
];

const addonSubmissionPolicy = legalPolicyPages.find((page) => page.slug === "add-on-submission-policy");
if (addonSubmissionPolicy) {
  addonSubmissionPolicy.lastUpdated = "2026-08-15";
  addonSubmissionPolicy.body += `

## 17. Browser intake and upload disclosure

Choosing a local folder, repository, ZIP source bundle, \`.elysia-addon\`, or manifest starts an inert browser-side inspection. Choosing files alone does not upload or execute them. Before private Marketplace review transfer, the site must disclose that the selected files leave the user's computer and are transferred to Elysia Ecobotics / EcoSyneva Commons review infrastructure. Developers are responsible for reviewing the exact selection and removing secrets, credentials, private data, logs, vault material, hidden telemetry, and content they lack rights to distribute.

A Git repository URL is review metadata only unless a separate governed fetch action is explicitly offered. The website does not silently clone or authenticate to remote repositories.

## 18. Review and authority distinctions

Submitted does not mean approved. Approved does not mean published. Published does not mean installed. Installed does not mean enabled. Enabled does not mean unrestricted. A granted permission does not create broad authority. Admin review reduces risk but does not guarantee safety.
`;
}

const economicPolicyDate = "2026-07-16";
const economicPolicyStatus = "Test-mode operating terms";

legalPolicyPages.push(
  {
    slug: "support-and-billing-terms",
    route: "/legal/support-and-billing-terms",
    title: "Support and Billing Terms",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Support and Billing Terms

**Operator:** EcoSyneva Commons LLC
**Status:** Test-mode operating terms; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Scope and current availability

These terms cover voluntary one-time support, recurring sustaining support, and private billing-account surfaces offered by EcoSyneva Commons LLC for Elysia Ecobotics Online. Repository support checkout is currently designed for Stripe test mode. A visible page or test checkout is not a promise that live payments are active.

## 2. What remains free

Local Elysia remains free and local-first. A Website Account is not required for ordinary local use. Free Member recognition remains free. Supporting Elysia is optional and is not a condition of ordinary community participation.

## 3. What payment cannot buy

Payment does not grant governance, trust, moderation power, reviewer status, developer approval, publisher verification, publication approval, Marketplace approval, Job Post approval, voting power, search prominence, social rank, or control of the Commons. Payment failures, refunds, cancellation, waivers, and disputes do not by themselves change community standing.

## 4. One-time support

The amount and currency are shown before transfer to Stripe-hosted Checkout. One-time support does not renew. Guest support is not linked to a Website Account merely because the same email address is used; account linkage must be established by the authenticated checkout path and server records.

## 5. Recurring support

Recurring support is never preselected. Before checkout, the site shows the fixed monthly amount, monthly cadence, cancellation path, applicable refund policy, and the fact that cancellation does not affect community standing. A Website Account is required so the supporter can recover access and use private billing management. Recurring support continues until canceled according to Stripe's hosted confirmation and the effective date shown there.

## 6. Processor and data boundary

Stripe is the initial replaceable payment processor. Payment-card, bank, checkout-contact, device, fraud-prevention, transaction, and provider-account information is processed under Stripe's terms and privacy practices. Elysia Ecobotics Online does not intentionally send local Elysia memory, local files, local conversations, Commune content, or sandbox source code to Stripe as checkout data.

## 7. Records, receipts, and payment truth

Browser redirects, screenshots, emails, and notification messages are not authoritative payment records. Server-verified provider events and private economic records determine payment state. Stripe may send receipts to the checkout email. Do not post receipts, billing identifiers, disputes, balances, or financial evidence publicly.

## 8. Entity and tax status

Payments are made to EcoSyneva Commons LLC. They are not presented as tax-deductible charitable contributions. Nothing on the Support page is tax, legal, or accounting advice.

## 9. Errors and support

Do not retry a checkout while its state is uncertain. For a mistaken or duplicate payment, billing-access problem, or cancellation question, contact support@elysiaecobotics.com without sending card numbers, bank details, passwords, identity documents, or provider secrets.

## 10. Activation boundary

Live payment activation requires separate business, banking, provider-verification, legal, tax, accounting, pricing, and operational approval. Test-mode behavior must not be represented as a live charge or live payout.
`
  },
  {
    slug: "refund-and-cancellation-policy",
    route: "/legal/refund-and-cancellation-policy",
    title: "Refund and Cancellation Policy",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Refund and Cancellation Policy

**Operator:** EcoSyneva Commons LLC
**Status:** Test-mode operating policy; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Current mode

Repository billing is test-mode-only. Test payments move no real funds and cannot produce a real refund. This policy defines the intended fair process that must be reviewed before live activation.

## 2. Recurring-support cancellation

Recurring support can be managed and canceled through the secure Stripe Customer Portal when that capability is enabled. The portal shows the effective date. Cancellation stops future renewal according to that date; it does not delete a Website Account, Commons Profile, content, Free Member recognition, unrelated badges, purchases, licenses, or community standing.

## 3. Refund requests

For a mistaken amount, duplicate payment, unauthorized transaction concern, material service failure, or other good-faith problem, contact support@elysiaecobotics.com promptly. Include only the minimum safe information needed to locate the transaction. Never email card or bank numbers, passwords, identity documents, or full provider identifiers.

## 4. One-time voluntary support

One-time support normally funds ongoing work rather than a promised deliverable. A refund may still be appropriate for a duplicate, mistake, unauthorized-payment concern, technical error, or where law requires it. Requests are reviewed fairly and are not conditioned on community status.

## 5. Service purchases and credits

Sandbox credits, Job Post fees, Marketplace licenses, organizational services, and sponsorships require their own checkout-specific terms. Those terms must disclose delivery, expiration if any, cancellation, and refund conditions before money is accepted. This general policy does not silently remove rights stated at checkout or required by law.

## 6. Method and timing

Approved refunds are returned through the original processor and payment method where possible. Provider and banking timelines may delay appearance of funds. EcoSyneva Commons LLC will not request a second payment method to issue a routine refund.

## 7. Disputes and chargebacks

Contacting support first may allow a faster correction, but it does not waive lawful dispute rights. A dispute or failed payment can restrict only the affected economic entitlement while it is unresolved; it is not a general community ban and cannot erase unrelated recognition.

## 8. No retaliation or public exposure

Refund, cancellation, waiver, failed-payment, and dispute status remains private. It must not be used for public shaming, donor ranking, moderation retaliation, or governance decisions.
`
  },
  {
    slug: "sandbox-credit-terms",
    route: "/legal/sandbox-credit-terms",
    title: "Online Sandbox Credit Terms",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Online Sandbox Credit Terms

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation test-mode terms; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Separate online service

The Commune coding sandbox is an optional online service with real remote-compute costs. It is separate from free local Elysia and from ordinary local coding. A Website Account may be required for governed online execution.

## 2. Credits are service units, not money or recognition

Sandbox credits represent a narrow right to request measured online service under current limits. They are not cash, deposits, stored value, badge credits, contribution credits, governance votes, trust scores, or public status. Purchased, recurring, sponsored, waived, starter, and operational credit sources remain distinguishable in the private ledger.

## 3. Disclosure before activation

Before paid credits can be sold, the checkout must state the price, currency, measured unit, rate, reservation behavior, any expiration, refund conditions, and what happens to unused credits. If those facts are not advertised by an enabled server capability, paid sandbox credits are unavailable.

## 4. Reservations and settlement

A run may reserve credits before execution and settle against measured use afterward. Failed, canceled, timed-out, or infrastructure-error runs must follow documented release or adjustment rules. Corrections are durable compensating ledger entries, not silent balance rewrites.

## 5. Safety limits do not increase with payment

Buying or receiving credits does not increase network access, filesystem access, package-install permission, shell privilege, reviewer status, administrator limits, trust, concurrency safety caps, or code approval. The sandbox may reject or stop work for safety, abuse prevention, resource limits, maintenance, or policy compliance regardless of balance.

## 6. Sponsored and waived access

Free, sponsored, and waived access is legitimate and private. It must not be publicly stigmatized or treated as lesser community standing.

## 7. Source-code and provider boundary

Sandbox source code may be transmitted to the governed execution path described in the Privacy Policy. It is not sent to Stripe merely because credits are purchased. Billing services must never execute user code, and the sandbox must never receive payment secrets.
`
  },
  {
    slug: "job-post-fee-terms",
    route: "/legal/job-post-fee-terms",
    title: "Commercial Job Post Fee Terms",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Commercial Job Post Fee Terms

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation test-mode terms; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Separate decisions

A commercial Job Post may require an economic condition such as paid, waived, subsidized, or exempt. Economic state is separate from anti-scam review, content review, employer identity checks, moderation, publication, expiration, and archival state.

## 2. Payment is not approval

Paying a fee cannot approve a post, bypass review, guarantee publication, extend a listing, improve ranking, silence reports, or purchase endorsement. Reviewers must not infer truth or safety from payment.

## 3. Clear checkout

Before a live fee is accepted, the employer must see the amount, currency, listing scope, duration if any, renewal status, refund conditions, and whether publication is still subject to review. No recurring Job Post charge may be hidden or preselected.

## 4. Rejection, withdrawal, and removal

The applicable checkout terms must state how rejection before publication, voluntary withdrawal, later policy removal, duplicate payment, and technical failure affect refunds or credits. Content enforcement and financial correction remain separately audited.

## 5. Privacy

Fee status, waivers, disputes, billing contacts, provider references, and payment history are private. A public listing may include only approved employer and opportunity information, not financial evidence.
`
  },
  {
    slug: "marketplace-commerce-terms",
    route: "/legal/marketplace-commerce-terms",
    title: "Marketplace Commerce Terms",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Marketplace Commerce Terms

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation test-mode terms; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Current boundary

Commercial Marketplace activation remains disabled unless an enabled server capability, reviewed offer, price, license, seller readiness state, and test-mode payment path are all present. Existing free add-ons and review workflows remain separate.

## 2. Offer, listing, purchase, license, and install are distinct

A reviewed listing may have a separate commercial offer. A successful payment may create the stated license entitlement; it does not approve the listing, verify the publisher, certify safety, download a package, or authorize installation. Local Elysia retains manifest validation, permission disclosure, user confirmation, installation, and revocation authority.

## 3. Price and license disclosure

Before purchase, the offer must state price, currency, license scope, covered version or term, external dependencies, support expectations, material restrictions, refund conditions, and whether future versions require another purchase. No undisclosed renewal or add-on charge is permitted.

## 4. Seller preparation and payouts

Eligible sellers may complete provider-hosted identity, tax, and bank onboarding through Stripe Connect test mode. Developer status, publisher verification, seller eligibility, review approval, commercial-offer approval, payable balance, and payout readiness remain separate. A seller cannot self-approve any of them merely by completing provider onboarding.

## 5. Commission and accounting

Before live sales, the seller agreement must disclose commission, processor fees, refunds, reserves, disputes, taxes, payout schedule, minimums if any, and termination handling. Seller income, banking state, tax data, and payout identifiers remain private.

## 6. Safety and revocation

Commercial status does not reduce security review or prevent urgent delisting. License and purchaser-remedy handling after revocation must be defined without silently reinstalling, deleting, or changing local software.
`
  },
  {
    slug: "sponsorship-independence-policy",
    route: "/legal/sponsorship-independence-policy",
    title: "Sponsorship Independence Policy",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Sponsorship Independence Policy

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation operating policy; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Purpose

Ethical sponsorship may help fund public-interest infrastructure while preserving truthfulness, independence, privacy, and the dignity of people who do not pay.

## 2. What sponsorship cannot purchase

Sponsors cannot buy governance, moderation outcomes, reviewer assignments, developer approval, publisher verification, publication decisions, Living Library conclusions, research claims, search prominence disguised as relevance, access to private user data, or control of the Commons.

## 3. Disclosure

Material sponsorship must be labeled clearly where it affects a public surface. Disclosure should identify the sponsor and general supported area without publishing private contract terms, amounts, bank information, or user financial data.

## 4. Privacy and tracking

Sponsorship must not require behavioral advertising profiles, sale of account activity, hidden pixels, cross-site surveillance, access to local Elysia memory, or receipt of sandbox source code. Any necessary external data transfer must be disclosed before it occurs.

## 5. Conflicts and refusal

Economic operators must record conflicts and keep sponsorship administration separate from governance and content review. EcoSyneva Commons LLC may decline or end arrangements that conflict with safety, ecology, community dignity, independence, or these boundaries.
`
  },
  {
    slug: "organization-services-terms",
    route: "/legal/organization-services-terms",
    title: "Organization Services Terms",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Organization Services Terms

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation test-mode terms; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Purpose and current boundary

These terms describe the intended process for human-reviewed organizational and professional services offered by EcoSyneva Commons LLC. A website inquiry, account, meeting, automated message, test-mode record, or payment screen is not by itself an accepted engagement. Services begin only under a mutually accepted written proposal, statement of work, or contract. Live service sales remain disabled until business, banking, processor, legal, tax, accounting, insurance, pricing, and operational review is complete.

## 2. Human-reviewed scope

Each request is reviewed by a person for fit, lawful purpose, safety, capacity, ecological and community alignment, privacy needs, conflicts, and technical feasibility. EcoSyneva Commons LLC may decline work. Payment cannot compel acceptance, override safety boundaries, or turn an inquiry into an approved project.

## 3. Proposal and contract

Before paid work begins, the written proposal or contract should identify the parties; scope and exclusions; deliverables; responsible contacts; schedule and dependencies; review and acceptance process; fees, currency, taxes, and approved expenses; invoice and payment schedule; change-control process; cancellation terms; refund or credit conditions; confidentiality; data handling and processors; intellectual-property and license terms; support or maintenance expectations; and any service-specific limitations. A change in scope requires documented agreement rather than an undisclosed charge.

## 4. Invoices and payment

Invoices must identify the agreed service, amount, currency, due date, and payment instructions. Recurring fees, retainers, deposits, milestones, reimbursable expenses, and automatic renewal must be disclosed expressly before agreement and may not be preselected or hidden. Test-mode invoices or payments move no real funds. Browser redirects, screenshots, and emails are not authoritative payment records; verified processor events and private accounting records determine payment state.

## 5. Confidentiality and minimum necessary data

The parties should identify confidential material and any permitted uses in writing. Do not submit secrets, credentials, regulated records, identity documents, private source code, personal data, or confidential client materials through public Commons Profiles, Commune posts, Marketplace listings, ordinary email, or an intake field not designated for that material. EcoSyneva Commons LLC should request and retain only information reasonably necessary for the agreed work, security, accounting, and legal duties. Confidentiality does not require concealing unlawful conduct or prevent disclosures required by law.

## 6. Data processors and external services

Before protected client data leaves the agreed boundary, the proposal or contract should identify material processor categories, data purpose, and relevant location or transfer considerations. Depending on the engagement, processors may include Stripe for payment, invoicing, or fraud prevention; Supabase for authenticated private records; Cloudflare for website delivery and security; and specifically disclosed communication, source-control, hosting, or project tools. Local Elysia memory, local files, conversations, and credentials are not sent to those services merely because an organization asks for or pays for work. New material processors or materially different uses require notice and, where promised or required, approval.

## 7. Security and access

Client access, credentials, environments, and data must be scoped to the minimum necessary work and handled through an agreed secure method. Payment does not authorize access to unrelated systems or data. Each party remains responsible for access it controls, prompt credential revocation, incident contact, and truthful disclosure of known constraints. No public website form should be treated as a secure vault.

## 8. Review, acceptance, and change requests

Deliverables are reviewed under the acceptance criteria and review period stated in the written agreement. Silence is not acceptance unless the contract clearly and lawfully says otherwise. Material change requests may require a revised scope, schedule, and price accepted before the extra work begins. Technical, safety, legal, or dependency constraints may require a pause and documented decision.

## 9. Cancellation and suspension

The written agreement must state how either party may cancel, what notice is required, what work stops, how client materials are returned or deleted, and what completed or committed work remains payable. EcoSyneva Commons LLC may pause or end work for nonpayment, unsafe or unlawful requests, security risk, material breach, unavailable dependencies, conflicts, or capacity limits, subject to the agreement and applicable law. Cancellation of services does not delete a Website Account or alter community standing.

## 10. Refunds and service credits

Refund and credit treatment depends on the written agreement, work already performed, nonrecoverable commitments, duplicate or mistaken payment, material failure to deliver the agreed scope, and applicable law. Approved refunds should return through the original payment method where practical. A refund request, payment failure, dispute, waiver, or negotiated credit remains private and cannot trigger public shaming, governance loss, or unrelated account punishment. The general Refund and Cancellation Policy also applies unless the signed agreement provides a more specific lawful term.

## 11. Intellectual property and licenses

Ownership, pre-existing materials, open-source components, third-party licenses, attribution, portfolio use, confidentiality, and delivery of source or documentation must be stated in the written agreement. Payment does not silently transfer EcoSyneva Commons LLC background technology, Elysia core rights, third-party rights, community content, trademarks, or a client's pre-existing rights.

## 12. No purchase of authority

An organization, client, sponsor, or payer cannot buy governance, moderation outcomes, reviewer assignments, developer approval, publisher verification, publication approval, Marketplace approval, search prominence disguised as relevance, research conclusions, public endorsement, voting power, badges of trust, access to private community data, or control of the Commons. Commercial client identity and economic records remain separate from Commons identity, roles, recognition, moderation, and public profiles.

## 13. Contact and agreement priority

Questions about a proposed engagement may be sent to contact@elysiaecobotics.com without including secrets or regulated data. Billing questions may be sent to support@elysiaecobotics.com. If an executed written agreement conflicts with these general terms, the executed agreement controls for that engagement to the extent lawful; privacy, security, no-pay-to-govern, and applicable legal duties remain binding boundaries.
`
  },
  {
    slug: "account-closure-financial-retention",
    route: "/legal/account-closure-financial-retention",
    title: "Account Closure and Financial Record Retention",
    status: economicPolicyStatus,
    lastUpdated: economicPolicyDate,
    body: `# Account Closure and Financial Record Retention

**Operator:** EcoSyneva Commons LLC
**Status:** Pre-activation operating policy; informational and subject to legal review.
**Version:** 2026-07-16
**Last updated:** 2026-07-16

## 1. Separate lifecycle records

Supabase Auth identity, Commons Profile identity, public content, badges, roles, economic customer records, subscriptions, service entitlements, ledgers, licenses, seller records, provider records, and financial audit records have different purposes and retention duties. They must not be flattened into one deletable profile row.

## 2. Before closing an account with economic value

A person should be able to recover access, view private state, cancel recurring support, resolve pending refunds or disputes, understand remaining service credits and licenses, and request an appropriate export before closure. Closure must not silently orphan a subscription or seller payout.

## 3. What may be retained

EcoSyneva Commons LLC may retain minimum transaction, tax, accounting, fraud-prevention, dispute, consent, security, and audit records where reasonably necessary or legally required. Retained records remain restricted and are not public profile data. Provider-side deletion and retention are also governed by Stripe and applicable law.

## 4. What closure does not mean

Closing a Website Account is not automatically a refund, does not erase already published community history where lawful retention or attribution applies, and does not authorize reuse of financial data for public recognition. Conversely, retaining a financial record does not keep a public profile active.

## 5. Requests and assistance

When the test-mode economic lifecycle feature is enabled, a signed-in person may use the private Support & Billing room to request an economic-data export or economic-account closure and to review current economic closure blockers. This workflow is not general Website Account deletion: Supabase Auth identity, the Commons Profile, community content, badges, roles, governance state, already-earned Marketplace licenses, and remaining sandbox service credits stay separate. Economic closure cannot be represented as complete while subscriptions, unsettled orders, refunds, disputes, reconciliation cases, seller obligations, fulfillment, payouts, or organization and sponsorship signer duties remain unresolved.

Contact privacy@elysiaecobotics.com for broader privacy requests and support@elysiaecobotics.com for subscription, receipt, credit, license, seller-finance, export-artifact, or economic-closure coordination. Send only the minimum information necessary and never email payment secrets or identity documents unless a verified secure process specifically requires them.
`
  }
);

legalPolicyPages.push({
  slug: "living-library-third-party-resources",
  route: "/legal/living-library-third-party-resources",
  title: "Living Library & Third-Party Resources",
  status: "Public operating policy",
  lastUpdated: "2026-08-07",
  body: `## 1. Purpose and scope

The Living Library is an independently curated discovery index and gateway maintained by Elysia Ecobotics, an initiative of EcoSyneva Commons LLC. It catalogs and links to scientific, educational, governmental, academic, nonprofit, commercial, and other resources operated independently by third parties.

The Living Library ordinarily helps people discover external research infrastructure. It does not claim to own or operate the resources it lists.

## 2. Independent listings and identifiers

Inclusion does not imply affiliation, sponsorship, endorsement, partnership, or approval by Elysia Ecobotics, EcoSyneva Commons LLC, or the listed organization unless a relationship is expressly stated. Names, trademarks, service marks, and other identifiers remain the property of their respective owners.

Resource descriptions, classifications, access labels, and caution notes are independent editorial summaries prepared for research and discovery. They are not statements issued or approved by the listed organizations unless expressly identified as quotations or official guidance.

## 3. Third-party sites and changing information

Elysia Ecobotics does not control third-party sites and cannot guarantee their continued availability, accuracy, security, accessibility, licensing, privacy practices, peer-review status, content, or access requirements. Resource information can change after a listing is reviewed. A verification date records a bounded catalog review; it is not a continuing certification of the destination or every item available there.

## 4. Linking rather than reproducing

The Living Library ordinarily links to third-party material rather than reproducing, mirroring, or redistributing it. Any third-party material actually reproduced or incorporated by Elysia Ecobotics must have a lawful basis, such as permission, an applicable license, public-domain status, or another legally supportable basis.

Citations and attribution support responsible scholarship, but they do not by themselves grant permission to copy, redistribute, mine, train on, or otherwise reuse protected material.

## 5. Access, licensing, and reuse

Public availability, open access, download access, bulk access, repository inclusion, and indexing describe different conditions. None automatically establishes peer review, an open license, public-domain status, redistribution rights, or permission for text and data mining or AI training.

Before relying on, downloading, redistributing, mining, training on, or otherwise reusing third-party material, users should review the current destination-site terms, record-level licenses, attribution and citation requirements, privacy policies, access controls, and relevant ethical or community restrictions.

## 6. Corrections, rights concerns, and removal requests

Resource operators and users may ask Elysia Ecobotics to review an inaccurate description, broken link, rights concern, attribution issue, or removal request. Use the Living Library's broken-link/reporting workflow when available, or contact legal@elysiaecobotics.com. Copyright notices may be sent to dmca@elysiaecobotics.com. Send only the information reasonably necessary to evaluate the request.

Elysia Ecobotics may correct, qualify, archive, or remove a listing when evidence supports that action. This policy describes the Library's operating approach; it does not excuse infringement, deception, or other unlawful conduct.
`
});

legalPolicyPages.push({
  slug: "third-party-media-credits",
  route: "/legal/third-party-media-credits",
  title: "Third-Party Media Credits",
  status: "Public attribution record",
  lastUpdated: "2026-08-24",
  body: `## 1. Purpose

This page identifies third-party media incorporated into the public Website and records the current source and rights posture without overstating legal clearance.

Credit and provenance do not themselves grant permission or a license. A source can be identified and credited while its exact use still requires separate license or permission evidence.

## 2. Flower of Life visual

**Website asset:** \`flower-of-life-pattern.png\`

**Original animation:** [Flower Of Life Pattern Animated Symbol Of Sacred Geometry](https://www.pond5.com/stock-footage/item/168538192-flower-life-pattern-animated-symbol-sacred-geometry)

**Contributor / public artist identity:** U8

**Source:** Pond5, Item 168538192

**Asset SHA-256:** \`a787f33e58163dbb02447e4ebad5c4c711fbcbed23b70ca0228bb382e5cb8bc2\`

**Relationship:** The Website PNG corresponds to a still/frame from the identified animation.

**Current clearance state:** LICENSE / STILL-IMAGE PERMISSION EVIDENCE PENDING BRADLEY. This credit does not state or imply that the Website use is already licensed, authorized, purchased, royalty-free, or otherwise cleared.

## 3. Corrections and rights evidence

Source corrections, required credit wording, purchase records, license evidence, or direct permission may be sent to legal@elysiaecobotics.com. Do not send payment credentials or private account secrets.
`
});

const governedSandboxLegalNotices: Record<string, string> = {
  "privacy-policy": "## Governed code sandbox processing\n\nWhen a signed-in user deliberately requests a Coding Cornucopia sandbox run, the submitted code is transmitted through Cloudflare Pages Functions and Cloudflare Access to an isolated runner hosted on a Hetzner server. The code is used only for the requested execution or static diagnostics. The browser does not receive the private runner credential, and the runner does not receive the user's Supabase token, email, roles, private notes, secrets, or private Elysia context.\n\nSupabase may retain bounded metadata such as the requesting account identifier, idempotency key, source reference, code hash, language, status, timing, limited output previews, and diagnostics. Raw runner input and output are deleted promptly after processing; short-lived failure cleanup and bounded security audit records may remain for operational recovery and abuse prevention. Do not submit secrets, personal data, confidential code, or material you do not have authority to process.",
  "terms-of-use": "## Governed code sandbox\n\nCoding Cornucopia sandbox execution is optional, authenticated, rate-limited, resource-limited, and intended only as evidence about one submitted snapshot. Submitted code crosses Cloudflare and an isolated Hetzner-hosted runner, and bounded run metadata may be recorded privately in Supabase. Network access, package installation, shell access, host repositories, private paths, credentials, and private Elysia context are not provided to the execution container.\n\nA successful execution is not security review, trust, compatibility, licensing clearance, Marketplace approval, moderation approval, or a promise that the code is safe in another environment. You are responsible for the code you submit and must not attempt to escape limits, access secrets or private systems, overload the service, or use the sandbox to facilitate prohibited conduct."
};

for (const page of legalPolicyPages) {
  const notice = governedSandboxLegalNotices[page.slug];
  if (notice) {
    page.lastUpdated = "2026-07-13";
    page.body = page.body
      .replace(/\*\*Last updated:\*\* \d{4}-\d{2}-\d{2}/, "**Last updated:** 2026-07-13")
      .replace(
        "Community code must not run directly on Supabase, Cloudflare backend, Elysia core, Bradley’s machine, or shared website servers. Future execution must be sandboxed, optional, explicit, resource-limited, secret-free, private-network-free, host-mount-free, loggable, and killable.",
        "Community code must not run directly in the browser, Supabase/Postgres, Cloudflare Function runtime, Elysia core, an administrator machine, or the runner host. Governed execution may occur only through the optional authenticated sandbox path with explicit snapshots, fixed resource limits, no network, no secrets, no host/repository/socket mounts, bounded logs, and operator kill switches."
      );
    page.body = `${page.body.trim()}\n\n${notice}\n`;
  }
}

const economicWebsiteLegalNotices: Record<string, string> = {
  "privacy-policy": "## Economic and payment processing\n\nWhen a person deliberately starts support or another enabled economic checkout, the browser sends a bounded request to the server and then opens Stripe-hosted Checkout. Stripe may process checkout contact, payment method, device, fraud-prevention, transaction, subscription, portal, and—only for eligible sellers using Connect—identity, tax, bank, and payout information under Stripe's own terms. Elysia Ecobotics Online stores private normalized economic records needed for consent, reconciliation, receipts, refunds, disputes, entitlements, accounting, and audit. It does not place amounts, plans, waivers, failed payments, refunds, disputes, balances, seller income, or provider identifiers in public Commons Profiles.\n\nGuest checkout is not linked to a Website Account merely by matching an email address. Account-linked billing uses an authenticated server request. Billing does not intentionally send local Elysia memory, local files, local conversations, Commune content, or sandbox source code to Stripe. The separate governed sandbox path is described above. Financial records may require different retention from an Auth user or public profile; see the Account Closure and Financial Record Retention policy.",
  "terms-of-use": "## Economic services and payment boundaries\n\nAny enabled support, sandbox-credit, Job Post, Marketplace, organization, or sponsorship surface is governed by its specific disclosed terms in addition to these Terms. Payment never grants governance, trust, moderation power, reviewer status, developer or publisher approval, publication approval, ranking, voting power, or control of the Commons. Browser redirects and notifications are not proof of payment. Recurring payments must be chosen explicitly, state their cadence and amount, and provide an online management or cancellation path. Test-mode interfaces cannot create a live charge or payout."
};

for (const page of legalPolicyPages) {
  const notice = economicWebsiteLegalNotices[page.slug];
  if (notice) {
    page.lastUpdated = economicPolicyDate;
    page.body = page.body
      .replace(/\*\*Last updated:\*\* \d{4}-\d{2}-\d{2}/, `**Last updated:** ${economicPolicyDate}`)
      .trim();
    page.body = `${page.body}\n\n${notice}\n`;
  }
}

const opportunityPolicyDate = "2026-08-08";
const jobOpportunityLegalNotices: Record<string, string> = {
  "acceptable-use-policy": `## Job Post safety and privacy

Opportunity listings, application routes, and public comments must not be used for fake opportunities, impersonation, credential harvesting, pay-to-apply demands, gift-card or cryptocurrency demands, fake-check or equipment-purchase schemes, undisclosed affiliate traps, or pressure to move into an unverified private channel. Do not request or publish resumes/CVs, Social Security numbers, banking or tax information, identity documents, account credentials, private home addresses, private phone numbers, or sensitive application packets in public Commune content.

An opportunity label, compensation label, moderation decision, publication state, or fee state is not proof of identity, legitimacy, legal compliance, worker status, compensation, or safety. Posters remain responsible for truthful terms and compliance with applicable employment, contractor, internship, volunteer, wage, pay-transparency, nondiscrimination, privacy, and consumer-protection laws.`,
  "community-guidelines": `## Job Post participation

The Job Post room supports many legitimate ways to collaborate, including paid employment, contracts, internships, apprenticeships, funded placements, research, volunteering, community and open-source contribution, testing/feedback, and future-role interest. Posters must separately and truthfully disclose the relationship, compensation status, work arrangement, time structure, poster type, and legitimate application route. Nobody may hide compensation behind a relationship label or imply that a future-interest notice is a current opening or promise of work.

Keep public interactions intentionally thin. Do not submit resumes/CVs, Social Security numbers, banking or tax information, identity documents, private addresses, private phone numbers, account credentials, or sensitive application packets in posts or comments. Use the poster's independently verified official application route, organization contact, repository/contribution instructions, or an authorized first-party Work With flow.

Publication is not endorsement or verification. Elysia Ecobotics does not guarantee the identity, legitimacy, compensation, safety, or accuracy of a poster or opportunity. Independently verify the organization and destination before sharing information, paying money, or accepting work. Never pay to apply or to get paid; see the [Federal Trade Commission's current Job Scams guidance](https://consumer.ftc.gov/articles/job-scams).`,
  "terms-of-use": `## Opportunity listings, classification, and non-endorsement

The Job Post room is a moderated public listing surface, not an employer, staffing agency, payroll system, applicant-tracking system, identity-verification service, or legal classification service. Publication, moderation, labels, and payment state do not constitute endorsement or verification and do not guarantee a poster's identity, legitimacy, compensation, safety, accuracy, or legal compliance.

Opportunity labels do not determine legal employment or worker status. Posters are responsible for complying with applicable wage, contractor, internship, volunteer, employment, pay-transparency, nondiscrimination, privacy, and other laws. The substance and circumstances of a relationship—not the site's selected label—may control its legal treatment. Users should seek qualified advice for their circumstances.

Serious applications must use a legitimate, independently verified route. Public posts and comments must not contain sensitive application or identity material. A Job Post publication fee, if separately enabled and disclosed, is an economic service condition only; it cannot purchase approval, verification, ranking, trust, or publication.`,
  "volunteer-contributor-disclaimer": `## Job Post volunteer and unpaid listings

Volunteer, community-service, open-source, internship, academic-credit, reimbursement-only, and other unpaid opportunities must say so affirmatively and must not be presented as paid employment. Unpaid opportunities posted by for-profit businesses receive enhanced human scrutiny, but a review signal is not an automated legal conclusion. Posters remain responsible for determining and complying with the legal requirements that apply to the actual relationship.

The site does not decide worker classification. Current official guidance emphasizes that labels alone do not determine employee or contractor status, that unpaid internships for for-profit employers depend on the circumstances, and that volunteering rules differ across charitable/public and commercial activity. General official references include the [U.S. Department of Labor worker-classification fact sheet](https://www.dol.gov/agencies/whd/fact-sheets/13-flsa-employment-relationship), [internship fact sheet](https://www.dol.gov/agencies/whd/fact-sheets/71-flsa-internships), and [nonprofit FLSA fact sheet](https://www.dol.gov/agencies/whd/fact-sheets/14a-flsa-non-profits). Colorado-based or Colorado-facing employment posters should also review the state's current [job-posting and hiring guidance](https://cdle.colorado.gov/dlss/labor-laws-by-topic/job-postings-and-hiring). These links are informational, not legal advice.`
};

for (const page of legalPolicyPages) {
  const notice = jobOpportunityLegalNotices[page.slug];
  if (notice) {
    page.lastUpdated = opportunityPolicyDate;
    page.body = page.body
      .replace(/\*\*Last updated:\*\* \d{4}-\d{2}-\d{2}/, `**Last updated:** ${opportunityPolicyDate}`)
      .trim();
    page.body = `${page.body}\n\n${notice}\n`;
  }
}

export type LegalPolicyMetadata = {
  category: string;
  description: string;
};

export type LegalPolicyGroup = {
  category: string;
  description: string;
  slugs: string[];
};

export const legalPolicyMetadata: Record<string, LegalPolicyMetadata> = {
  "privacy-policy": {
    category: "Core Website",
    description: "How the public website handles accounts, public participation, local browser storage, and the private-core boundary."
  },
  "terms-of-use": {
    category: "Core Website",
    description: "The operating terms for using Elysia Ecobotics Online, community features, releases, and public account surfaces."
  },
  "acceptable-use-policy": {
    category: "Core Website",
    description: "What is not allowed across the public website, Marketplace, Commune, Living Library, and account features."
  },
  "community-guidelines": {
    category: "Community and Conduct",
    description: "Participation rules for public community spaces, code sharing, research notes, and public collaboration."
  },
  "code-of-conduct": {
    category: "Community and Conduct",
    description: "Expected conduct for community members, contributors, developers, moderators, reviewers, and administrators."
  },
  "volunteer-contributor-disclaimer": {
    category: "Community and Conduct",
    description: "Clear boundaries for volunteer, contributor, collaborator, reviewer-interest, and future paid-role requests."
  },
  "marketplace-developer-agreement": {
    category: "Marketplace and Add-ons",
    description: "Developer responsibilities for submitting add-ons, manifests, packages, updates, permissions, and claims."
  },
  "add-on-submission-policy": {
    category: "Marketplace and Add-ons",
    description: "How add-ons should be submitted, reviewed, labeled, approved, rejected, revoked, or blocked."
  },
  "security-review-policy": {
    category: "Marketplace and Add-ons",
    description: "How security review labels, threat modeling, and local-execution boundaries are handled."
  },
  "vulnerability-disclosure-policy": {
    category: "Security and Copyright",
    description: "A good-faith security reporting path, with no bounty promise and no destructive testing."
  },
  "dmca-copyright-policy": {
    category: "Security and Copyright",
    description: "Copyright complaint, counter-notice, and DMCA contact guidance."
  },
  "donation-recognition-terms": {
    category: "Stewardship and Brand",
    description: "Boundaries for independent stewardship support, recognition requests, and administrator-assigned badges."
  },
  "trademark-notice": {
    category: "Stewardship and Brand",
    description: "A safe public trademark notice for Elysia Ecobotics™ without publishing private evidence records."
  },
  "support-and-billing-terms": { category: "Economic Support and Services", description: "Voluntary support, recurring support, processor, account-linking, consent, and no-pay-to-govern boundaries." },
  "refund-and-cancellation-policy": { category: "Economic Support and Services", description: "Cancellation, duplicate or mistaken payments, service refunds, disputes, privacy, and non-retaliation." },
  "sandbox-credit-terms": { category: "Economic Support and Services", description: "Measured online sandbox credits, private ledgers, reservations, sponsored access, and immutable safety limits." },
  "job-post-fee-terms": { category: "Economic Support and Services", description: "Commercial Job Post fee conditions kept separate from anti-scam review and publication decisions." },
  "marketplace-commerce-terms": { category: "Marketplace and Add-ons", description: "Commercial offers, licenses, seller preparation, commissions, payouts, review, and local installation authority." },
  "sponsorship-independence-policy": { category: "Organizations and Sponsorship", description: "Disclosure, editorial independence, privacy, conflicts, and the authority that sponsorship cannot buy." },
  "organization-services-terms": { category: "Organizations and Sponsorship", description: "Human-reviewed scopes, proposals, contracts, invoices, confidentiality, processors, cancellation, refunds, and no-pay-to-govern boundaries." },
  "account-closure-financial-retention": { category: "Core Website", description: "How account closure, subscriptions, entitlements, licenses, economic records, and lawful retention remain distinct." },
  "living-library-third-party-resources": {
    category: "Research, Reference, and External Resources",
    description: "How The Living Library independently describes and links to third-party research resources without implying ownership, affiliation, endorsement, or blanket reuse rights."
  },
  "third-party-media-credits": {
    category: "Stewardship and Brand",
    description: "Public source credit and truthful pending-rights status for third-party media incorporated into the Website."
  }
};

export const legalPolicyGroups: LegalPolicyGroup[] = [
  {
    category: "Core Website",
    description: "Privacy, site terms, and acceptable use for the public website.",
    slugs: ["privacy-policy", "terms-of-use", "acceptable-use-policy"]
  },
  {
    category: "Community and Conduct",
    description: "Public participation, conduct, volunteer, contributor, and collaboration boundaries.",
    slugs: ["community-guidelines", "code-of-conduct", "volunteer-contributor-disclaimer"]
  },
  {
    category: "Marketplace and Add-ons",
    description: "Developer agreements, add-on submissions, permissions, manifests, and security review.",
    slugs: ["marketplace-developer-agreement", "add-on-submission-policy", "security-review-policy", "marketplace-commerce-terms"]
  },
  {
    category: "Economic Support and Services",
    description: "Voluntary support, recurring billing, refunds, online service credits, and commercial Job Post boundaries.",
    slugs: ["support-and-billing-terms", "refund-and-cancellation-policy", "sandbox-credit-terms", "job-post-fee-terms", "account-closure-financial-retention"]
  },
  {
    category: "Security and Copyright",
    description: "Responsible vulnerability reporting and copyright/DMCA contact process.",
    slugs: ["vulnerability-disclosure-policy", "dmca-copyright-policy"]
  },
  {
    category: "Stewardship and Brand",
    description: "Donation recognition boundaries, public brand/trademark notice, and third-party media credit.",
    slugs: ["donation-recognition-terms", "trademark-notice", "third-party-media-credits"]
  },
  {
    category: "Organizations and Sponsorship",
    description: "Human-reviewed professional services and ethical sponsorship with privacy, independence, and conflict boundaries.",
    slugs: ["organization-services-terms", "sponsorship-independence-policy"]
  },
  {
    category: "Research, Reference, and External Resources",
    description: "Independent resource listings, external-site boundaries, editorial summaries, and record-specific rights and reuse responsibilities.",
    slugs: ["living-library-third-party-resources"]
  }
];

for (const page of legalPolicyPages) {
  if (archivedLegalPolicyPages.some((archived) => archived.slug === page.slug)) {
    page.body = clarifyEconomicPolicy(page.slug, page.body);
    page.lastUpdated = "2026-09-08";
  }
}

export function getLegalPolicy(slug: string | undefined, version?: string | null): LegalPolicyPage | undefined {
  if (!version || version === readinessLegalVersion) return legalPolicyPages.find((policy) => policy.slug === slug && (!version || policy.lastUpdated === "2026-09-08"));
  return archivedLegalPolicyPages.find((policy) => policy.slug === slug
    && (version === policy.lastUpdated || (slug === "marketplace-commerce-terms" && version === "stripe-connect-test-2026-07-16")));
}

export function getLegalPolicyDescription(slug: string): string {
  return legalPolicyMetadata[slug]?.description ?? "Public operating policy for Elysia Ecobotics Online.";
}
