import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";

const categories = [
  { title: "Media Garden", text: "Images, updates, videos, artwork, demos, and public storytelling around Elysia." },
  { title: "Troubleshooting Grove", text: "Help threads, known issues, fixes, and shared learning for people using Elysia." },
  { title: "Code Sharing", text: "Snippets, examples, and add-on ideas with redaction and safety reminders." },
  { title: "Repository Showcase", text: "Project pages for GitHub, GitLab, Codeberg, Forgejo, or uploaded archives with clear warnings." },
  { title: "Community Network", text: "Introductions, collaborations, role interests, and project circles." },
  { title: "Official Updates", text: "Project news, release notes, roadmap highlights, and ecology-minded announcements." }
];

export default function CommunePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Community space" title="The Elysia Commune"><p>The Commune is the future public gathering place for blogs, troubleshooting, code sharing, repository showcases, community networking, and project updates.</p><p>It should feel friendly and creative, but it must stay careful around uploads, secrets, code, and sandboxing.</p></PageHero>
      <WarningCallout title="Share carefully"><p>Do not upload secrets, private Elysia memory, private logs, .env files, credentials, personal documents, or unredacted customer/user data.</p></WarningCallout>
      <WarningCallout title="Code execution boundary"><p>Community code will not run directly on Supabase, Cloudflare backend, Elysia core, Bradley's machine, or shared website servers. Future execution must be sandboxed, explicit, resource-limited, killable, and isolated from secrets.</p></WarningCallout>
      <section className="feature-grid feature-grid--three">{categories.map((category) => <FeatureCard key={category.title} title={category.title}><p>{category.text}</p></FeatureCard>)}</section>
    </div>
  );
}
