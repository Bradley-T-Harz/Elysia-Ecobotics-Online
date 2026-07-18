import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ARTISAN_COLLECTIVE_PORTAL_URL,
  ARTISAN_COLLECTIVE_URL
} from "../../config/siteUrls";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";

const pageDescription = "Meet the Elysia Artisan Collective, a separate creative commons for credited human-made, AI-assisted, generative, hybrid, and difficult-to-classify art.";

export default function ElysiaArtisanCollectivePage() {
  return (
    <div className="page-stack artisan-portal-page">
      <PageMetadata
        title="Elysia Artisan Collective | Elysia Ecobotics Online"
        description={pageDescription}
        canonicalUrl={ARTISAN_COLLECTIVE_PORTAL_URL}
      />

      <PageHero
        eyebrow="A separate creative commons"
        title="The Elysia Artisan Collective"
        brandMark="standard"
        actions={(
          <>
            <a className="button-link button-link--primary" href={ARTISAN_COLLECTIVE_URL}>
              Enter the Artisan Collective
              <ExternalLink size={17} aria-hidden="true" />
            </a>
            <Link className="button-link" to="/commons-circle">Manage your Commons account</Link>
          </>
        )}
      >
        <p>A separate creative commons where human-made, AI-assisted, generative, hybrid, and difficult-to-classify art can be shared, credited, explored, and invited into the public world of Elysia Ecobotics.</p>
        <p>The Collective brings artists together to explore what art has been, what it is becoming, and how creative expression can give Elysia Ecobotics greater character, imagination, emotion, contradiction, and life.</p>
      </PageHero>

      <section className="feature-grid feature-grid--three" aria-label="Artisan Collective commitments">
        <FeatureCard title="One public identity">
          <p>The Collective uses the existing Elysia Commons account and canonical Public Commons Profile. Artists do not create or maintain a second account or artist profile.</p>
        </FeatureCard>
        <FeatureCard title="Artists keep ownership">
          <p>Artists retain authorship and receive visible credit. Ordinary participation grants no automatic AI-training rights, and any selected work uses clear, separate attribution and usage terms.</p>
        </FeatureCard>
        <FeatureCard title="Many honest processes">
          <p>Human, AI-assisted, AI-generated and human-directed, hybrid, and procedural work may belong here. Honest creation-method disclosure matters; tool choice is not a popularity ranking.</p>
        </FeatureCard>
      </section>

      <section className="two-column artisan-portal-boundaries">
        <article className="section-card">
          <p className="eyebrow">The shared bridge</p>
          <h2>Public Commons identity only</h2>
          <p>Public display names, avatars, and canonical Commons Profile links can connect the two public sites. Account and profile management remain here on Elysia Ecobotics Online.</p>
          <p>Artwork-specific credit, collaborators, licensing, accessibility descriptions, and creation-method disclosure belong to each work without becoming another profile system.</p>
        </article>
        <article className="section-card artisan-portal-boundary-card">
          <p className="eyebrow">A sealed boundary</p>
          <h2>Private local Elysia stays private</h2>
          <p>The Artisan Collective does not receive private local Elysia memory, conversations, files, logs, vault data, credentials, model prompts, runtime state, private processes, sockets, or machine data.</p>
          <p className="boundary-note">The approved bridge is public identity and attribution—not access to the private local Elysia system.</p>
        </article>
      </section>

      <section className="section-card artisan-portal-cta">
        <div>
          <p className="eyebrow">Cross the threshold</p>
          <h2>A professional doorway into a deliberately stranger world</h2>
          <p>The Collective has its own visual identity, community rooms, creative invitations, and galleries while remaining part of the same public mission.</p>
        </div>
        <a className="button-link button-link--primary" href={ARTISAN_COLLECTIVE_URL}>
          Enter the Artisan Collective
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
