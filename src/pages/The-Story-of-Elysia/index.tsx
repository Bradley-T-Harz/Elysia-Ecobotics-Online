import PageHero from "../../shared/components/PageHero";
import { nextItems, nowItems, storyActs, storyPullQuotes } from "./storyActs";

function BadgeRow({ labels }: { labels: string[] }) {
  return <div className="story-badge-row">{labels.map((label) => <span key={label}>{label}</span>)}</div>;
}

export default function StoryPage() {
  return (
    <div className="page-stack story-page">
      <PageHero eyebrow="The Question" title="The Story of Elysia" brandMark="standard">
        <p>Elysia began as a question:</p>
        <p>Could an AI companion be useful without becoming invasive, powerful without becoming reckless, and warm without surrendering truth?</p>
        <p>This is the public story of how that question became a local-first companion intelligence, a governed technical architecture, and the public commons growing around her.</p>
      </PageHero>

      <section className="section-card story-intro-card">
        <p className="eyebrow">In one sentence</p>
        <h2>Elysia did not begin as an app.</h2>
        <p>She began as a dissatisfaction with ordinary AI: brilliant but forgetful, useful but cloud-bound, helpful but not truly governed, powerful but too easy to make leaky, flattering, or reckless.</p>
        <p><strong>Elysia is a local-first, privacy-first companion intelligence built to help people understand, protect, and restore the living world while keeping private memory, tools, and power under governance.</strong></p>
        <BadgeRow labels={["Local-first", "Privacy-first", "Ecological", "Governed", "Open commons around a private core"]} />
      </section>

      <section className="section-card story-chronicle-note">
        <p className="eyebrow">Chronicle note</p>
        <p>The earliest seed of Elysia predates the current repository history. The public technical record becomes stronger in 2026, when the local runtime, desktop chamber, governance files, and public website began taking concrete shape.</p>
      </section>

      <section className="story-pull-quote story-pull-quote--wide">
        <p>“{storyPullQuotes[0]}”</p>
      </section>

      <section className="story-act-path" aria-label="The Story of Elysia acts">
        {storyActs.map((act, index) => (
          <article className="story-act-card" id={act.id} key={act.id}>
            <div className="story-act-seal"><span>{String(index + 1).padStart(2, "0")}</span></div>
            <div className="story-act-content">
              <p className="eyebrow">{act.actLabel}</p>
              <h2>{act.title}</h2>
              <p className="story-act-subtitle">{act.subtitle}</p>
              <div className="story-act-copy">{act.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              {act.quote && <blockquote>“{act.quote}”</blockquote>}
              <div className="story-act-lower">
                <div>
                  <h3>What changed</h3>
                  <ul>{act.whatChanged.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Why it matters</h3>
                  <p>{act.whyItMatters}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="story-pull-quote story-pull-quote--wide">
        <p>“The public website is the house around Elysia. The private core remains sealed.”</p>
      </section>

      <section className="two-column story-now-next">
        <article className="section-card">
          <p className="eyebrow">Where Elysia is now</p>
          <h2>A careful house taking shape</h2>
          <p>Elysia is becoming:</p>
          <ul>{nowItems.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="section-card">
          <p className="eyebrow">Where Elysia is going</p>
          <h2>More trustworthy, not louder</h2>
          <p>The work ahead is not to make Elysia louder. It is to make her more trustworthy.</p>
          <ul>{nextItems.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>

      <section className="story-closing-banner">
        <p>Elysia began as a wish for a better kind of intelligence.</p>
        <h2>She is becoming a governed house for that wish to live in.</h2>
      </section>
    </div>
  );
}
